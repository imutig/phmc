const { EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
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
const serviceCommand = require('../commands/service');
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

        // Gestion des select menus
        if (interaction.isStringSelectMenu()) {
            await handleSelectMenuInteraction(interaction, supabase);
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

        // Profil buttons - show /service voir inline
        if (customId === 'profil_services') {
            // Rediriger vers /service voir
            await interaction.reply({
                content: '📋 Utilisez la commande `/service voir` pour afficher vos services.',
                flags: 64
            });
            return;
        }

        // Service buttons
        if (customId === 'service_view_week') {
            await interaction.reply({
                content: '📊 Utilisez la commande `/service voir` pour voir vos services.',
                flags: 64
            });
            return;
        }

        // Modal pour ajouter un service rapidement
        if (customId === 'service_add_quick') {
            const modal = new ModalBuilder()
                .setCustomId('service_add_modal')
                .setTitle('Ajouter un service')
                .addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('debut')
                            .setLabel('Heure de début (HH:MM)')
                            .setStyle(TextInputStyle.Short)
                            .setPlaceholder('14:00')
                            .setRequired(true)
                            .setMaxLength(5)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('fin')
                            .setLabel('Heure de fin (HH:MM)')
                            .setStyle(TextInputStyle.Short)
                            .setPlaceholder('18:00')
                            .setRequired(true)
                            .setMaxLength(5)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('date')
                            .setLabel('Date (JJ/MM/AAAA, vide = aujourd\'hui)')
                            .setStyle(TextInputStyle.Short)
                            .setPlaceholder('01/01/2026')
                            .setRequired(false)
                            .setMaxLength(10)
                    )
                );

            await interaction.showModal(modal);
            return;
        }

        if (customId === 'service_refresh') {
            await interaction.reply({
                content: '🔄 Utilisez `/service voir` pour actualiser.',
                flags: 64
            });
            return;
        }

        // Equipe buttons
        if (customId === 'equipe_start_service') {
            await handleServiceStart(interaction, supabase);
            return;
        }

        if (customId === 'equipe_end_service') {
            await handleServiceEnd(interaction, supabase);
            return;
        }

        // Facture buttons
        if (customId.startsWith('facture_')) {
            await factureCommand.handleInteraction(interaction);
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

        // Service add modal
        if (customId === 'service_add_modal') {
            await handleServiceAddModal(interaction, supabase);
            return;
        }

        // Facture quantity modal
        if (customId.startsWith('facture_qty_modal:')) {
            await factureCommand.handleModal(interaction);
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

async function handleSelectMenuInteraction(interaction, supabase) {
    const customId = interaction.customId;

    try {
        // Facture select menus
        if (customId === 'facture_add_care' || customId === 'facture_select_quantity') {
            await factureCommand.handleInteraction(interaction);
            return;
        }

    } catch (error) {
        log.error(`Erreur select menu ${customId}: ${error.message}`);

        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ Une erreur est survenue.',
                    flags: 64
                });
            }
        } catch (replyError) {
            log.error(`Erreur reply select: ${replyError.message}`);
        }
    }
}

// Handler pour le modal d'ajout de service
async function handleServiceAddModal(interaction, supabase) {
    const debutStr = interaction.fields.getTextInputValue('debut');
    const finStr = interaction.fields.getTextInputValue('fin');
    const dateStr = interaction.fields.getTextInputValue('date') || '';

    // Parser les heures
    const debutMatch = debutStr.match(/^(\d{1,2}):(\d{2})$/);
    const finMatch = finStr.match(/^(\d{1,2}):(\d{2})$/);

    if (!debutMatch || !finMatch) {
        return interaction.reply({ content: '❌ Format d\'heure invalide. Utilisez HH:MM (ex: 14:30)', flags: 64 });
    }

    const debutHour = parseInt(debutMatch[1]);
    const debutMin = parseInt(debutMatch[2]);
    const finHour = parseInt(finMatch[1]);
    const finMin = parseInt(finMatch[2]);

    // Valider les minutes (par tranche de 15)
    if (debutMin % 15 !== 0 || finMin % 15 !== 0) {
        return interaction.reply({ content: '❌ Les minutes doivent être sur des tranches de 15 (:00, :15, :30, :45)', flags: 64 });
    }

    // Parser la date
    let serviceDate = new Date();
    if (dateStr) {
        const dateMatch = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (dateMatch) {
            serviceDate = new Date(dateMatch[3], dateMatch[2] - 1, dateMatch[1]);
        } else {
            return interaction.reply({ content: '❌ Format de date invalide. Utilisez JJ/MM/AAAA', flags: 64 });
        }
    }

    // Créer les dates complètes
    const startTime = new Date(serviceDate);
    startTime.setHours(debutHour, debutMin, 0, 0);

    const endTime = new Date(serviceDate);
    endTime.setHours(finHour, finMin, 0, 0);

    if (endTime <= startTime) {
        endTime.setDate(endTime.getDate() + 1);
    }

    const durationMs = endTime.getTime() - startTime.getTime();
    const durationMinutes = Math.floor(durationMs / (1000 * 60));

    if (durationMinutes < 15) {
        return interaction.reply({ content: '❌ Service minimum de 15 minutes', flags: 64 });
    }

    // Grades et salaires
    const GRADE_ORDER = ['direction', 'chirurgien', 'medecin', 'infirmier', 'ambulancier'];
    const GRADE_SALARIES = {
        direction: { perSlot: 1100, maxWeekly: 150000 },
        chirurgien: { perSlot: 1000, maxWeekly: 120000 },
        medecin: { perSlot: 900, maxWeekly: 100000 },
        infirmier: { perSlot: 700, maxWeekly: 85000 },
        ambulancier: { perSlot: 625, maxWeekly: 80000 }
    };

    // Trouver le grade
    const { data: roleConfigs } = await supabase
        .from('discord_roles')
        .select('role_type, discord_role_id');

    let userGrade = null;
    for (const grade of GRADE_ORDER) {
        const config = roleConfigs?.find(r => r.role_type === grade);
        if (config && interaction.member.roles.cache.has(config.discord_role_id)) {
            userGrade = grade;
            break;
        }
    }

    if (!userGrade) {
        return interaction.reply({ content: '❌ Aucun grade EMS trouvé. Contactez la direction.', flags: 64 });
    }

    const slotsCount = Math.floor(durationMinutes / 15);
    const salaryInfo = GRADE_SALARIES[userGrade];
    const salaryEarned = slotsCount * salaryInfo.perSlot;

    // Semaine ISO
    const d = new Date(Date.UTC(startTime.getFullYear(), startTime.getMonth(), startTime.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    const year = startTime.getFullYear();

    // Insérer en base
    const { data, error } = await supabase
        .from('services')
        .insert({
            user_discord_id: interaction.user.id,
            user_name: interaction.member.displayName || interaction.user.username,
            grade_name: userGrade,
            start_time: startTime.toISOString(),
            end_time: endTime.toISOString(),
            duration_minutes: durationMinutes,
            slots_count: slotsCount,
            salary_earned: salaryEarned,
            week_number: week,
            year: year,
            service_date: startTime.toISOString().split('T')[0]
        })
        .select()
        .single();

    if (error) {
        log.error('Erreur insertion service:', error);
        return interaction.reply({ content: '❌ Erreur: ' + error.message, flags: 64 });
    }

    const formatHours = (mins) => {
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return m > 0 ? `${h}h${m}m` : `${h}h`;
    };

    await interaction.reply({
        content: `✅ **Service enregistré !**\n📅 ${startTime.toLocaleDateString('fr-FR')} • ⏰ ${debutStr} → ${finStr} • ⏱️ ${formatHours(durationMinutes)} • 💰 $${salaryEarned.toLocaleString()}`,
        flags: 64
    });
}

// Handlers pour les boutons /equipe
async function handleServiceStart(interaction, supabase) {
    // Vérifier si déjà en service
    const { data: existing } = await supabase
        .from('services')
        .select('id')
        .eq('user_discord_id', interaction.user.id)
        .is('end_time', null)
        .maybeSingle();

    if (existing) {
        return interaction.reply({ content: '❌ Vous avez déjà un service en cours.', flags: 64 });
    }

    // Trouver le grade
    const GRADE_ORDER = ['direction', 'chirurgien', 'medecin', 'infirmier', 'ambulancier'];
    const { data: roleConfigs } = await supabase
        .from('discord_roles')
        .select('role_type, discord_role_id');

    let userGrade = 'ambulancier'; // Fallback
    for (const grade of GRADE_ORDER) {
        const config = roleConfigs?.find(r => r.role_type === grade);
        if (config && interaction.member.roles.cache.has(config.discord_role_id)) {
            userGrade = grade;
            break;
        }
    }

    const now = new Date();
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    const year = now.getFullYear();

    const { error } = await supabase
        .from('services')
        .insert({
            user_discord_id: interaction.user.id,
            user_name: interaction.member.displayName || interaction.user.username,
            user_avatar_url: interaction.user.displayAvatarURL(),
            grade_name: userGrade,
            start_time: now.toISOString(),
            end_time: null,
            duration_minutes: 0,
            slots_count: null,
            salary_earned: null,
            week_number: week,
            year: year,
            service_date: now.toISOString().split('T')[0]
        });

    if (error) {
        return interaction.reply({ content: '❌ Erreur: ' + error.message, flags: 64 });
    }

    await interaction.reply({ content: '✅ **Service pris !** Bon courage.', flags: 64 });
}

async function handleServiceEnd(interaction, supabase) {
    // Récupérer le service en cours
    const { data: service } = await supabase
        .from('services')
        .select('*')
        .eq('user_discord_id', interaction.user.id)
        .is('end_time', null)
        .maybeSingle();

    if (!service) {
        return interaction.reply({ content: '❌ Vous n\'êtes pas en service.', flags: 64 });
    }

    const now = new Date();
    const startTime = new Date(service.start_time);

    // Logique d'arrondi comme sur le dashboard
    const roundUpTo15Min = (date) => {
        const minutes = date.getMinutes();
        const remainder = minutes % 15;
        if (remainder === 0 && date.getSeconds() === 0 && date.getMilliseconds() === 0) return date;
        const rounded = new Date(date);
        rounded.setMinutes(minutes + (15 - remainder));
        rounded.setSeconds(0);
        rounded.setMilliseconds(0);
        return rounded;
    };

    const roundDownTo15Min = (date) => {
        const minutes = date.getMinutes();
        const remainder = minutes % 15;
        const rounded = new Date(date);
        rounded.setMinutes(minutes - remainder);
        rounded.setSeconds(0);
        rounded.setMilliseconds(0);
        return rounded;
    };

    const roundedStart = roundUpTo15Min(startTime);
    const roundedEnd = roundDownTo15Min(now);
    const validDurationMs = roundedEnd.getTime() - roundedStart.getTime();

    if (validDurationMs < 15 * 60 * 1000) {
        // Supprimer si < 15 min
        await supabase.from('services').delete().eq('id', service.id);
        return interaction.reply({ content: '🗑️ **Service annulé** (durée insuffisante < 15min).', flags: 64 });
    }

    const durationMinutes = Math.floor(validDurationMs / (1000 * 60));
    const slotsCount = Math.floor(durationMinutes / 15);

    const GRADE_SALARIES = {
        direction: 1100,
        chirurgien: 1000,
        medecin: 900,
        infirmier: 700,
        ambulancier: 625
    };

    const salaryPer15min = GRADE_SALARIES[service.grade_name] || 625;
    const salaryEarned = slotsCount * salaryPer15min;

    const { error } = await supabase
        .from('services')
        .update({
            start_time: roundedStart.toISOString(),
            end_time: roundedEnd.toISOString(),
            duration_minutes: durationMinutes,
            slots_count: slotsCount,
            salary_earned: salaryEarned,
            updated_at: new Date().toISOString()
        })
        .eq('id', service.id);

    if (error) {
        return interaction.reply({ content: '❌ Erreur: ' + error.message, flags: 64 });
    }

    const formatHours = (mins) => {
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return m > 0 ? `${h}h${m}m` : `${h}h`;
    };

    await interaction.reply({
        content: `✅ **Service terminé !**\n⏱️ ${formatHours(durationMinutes)} • 💰 $${salaryEarned.toLocaleString()}`,
        flags: 64
    });
}
