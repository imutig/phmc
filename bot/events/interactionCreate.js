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
const factureCommand = require('../commands/facture');
const evenementCommand = require('../commands/evenement');
const serviceHandlers = require('../handlers/serviceHandlers');
const rdvHandlers = require('../handlers/rdvHandlers');
const log = require('../utils/logger');
const { handleInteractionError } = require('../utils/errorHandler');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, { supabase }) {
        // Gestion des slash commands
        if (interaction.isChatInputCommand()) {
            await handleSlashCommand(interaction, supabase);
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

        // Gestion des select menus
        if (interaction.isStringSelectMenu()) {
            await handleSelectMenuInteraction(interaction, supabase);
            return;
        }
    }
};

/**
 * Gestion des slash commands
 */
async function handleSlashCommand(interaction, supabase) {
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
        // Si c'est une interaction expirée, juste logger sans tenter de répondre
        if (error.code === 10062) {
            log.error(`Interaction expirée pour /${interaction.commandName} (utilisateur: ${interaction.user?.id})`, {
                context: `command:${interaction.commandName}`,
                errorName: error.name,
            });
            return;
        }
        await handleInteractionError(error, interaction, `command:${interaction.commandName}`);
    }
}

/**
 * Gestion des boutons
 */
async function handleButtonInteraction(interaction, supabase) {
    const customId = interaction.customId;

    try {
        // Votes
        if (customId.startsWith('vote_pour_')) {
            return await handleVote(interaction, customId.replace('vote_pour_', ''), true);
        }
        if (customId.startsWith('vote_contre_')) {
            return await handleVote(interaction, customId.replace('vote_contre_', ''), false);
        }

        // Statuts candidature
        if (customId.startsWith('statut_reviewing_')) {
            return await handleStatus(interaction, customId.replace('statut_reviewing_', ''), 'reviewing');
        }
        if (customId.startsWith('statut_interview_')) {
            return await handleStatus(interaction, customId.replace('statut_interview_', ''), 'interview_scheduled');
        }
        if (customId.startsWith('statut_recruited_')) {
            return await handleStatus(interaction, customId.replace('statut_recruited_', ''), 'recruited');
        }
        if (customId.startsWith('statut_rejected_')) {
            return await handleStatus(interaction, customId.replace('statut_rejected_', ''), 'rejected');
        }

        // Autres boutons candidature
        if (customId.startsWith('alert_')) {
            return await handleAlert(interaction, customId.replace('alert_', ''));
        }
        if (customId.startsWith('docs_')) {
            return await handleDocs(interaction, customId.replace('docs_', ''));
        }
        if (customId.startsWith('close_channel_')) {
            return await handleCloseChannel(interaction);
        }

        // Convocations
        if (customId.startsWith('convocation_confirm_')) {
            const targetUserId = customId.split('_')[2];
            const convokerUserId = customId.split('_')[3];
            const scheduledTimestamp = customId.split('_')[4];
            const durationMinutes = customId.split('_')[5];
            const convocationType = customId.split('_')[6];
            return await handleConvocationConfirm(interaction, targetUserId, convokerUserId, scheduledTimestamp, durationMinutes, convocationType);
        }
        if (customId.startsWith('convocation_absent_')) {
            const targetUserId = customId.split('_')[2];
            const convokerUserId = customId.split('_')[3];
            const scheduledTimestamp = customId.split('_')[4];
            const durationMinutes = customId.split('_')[5];
            const convocationType = customId.split('_')[6];
            return await handleConvocationAbsent(interaction, targetUserId, convokerUserId, scheduledTimestamp, durationMinutes, convocationType);
        }

        // Services - boutons simples
        if (customId === 'profil_services' || customId === 'service_view_week') {
            return await interaction.reply({
                content: '📋 Utilisez la commande `/service voir` pour afficher vos services.',
                flags: 64
            });
        }
        if (customId === 'service_add_quick') {
            return await serviceHandlers.showServiceAddModal(interaction);
        }
        if (customId === 'service_refresh') {
            return await interaction.reply({
                content: '🔄 Utilisez `/service voir` pour actualiser.',
                flags: 64
            });
        }

        // Équipe - prise/fin de service
        if (customId === 'equipe_start_service') {
            return await serviceHandlers.handleServiceStart(interaction, supabase);
        }
        if (customId === 'equipe_end_service') {
            return await serviceHandlers.handleServiceEnd(interaction, supabase);
        }

        // Facture
        if (customId.startsWith('facture_')) {
            return await factureCommand.handleInteraction(interaction);
        }

        // RDV - programmation
        if (customId.startsWith('rdv_schedule_')) {
            const appointmentId = customId.replace('rdv_schedule_', '');
            return await rdvHandlers.showScheduleModal(interaction, appointmentId);
        }

        // RDV - fermeture
        if (customId.startsWith('rdv_close_')) {
            const appointmentId = customId.replace('rdv_close_', '');
            return await rdvHandlers.handleClose(interaction, supabase, appointmentId);
        }

    } catch (error) {
        if (error.code === 10062) return; // Interaction expirée, rien à faire
        await handleInteractionError(error, interaction, `button:${customId}`);
    }
}

/**
 * Gestion des modals
 */
async function handleModalInteraction(interaction, supabase) {
    const customId = interaction.customId;

    try {
        // Convocation absence
        if (customId.startsWith('convocation_absence_modal_')) {
            return await handleConvocationAbsenceModal(interaction);
        }

        // Service add
        if (customId === 'service_add_modal') {
            return await serviceHandlers.handleServiceAddModal(interaction, supabase);
        }

        // Facture quantity
        if (customId.startsWith('facture_qty_modal:')) {
            return await factureCommand.handleModal(interaction);
        }

        // RDV Schedule
        if (customId.startsWith('rdv_schedule_modal_')) {
            const appointmentId = customId.replace('rdv_schedule_modal_', '');
            return await rdvHandlers.handleScheduleModal(interaction, supabase, appointmentId);
        }

        // Evenement create
        if (customId === 'evenement_create') {
            interaction.supabase = supabase;
            return await evenementCommand.handleModalSubmit(interaction);
        }

    } catch (error) {
        if (error.code === 10062) return;
        await handleInteractionError(error, interaction, `modal:${customId}`);
    }
}

/**
 * Gestion des select menus
 */
async function handleSelectMenuInteraction(interaction, supabase) {
    const customId = interaction.customId;

    try {
        // Facture select menus
        if (customId === 'facture_add_care' || customId === 'facture_select_quantity') {
            return await factureCommand.handleInteraction(interaction);
        }

    } catch (error) {
        if (error.code === 10062) return;
        await handleInteractionError(error, interaction, `selectmenu:${customId}`);
    }
}
