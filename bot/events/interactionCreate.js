const { EmbedBuilder } = require('discord.js');
const {
    handleVote,
    handleStatus,
    handleAlert,
    handleDocs,
    handleCloseChannel,
    handleConvocationConfirm,
    handleConvocationAbsent,
    handleConvocationAbsenceModal
} = require('../handlers/buttonHandlers');
const log = require('../utils/logger');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, { supabase }) {
        // Gestion des slash commands
        if (interaction.isChatInputCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);
            if (!command) return;

            try {
                interaction.supabase = supabase;
                interaction.config = {
                    guildId: process.env.DISCORD_GUILD_ID,
                    lspdCategoryId: process.env.LSPD_CATEGORY_ID,
                    bcsoCategoryId: process.env.BCSO_CATEGORY_ID,
                    lspdRecruiterRoleId: process.env.LSPD_RECRUITER_ROLE_ID,
                    bcsoRecruiterRoleId: process.env.BCSO_RECRUITER_ROLE_ID,
                    adminRoleId: process.env.ADMIN_ROLE_ID,
                };

                await command.execute(interaction);
            } catch (error) {
                log.error(`Erreur commande ${interaction.commandName}: ${error.message}`);

                const errorEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('❌ Erreur')
                    .setDescription('Une erreur est survenue lors de l\'exécution de cette commande.')
                    .setTimestamp();

                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ embeds: [errorEmbed], flags: 64 });
                } else {
                    await interaction.reply({ embeds: [errorEmbed], flags: 64 });
                }
            }
            return;
        }

        // Gestion des boutons
        if (interaction.isButton()) {
            await handleButtonInteraction(interaction, supabase);
            return;
        }

        // Gestion des modals
        if (interaction.isModalSubmit()) {
            await handleModalInteraction(interaction, supabase);
            return;
        }
    }
};

async function handleButtonInteraction(interaction, supabase) {
    const customId = interaction.customId;

    try {
        if (customId.startsWith('vote_pour_')) {
            const appId = customId.replace('vote_pour_', '');
            await handleVote(interaction, appId, true);
            return;
        }

        if (customId.startsWith('vote_contre_')) {
            const appId = customId.replace('vote_contre_', '');
            await handleVote(interaction, appId, false);
            return;
        }

        if (customId.startsWith('statut_reviewing_')) {
            const appId = customId.replace('statut_reviewing_', '');
            await handleStatus(interaction, appId, 'reviewing');
            return;
        }

        if (customId.startsWith('statut_interview_')) {
            const appId = customId.replace('statut_interview_', '');
            await handleStatus(interaction, appId, 'interview_scheduled');
            return;
        }

        if (customId.startsWith('statut_recruited_')) {
            const appId = customId.replace('statut_recruited_', '');
            await handleStatus(interaction, appId, 'recruited');
            return;
        }

        if (customId.startsWith('statut_rejected_')) {
            const appId = customId.replace('statut_rejected_', '');
            await handleStatus(interaction, appId, 'rejected');
            return;
        }

        if (customId.startsWith('alert_')) {
            const appId = customId.replace('alert_', '');
            await handleAlert(interaction, appId);
            return;
        }

        if (customId.startsWith('docs_')) {
            const appId = customId.replace('docs_', '');
            await handleDocs(interaction, appId);
            return;
        }

        if (customId.startsWith('close_channel_')) {
            await handleCloseChannel(interaction);
            return;
        }

        // Convocation buttons
        if (customId.startsWith('convocation_confirm_')) {
            const parts = customId.split('_');
            const targetUserId = parts[2];
            await handleConvocationConfirm(interaction, targetUserId);
            return;
        }

        if (customId.startsWith('convocation_absent_')) {
            const parts = customId.split('_');
            const targetUserId = parts[2];
            await handleConvocationAbsent(interaction, targetUserId);
            return;
        }

    } catch (error) {
        log.error(`Erreur bouton ${customId}: ${error.message}`);

        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ Une erreur est survenue.',
                    flags: 64
                });
            }
        } catch (replyError) {
            log.error(`Erreur reply: ${replyError.message}`);
        }
    }
}

async function handleModalInteraction(interaction, supabase) {
    const customId = interaction.customId;

    try {
        // Convocation absence modal
        if (customId.startsWith('convocation_absence_modal_')) {
            await handleConvocationAbsenceModal(interaction);
            return;
        }

    } catch (error) {
        log.error(`Erreur modal ${customId}: ${error.message}`);

        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ Une erreur est survenue.',
                    flags: 64
                });
            }
        } catch (replyError) {
            log.error(`Erreur reply modal: ${replyError.message}`);
        }
    }
}

