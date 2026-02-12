const { createClient } = require('@supabase/supabase-js');
const log = require('../utils/logger');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

const docLabels = {
    'id_card': "🪪 Pièce d'identité",
    'driving_license': "🚗 Permis de conduire",
    'weapon_permit': "🔫 Permis de port d'arme"
};

// Handler pour le vote
async function handleVote(interaction, applicationId, isFor) {
    await interaction.deferReply({ flags: 64 });

    const { data: existingVote } = await supabase
        .from('application_votes')
        .select('id, vote')
        .eq('application_id', applicationId)
        .eq('voter_discord_id', interaction.user.id)
        .single();

    if (existingVote) {
        if (existingVote.vote === isFor) {
            return interaction.editReply({
                content: `Vous avez déjà voté ${isFor ? '👍 pour' : '👎 contre'}.`
            });
        }

        await supabase
            .from('application_votes')
            .update({ vote: isFor })
            .eq('id', existingVote.id);

        await interaction.editReply({
            content: `Vote modifié: ${isFor ? '👍 Pour' : '👎 Contre'}`
        });
    } else {
        await supabase
            .from('application_votes')
            .insert({
                application_id: applicationId,
                voter_discord_id: interaction.user.id,
                voter_name: interaction.member?.displayName || interaction.user.username,
                vote: isFor
            });

        await interaction.editReply({
            content: `Vote enregistré: ${isFor ? '👍 Pour' : '👎 Contre'}`
        });
    }

    // Afficher le récapitulatif
    const { data: votes } = await supabase
        .from('application_votes')
        .select('vote')
        .eq('application_id', applicationId);

    const pour = votes?.filter(v => v.vote).length || 0;
    const contre = votes?.filter(v => !v.vote).length || 0;

    await interaction.channel.send({
        content: `📊 **Votes:** 👍 ${pour} | 👎 ${contre}`
    });
}

// Handler pour le changement de statut
async function handleStatus(interaction, applicationId, newStatus) {
    await interaction.deferReply({ flags: 64 });

    const actorName = interaction.member?.displayName || interaction.user.username;

    await supabase
        .from('applications')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', applicationId);

    await supabase.from('application_logs').insert({
        application_id: applicationId,
        actor_discord_id: interaction.user.id,
        actor_name: actorName,
        action: 'status_change',
        details: { new_status: newStatus }
    });

    await interaction.editReply({ content: '✅ Statut mis à jour.' });

    await interaction.channel.send({
        content: `📊 **Statut:** En examen (par ${actorName})`
    });
}

// Handler pour l'alerte
async function handleAlert(interaction, applicationId) {
    await interaction.deferReply({ flags: 64 });

    const { data: application } = await supabase
        .from('applications')
        .select('alert_user_id, first_name, last_name')
        .eq('id', applicationId)
        .single();

    if (!application) {
        return interaction.editReply({ content: '❌ Candidature introuvable.' });
    }

    if (application.alert_user_id === interaction.user.id) {
        await supabase
            .from('applications')
            .update({ alert_user_id: null })
            .eq('id', applicationId);

        await interaction.editReply({ content: '🔕 Alerte désactivée.' });
    } else {
        await supabase
            .from('applications')
            .update({ alert_user_id: interaction.user.id })
            .eq('id', applicationId);

        await interaction.editReply({
            content: `🔔 Alerte activée ! Vous serez mentionné au prochain message de **${application.first_name} ${application.last_name}**.`
        });
    }
}

// Handler pour les documents
async function handleDocs(interaction, applicationId) {
    await interaction.deferReply({ flags: 64 });

    const { data: documents } = await supabase
        .from('application_documents')
        .select('type, file_url')
        .eq('application_id', applicationId);

    if (!documents || documents.length === 0) {
        return interaction.editReply('📭 Aucun document trouvé.');
    }

    const docList = documents.map(doc => {
        const label = docLabels[doc.type] || doc.type;
        return `${label}:\n${doc.file_url}`;
    }).join('\n\n');

    await interaction.editReply(`📎 **Documents de la candidature:**\n\n${docList}`);
}

// Handler pour fermer/supprimer un salon
async function handleCloseChannel(interaction) {
    await interaction.deferReply({ flags: 64 });

    const channel = interaction.channel;
    if (!channel) {
        return interaction.editReply('❌ Impossible de trouver le salon.');
    }

    try {
        await interaction.editReply('✅ Salon en cours de suppression...');

        // Supprimer le salon
        await channel.delete('Candidature clôturée');
    } catch (error) {
        console.error('[CloseChannel] Error:', error);
        try {
            await interaction.editReply('❌ Erreur lors de la suppression du salon.');
        } catch {
            // Le salon a peut-être déjà été supprimé
        }
    }
}

// Handler pour confirmation de convocation
async function handleConvocationConfirm(interaction, targetUserId, convokerUserId, scheduledTimestamp) {
    // Vérifier que c'est bien la personne convoquée
    if (interaction.user.id !== targetUserId) {
        return interaction.reply({
            content: '❌ Seule la personne convoquée peut répondre.',
            flags: 64
        });
    }

    log.info(`[Convocation] Confirmation reçue par ${interaction.user.id} | convoker=${convokerUserId || 'unknown'} | ts=${scheduledTimestamp || 'none'}`);

    // On utilise deferUpdate pour accuser réception immédiatement
    await interaction.deferUpdate();

    // Mettre à jour le message original avec la confirmation
    const originalEmbed = interaction.message.embeds[0];
    const { EmbedBuilder } = require('discord.js');

    const updatedEmbed = EmbedBuilder.from(originalEmbed)
        .setColor(0x22C55E) // Vert
        .addFields({ name: '✅ Réponse', value: `<@${interaction.user.id}> a confirmé sa présence.`, inline: false });

    const parsedConvocation = parseConvocationFromEmbed(originalEmbed);
    const scheduledFromButton = parseScheduledTimestamp(scheduledTimestamp);

    if (parsedConvocation || scheduledFromButton) {
        try {
            const sourceDate = scheduledFromButton || parsedConvocation?.date;
            if (!sourceDate) {
                throw new Error('Impossible de déterminer la date de convocation');
            }

            const startTime = scheduledFromButton
                ? `${sourceDate.getHours().toString().padStart(2, '0')}:${sourceDate.getMinutes().toString().padStart(2, '0')}`
                : parsedConvocation.startTime;

            const endTime = (() => {
                const end = new Date(sourceDate.getTime() + 60 * 60 * 1000);
                return `${end.getHours().toString().padStart(2, '0')}:${end.getMinutes().toString().padStart(2, '0')}`;
            })();

            const eventDateOnly = `${sourceDate.getFullYear()}-${(sourceDate.getMonth() + 1).toString().padStart(2, '0')}-${sourceDate.getDate().toString().padStart(2, '0')}`;
            const eventDateTime = `${eventDateOnly}T${startTime}:00`;

            log.info(`[Convocation] Création événement calendrier | user=${interaction.user.id} | date=${eventDateTime} | convoker=${convokerUserId || 'unknown'}`);

            const { data: createdEvent, error: eventError } = await supabase
                .from('events')
                .insert({
                    title: `Convocation - ${interaction.user.username}`,
                    description: [
                        `Convocation acceptée automatiquement depuis Discord.`,
                        ``,
                        `Patient: <@${interaction.user.id}>`,
                        `Convocateur: <@${convokerUserId || 'inconnu'}>`,
                        `Motif: ${parsedConvocation?.motif || 'Non spécifié'}`
                    ].join('\n'),
                    event_date: eventDateTime,
                    start_time: startTime,
                    end_time: endTime,
                    location: parsedConvocation?.lieu || 'Non précisé',
                    event_type: 'rdv',
                    event_size: 'minor',
                    color: '#059669',
                    is_published: true,
                    participants_all: false,
                    created_by: convokerUserId || null
                })
                .select('id')
                .single();

            if (eventError || !createdEvent?.id) {
                log.error(`[Convocation] Échec création événement: ${eventError?.message || 'unknown'}`);
            } else {
                log.success(`[Convocation] Événement créé: ${createdEvent.id}`);

                const { error: participantError } = await supabase
                    .from('event_participants')
                    .insert({
                        event_id: createdEvent.id,
                        user_discord_id: interaction.user.id,
                        user_name: interaction.member?.displayName || interaction.user.username
                    });

                if (participantError) {
                    log.error(`[Convocation] Échec ajout participant event ${createdEvent.id}: ${participantError.message}`);
                } else {
                    log.info(`[Convocation] Participant ajouté event ${createdEvent.id} -> ${interaction.user.id}`);
                }
            }
        } catch (eventCreationError) {
            log.error(`[Convocation] Erreur création événement: ${eventCreationError.message}`);
        }
    } else {
        log.warn(`[Convocation] Impossible de parser la convocation depuis l'embed pour ${interaction.user.id}`);
    }

    await interaction.editReply({
        embeds: [updatedEmbed],
        components: [] // Retirer les boutons
    });
}

// Handler pour absence à une convocation (ouvre un modal)
async function handleConvocationAbsent(interaction, targetUserId, convokerUserId, scheduledTimestamp) {
    // Vérifier que c'est bien la personne convoquée
    if (interaction.user.id !== targetUserId) {
        return interaction.reply({
            content: '❌ Seule la personne convoquée peut répondre.',
            flags: 64
        });
    }

    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

    // Créer le modal pour la raison d'absence
    const modal = new ModalBuilder()
        .setCustomId(`convocation_absence_modal_${interaction.message.id}_${convokerUserId || 'unknown'}_${scheduledTimestamp || 'unknown'}`)
        .setTitle('Signaler une absence');

    const raisonInput = new TextInputBuilder()
        .setCustomId('raison')
        .setLabel('Raison de votre absence')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Expliquez la raison de votre empêchement...')
        .setRequired(true)
        .setMaxLength(500);

    const actionRow = new ActionRowBuilder().addComponents(raisonInput);
    modal.addComponents(actionRow);

    await interaction.showModal(modal);
}

// Handler pour le modal d'absence convocation
async function handleConvocationAbsenceModal(interaction) {
    const raison = interaction.fields.getTextInputValue('raison');

    // Récupérer le message original
    const customIdParts = interaction.customId.split('_');
    const messageId = customIdParts[3];
    const message = interaction.message;

    log.info(`[Convocation] Absence signalée par ${interaction.user.id} sur message ${messageId}`);

    const { EmbedBuilder } = require('discord.js');

    // On doit récupérer l'embed du message original car le modal n'a pas accès direct
    // Utiliser une réponse directe
    const embed = new EmbedBuilder()
        .setColor(0xF59E0B) // Orange
        .setTitle('❌ Absence Signalée')
        .setDescription(`<@${interaction.user.id}> ne pourra pas être présent(e).`)
        .addFields({ name: '📝 Raison', value: raison, inline: false })
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });

    // Essayer de mettre à jour le message original pour retirer les boutons
    try {
        const originalMessage = await interaction.channel.messages.fetch(messageId);
        if (originalMessage) {
            const originalEmbed = originalMessage.embeds[0];
            if (originalEmbed) {
                const updatedEmbed = EmbedBuilder.from(originalEmbed)
                    .setColor(0xEF4444); // Rouge
                await originalMessage.edit({ embeds: [updatedEmbed], components: [] });
            }
        }
    } catch (e) {
        // Le message original a pu être supprimé ou inaccessible
        console.error('[ConvocationModal] Could not update original message:', e.message);
    }
}

function parseConvocationFromEmbed(embed) {
    if (!embed || !embed.fields || embed.fields.length === 0) {
        return null;
    }

    const fieldByName = (name) => embed.fields.find(field => field.name === name)?.value || '';
    const dateValue = fieldByName('📅 Date');
    const timeValue = fieldByName('🕐 Heure');
    const lieu = fieldByName('📍 Lieu') || 'Non précisé';
    const motif = fieldByName('📋 Motif') || 'Non spécifié';

    const dateMatch = dateValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!dateMatch) {
        return null;
    }

    const timeMatch = timeValue.match(/^(\d{1,2})[:hH](\d{2})$/);
    if (!timeMatch) {
        return null;
    }

    const day = parseInt(dateMatch[1], 10);
    const month = parseInt(dateMatch[2], 10) - 1;
    const year = parseInt(dateMatch[3], 10);
    const hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2], 10);

    const date = new Date(year, month, day, hours, minutes, 0, 0);
    if (Number.isNaN(date.getTime())) {
        return null;
    }

    const endDate = new Date(date.getTime() + 60 * 60 * 1000);

    return {
        date,
        startTime: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`,
        endTime: `${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`,
        lieu,
        motif
    };
}

function parseScheduledTimestamp(value) {
    if (!value) return null;

    const ts = parseInt(String(value), 10);
    if (Number.isNaN(ts)) return null;

    const date = new Date(ts);
    return Number.isNaN(date.getTime()) ? null : date;
}

module.exports = {
    handleVote,
    handleStatus,
    handleAlert,
    handleDocs,
    handleCloseChannel,
    handleConvocationConfirm,
    handleConvocationAbsent,
    handleConvocationAbsenceModal
};

