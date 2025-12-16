const { createClient } = require('@supabase/supabase-js');

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
    const { data: existingVote } = await supabase
        .from('application_votes')
        .select('id, vote')
        .eq('application_id', applicationId)
        .eq('voter_discord_id', interaction.user.id)
        .single();

    if (existingVote) {
        if (existingVote.vote === isFor) {
            return interaction.reply({
                content: `Vous avez déjà voté ${isFor ? '👍 pour' : '👎 contre'}.`,
                flags: 64
            });
        }

        await supabase
            .from('application_votes')
            .update({ vote: isFor })
            .eq('id', existingVote.id);

        await interaction.reply({
            content: `Vote modifié: ${isFor ? '👍 Pour' : '👎 Contre'}`,
            flags: 64
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

        await interaction.reply({
            content: `Vote enregistré: ${isFor ? '👍 Pour' : '👎 Contre'}`,
            flags: 64
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

    await interaction.reply({ content: '✅ Statut mis à jour.', flags: 64 });

    await interaction.channel.send({
        content: `📊 **Statut:** En examen (par ${actorName})`
    });
}

// Handler pour l'alerte
async function handleAlert(interaction, applicationId) {
    const { data: application } = await supabase
        .from('applications')
        .select('alert_user_id, first_name, last_name')
        .eq('id', applicationId)
        .single();

    if (!application) {
        return interaction.reply({ content: '❌ Candidature introuvable.', flags: 64 });
    }

    if (application.alert_user_id === interaction.user.id) {
        await supabase
            .from('applications')
            .update({ alert_user_id: null })
            .eq('id', applicationId);

        await interaction.reply({ content: '🔕 Alerte désactivée.', flags: 64 });
    } else {
        await supabase
            .from('applications')
            .update({ alert_user_id: interaction.user.id })
            .eq('id', applicationId);

        await interaction.reply({
            content: `🔔 Alerte activée ! Vous serez mentionné au prochain message de **${application.first_name} ${application.last_name}**.`,
            flags: 64
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
async function handleConvocationConfirm(interaction, targetUserId) {
    // Vérifier que c'est bien la personne convoquée
    if (interaction.user.id !== targetUserId) {
        return interaction.reply({
            content: '❌ Seule la personne convoquée peut répondre.',
            flags: 64
        });
    }

    // Mettre à jour le message original avec la confirmation
    const originalEmbed = interaction.message.embeds[0];
    const { EmbedBuilder } = require('discord.js');

    const updatedEmbed = EmbedBuilder.from(originalEmbed)
        .setColor(0x22C55E) // Vert
        .addFields({ name: '✅ Réponse', value: `<@${interaction.user.id}> a confirmé sa présence.`, inline: false });

    await interaction.update({
        embeds: [updatedEmbed],
        components: [] // Retirer les boutons
    });
}

// Handler pour absence à une convocation (ouvre un modal)
async function handleConvocationAbsent(interaction, targetUserId) {
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
        .setCustomId(`convocation_absence_modal_${interaction.message.id}`)
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
    const messageId = interaction.customId.replace('convocation_absence_modal_', '');
    const message = interaction.message;

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

