const { EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const log = require('../utils/logger');
const { handleInteractionError } = require('../utils/errorHandler');

/**
 * Handlers pour les rendez-vous (RDV)
 */

/**
 * Détermine le rôle médical de l'utilisateur
 */
function getUserRoleLabel(interaction) {
    const roleNames = interaction.member.roles.cache.map(r => r.name.toLowerCase());

    if (roleNames.some(r => r.includes('direction') || r.includes('directeur') || r.includes('directrice'))) {
        return 'Direction';
    } else if (roleNames.some(r => r.includes('chirurgien'))) {
        return 'Chirurgien';
    } else if (roleNames.some(r => r.includes('médecin') || r.includes('medecin'))) {
        return 'Médecin';
    } else if (roleNames.some(r => r.includes('infirmier') || r.includes('infirmière') || r.includes('infirmiere'))) {
        return 'Infirmier';
    }
    return 'Staff';
}

/**
 * Affiche le modal de programmation de RDV
 */
function showScheduleModal(interaction, appointmentId) {
    const modal = new ModalBuilder()
        .setCustomId(`rdv_schedule_modal_${appointmentId}`)
        .setTitle('📅 Programmer le rendez-vous')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('date')
                    .setLabel('Date (JJ/MM/AAAA)')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('02/01/2026')
                    .setRequired(true)
                    .setMaxLength(10)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('time')
                    .setLabel('Heure (HH:MM)')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('14:30')
                    .setRequired(true)
                    .setMaxLength(5)
            )
        );

    return interaction.showModal(modal);
}

/**
 * Handler pour le modal de programmation de RDV
 */
async function handleScheduleModal(interaction, supabase, appointmentId) {
    try {
        const dateStr = interaction.fields.getTextInputValue('date');
        const timeStr = interaction.fields.getTextInputValue('time');

        // Parser la date
        const dateMatch = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (!dateMatch) {
            return interaction.reply({ content: '❌ Format de date invalide. Utilisez JJ/MM/AAAA', flags: 64 });
        }

        // Parser l'heure
        const timeMatch = timeStr.match(/^(\d{1,2}):(\d{2})$/);
        if (!timeMatch) {
            return interaction.reply({ content: '❌ Format d\'heure invalide. Utilisez HH:MM', flags: 64 });
        }

        const scheduledDate = new Date(
            parseInt(dateMatch[3]),
            parseInt(dateMatch[2]) - 1,
            parseInt(dateMatch[1]),
            parseInt(timeMatch[1]),
            parseInt(timeMatch[2])
        );

        if (scheduledDate < new Date()) {
            return interaction.reply({ content: '❌ La date doit être dans le futur.', flags: 64 });
        }

        // Récupérer le RDV
        const { data: appointment, error: fetchError } = await supabase
            .from('appointments')
            .select('*, patients(*)')
            .eq('id', appointmentId)
            .single();

        if (fetchError || !appointment) {
            return interaction.reply({ content: '❌ Rendez-vous introuvable.', flags: 64 });
        }

        const roleLabel = getUserRoleLabel(interaction);
        const displayName = interaction.member.displayName || interaction.user.username;

        // Mettre à jour le RDV en base
        const { error: updateError } = await supabase
            .from('appointments')
            .update({
                status: 'scheduled',
                scheduled_date: scheduledDate.toISOString(),
                assigned_to: interaction.user.id,
                assigned_to_name: `${displayName} (${roleLabel})`
            })
            .eq('id', appointmentId);

        if (updateError) {
            return interaction.reply({ content: '❌ Erreur lors de la mise à jour: ' + updateError.message, flags: 64 });
        }

        // Envoyer un embed dans le salon
        const embed = new EmbedBuilder()
            .setColor(0x3B82F6)
            .setTitle('📅 Rendez-vous Programmé')
            .setDescription(`**${displayName}** (${roleLabel}) a programmé ce rendez-vous.`)
            .addFields(
                { name: '📅 Date', value: scheduledDate.toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' }), inline: true }
            )
            .setTimestamp();

        await interaction.channel.send({ embeds: [embed] });

        // Envoyer DM au patient
        try {
            const user = await interaction.client.users.fetch(appointment.discord_id);
            const dmEmbed = new EmbedBuilder()
                .setColor(0x3B82F6)
                .setTitle('📅 Rendez-vous Programmé')
                .setDescription([
                    `Bonjour,`,
                    ``,
                    `Votre rendez-vous a été programmé par **${displayName}** (${roleLabel}).`,
                    ``,
                    `📅 **Date:** ${scheduledDate.toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })}`,
                    ``,
                    `Merci de votre confiance !`
                ].join('\n'))
                .setTimestamp();

            await user.send({ embeds: [dmEmbed] });
        } catch (dmError) {
            // DMs fermés, on continue
        }

        await interaction.reply({ content: '✅ Rendez-vous programmé avec succès !', flags: 64 });
    } catch (error) {
        await handleInteractionError(error, interaction, 'rdv_schedule_modal');
    }
}

/**
 * Handler pour fermer un ticket RDV
 */
async function handleClose(interaction, supabase, appointmentId) {
    try {
        // Récupérer le RDV
        const { data: appointment, error: fetchError } = await supabase
            .from('appointments')
            .select('*')
            .eq('id', appointmentId)
            .single();

        if (fetchError || !appointment) {
            return interaction.reply({ content: '❌ Rendez-vous introuvable.', flags: 64 });
        }

        const displayName = interaction.member.displayName || interaction.user.username;

        // Si le RDV est en attente ou programmé, l'annuler
        if (appointment.status === 'pending' || appointment.status === 'scheduled') {
            await supabase
                .from('appointments')
                .update({
                    status: 'cancelled',
                    cancel_reason: `Ticket fermé par ${displayName}`
                })
                .eq('id', appointmentId);

            // Notifier le patient
            try {
                const user = await interaction.client.users.fetch(appointment.discord_id);
                const dmEmbed = new EmbedBuilder()
                    .setColor(0xEF4444)
                    .setTitle('❌ Rendez-vous Annulé')
                    .setDescription([
                        `Bonjour,`,
                        ``,
                        `Votre rendez-vous a été annulé par **${displayName}**.`,
                        ``,
                        `Si vous avez des questions, n'hésitez pas à nous contacter.`
                    ].join('\n'))
                    .setTimestamp();

                await user.send({ embeds: [dmEmbed] });
            } catch (dmError) {
                // DMs fermés
            }
        }

        // Fermer le canal
        await interaction.reply({ content: '🔒 Fermeture du ticket dans 5 secondes...', flags: 64 });

        setTimeout(async () => {
            try {
                await interaction.channel.delete();
            } catch (deleteError) {
                log.error('Erreur suppression canal:', { error: deleteError.message });
            }
        }, 5000);
    } catch (error) {
        await handleInteractionError(error, interaction, 'rdv_close');
    }
}

module.exports = {
    showScheduleModal,
    handleScheduleModal,
    handleClose,
    getUserRoleLabel
};
