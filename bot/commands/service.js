const {
    SlashCommandBuilder,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    ButtonBuilder,
    ActionRowBuilder,
    MessageFlags,
    ButtonStyle
} = require('discord.js');

const GRADE_SALARIES = {
    direction: { perSlot: 1100, maxWeekly: 150000 },
    chirurgien: { perSlot: 1000, maxWeekly: 120000 },
    medecin: { perSlot: 900, maxWeekly: 100000 },
    infirmier: { perSlot: 700, maxWeekly: 85000 },
    ambulancier: { perSlot: 625, maxWeekly: 80000 }
};

const GRADE_ORDER = ['direction', 'chirurgien', 'medecin', 'infirmier', 'ambulancier'];

const GRADE_DISPLAY = {
    direction: { name: 'Direction', emoji: '👑', color: 0xDC2626 },
    chirurgien: { name: 'Chirurgien', emoji: '🔬', color: 0xA855F7 },
    medecin: { name: 'Médecin', emoji: '⚕️', color: 0x3B82F6 },
    infirmier: { name: 'Infirmier', emoji: '💉', color: 0x22C55E },
    ambulancier: { name: 'Ambulancier', emoji: '🚑', color: 0xF97316 }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('service')
        .setDescription('Gestion de vos services EMS')
        .addSubcommand(subcommand =>
            subcommand
                .setName('ajouter')
                .setDescription('Enregistrer un nouveau service')
                .addStringOption(option =>
                    option.setName('debut')
                        .setDescription('Heure de début (format: HH:MM)')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('fin')
                        .setDescription('Heure de fin (format: HH:MM)')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('date')
                        .setDescription('Date du service (format: JJ/MM/AAAA, défaut: aujourd\'hui)')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('voir')
                .setDescription('Voir vos services et statistiques de la semaine')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('supprimer')
                .setDescription('Supprimer un service')
                .addStringOption(option =>
                    option.setName('id')
                        .setDescription('ID du service à supprimer')
                        .setRequired(true)
                )
        ),

    async execute(interaction) {
        try {
            const supabase = interaction.supabase;
            const subcommand = interaction.options.getSubcommand();

            if (subcommand === 'ajouter') {
                await handleAddService(interaction, supabase);
            } else if (subcommand === 'voir') {
                await handleViewServices(interaction, supabase);
            } else if (subcommand === 'supprimer') {
                await handleDeleteService(interaction, supabase);
            }
        } catch (error) {
            console.error('Erreur commande service:', error);
            if (interaction.replied || interaction.deferred) {
                await interaction.editReply({ content: '❌ Une erreur est survenue: ' + error.message });
            } else {
                await interaction.reply({ content: '❌ Une erreur est survenue: ' + error.message, flags: 64 });
            }
        }
    }
};

async function handleAddService(interaction, supabase) {
    await interaction.deferReply({ flags: 64 });

    const debutStr = interaction.options.getString('debut');
    const finStr = interaction.options.getString('fin');
    const dateStr = interaction.options.getString('date');

    // Parser les heures
    const debutMatch = debutStr.match(/^(\d{1,2}):(\d{2})$/);
    const finMatch = finStr.match(/^(\d{1,2}):(\d{2})$/);

    if (!debutMatch || !finMatch) {
        return interaction.editReply({ content: '❌ Format d\'heure invalide. Utilisez HH:MM (ex: 14:30)' });
    }

    const debutHour = parseInt(debutMatch[1]);
    const debutMin = parseInt(debutMatch[2]);
    const finHour = parseInt(finMatch[1]);
    const finMin = parseInt(finMatch[2]);

    // Valider les minutes (par tranche de 15)
    if (debutMin % 15 !== 0 || finMin % 15 !== 0) {
        return interaction.editReply({ content: '❌ Les minutes doivent être sur des tranches de 15 (:00, :15, :30, :45)' });
    }

    // Parser la date
    let serviceDate = new Date();
    if (dateStr) {
        const dateMatch = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (dateMatch) {
            serviceDate = new Date(dateMatch[3], dateMatch[2] - 1, dateMatch[1]);
        } else {
            return interaction.editReply({ content: '❌ Format de date invalide. Utilisez JJ/MM/AAAA' });
        }
    }

    // Créer les dates complètes
    const startTime = new Date(serviceDate);
    startTime.setHours(debutHour, debutMin, 0, 0);

    const endTime = new Date(serviceDate);
    endTime.setHours(finHour, finMin, 0, 0);

    // Si fin avant début, c'est le lendemain
    if (endTime <= startTime) {
        endTime.setDate(endTime.getDate() + 1);
    }

    // Calculer la durée
    const durationMs = endTime.getTime() - startTime.getTime();
    const durationMinutes = Math.floor(durationMs / (1000 * 60));

    if (durationMinutes < 15) {
        return interaction.editReply({ content: '❌ Service minimum de 15 minutes' });
    }

    // Trouver le grade de l'utilisateur
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
        return interaction.editReply({ content: '❌ Aucun grade EMS trouvé. Contactez la direction.' });
    }

    // Calcul salaire
    const slotsCount = Math.floor(durationMinutes / 15);
    const salaryInfo = GRADE_SALARIES[userGrade];
    const salaryEarned = slotsCount * salaryInfo.perSlot;

    // Semaine ISO
    const week = getISOWeek(startTime);
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
        console.error('Erreur service:', error);
        return interaction.editReply({ content: '❌ Erreur lors de l\'enregistrement: ' + error.message });
    }

    const gradeInfo = GRADE_DISPLAY[userGrade];
    const formatHours = (mins) => {
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return m > 0 ? `${h}h${m}m` : `${h}h`;
    };

    // Container Components V2
    const container = new ContainerBuilder()
        .setAccentColor(0x22C55E)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ✅ Service Enregistré`))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`📅 **Date:** ${startTime.toLocaleDateString('fr-FR')} • ⏰ **Horaires:** ${debutStr} → ${finStr}`))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`⏱️ **Durée:** ${formatHours(durationMinutes)} • ${gradeInfo.emoji} **Grade:** ${gradeInfo.name}`))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`💰 **Salaire:** $${salaryEarned.toLocaleString()} • 📋 **ID:** \`${data?.id?.substring(0, 8) || 'N/A'}\``))
        .addSeparatorComponents(new SeparatorBuilder().setDivider(false));

    const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('service_view_week')
            .setLabel('Voir mes services')
            .setEmoji('📊')
            .setStyle(ButtonStyle.Primary)
    );
    container.addActionRowComponents(actionRow);

    await interaction.editReply({
        components: [container],
        flags: MessageFlags.IsComponentsV2
    });
}

async function handleViewServices(interaction, supabase) {
    await interaction.deferReply({ flags: 64 });

    const now = new Date();
    const week = getISOWeek(now);
    const year = now.getFullYear();

    // Récupérer les services de la semaine
    const { data: services, error } = await supabase
        .from('services')
        .select('*')
        .eq('user_discord_id', interaction.user.id)
        .eq('week_number', week)
        .eq('year', year)
        .not('end_time', 'is', null)
        .order('start_time', { ascending: true });

    if (error) {
        return interaction.editReply({ content: '❌ Erreur: ' + error.message });
    }

    // Trouver le grade
    const { data: roleConfigs } = await supabase
        .from('discord_roles')
        .select('role_type, discord_role_id');

    let userGrade = 'ambulancier';
    for (const grade of GRADE_ORDER) {
        const config = roleConfigs?.find(r => r.role_type === grade);
        if (config && interaction.member.roles.cache.has(config.discord_role_id)) {
            userGrade = grade;
            break;
        }
    }

    const gradeInfo = GRADE_DISPLAY[userGrade];
    const salaryInfo = GRADE_SALARIES[userGrade];

    // Calculs
    const totalMinutes = services?.reduce((sum, s) => sum + (s.duration_minutes || 0), 0) || 0;
    const totalSalary = services?.reduce((sum, s) => sum + (s.salary_earned || 0), 0) || 0;
    const remainingSalary = Math.max(0, salaryInfo.maxWeekly - totalSalary);

    const formatHours = (mins) => {
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return m > 0 ? `${h}h${m}m` : `${h}h`;
    };

    // Container Components V2
    const container = new ContainerBuilder()
        .setAccentColor(gradeInfo.color)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# 📊 Mes Services - Semaine ${week}`))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${gradeInfo.emoji} **Grade:** ${gradeInfo.name} • 💵 **Salaire/15min:** $${salaryInfo.perSlot.toLocaleString()}`))
        .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## 📈 Récapitulatif`))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`⏱️ **Heures:** ${formatHours(totalMinutes)} • 💰 **Salaire:** $${totalSalary.toLocaleString()} • 📊 **Reste:** $${remainingSalary.toLocaleString()}`));

    // Liste des services
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    if (!services || services.length === 0) {
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`📭 *Aucun service enregistré cette semaine.*\n\nUtilisez \`/service ajouter\` pour enregistrer un service.`)
        );
    } else {
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## 📋 Détail (${services.length} services)`));

        const displayServices = services.slice(-5);
        for (const service of displayServices) {
            const start = new Date(service.start_time);
            const end = new Date(service.end_time);
            const dateStr = start.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
            const timeStr = `${start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} → ${end.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;

            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`• **${dateStr}** | ${timeStr} | $${(service.salary_earned || 0).toLocaleString()} | \`${service.id?.substring(0, 6) || 'N/A'}\``)
            );
        }

        if (services.length > 5) {
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`-# ... et ${services.length - 5} autres services`)
            );
        }
    }

    // Boutons
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(false));
    const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('service_add_quick')
            .setLabel('Ajouter un service')
            .setEmoji('➕')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('service_refresh')
            .setLabel('Actualiser')
            .setEmoji('🔄')
            .setStyle(ButtonStyle.Secondary)
    );
    container.addActionRowComponents(actionRow);

    await interaction.editReply({
        components: [container],
        flags: MessageFlags.IsComponentsV2
    });
}

async function handleDeleteService(interaction, supabase) {
    await interaction.deferReply({ flags: 64 });

    const serviceId = interaction.options.getString('id');

    // Vérifier que le service appartient à l'utilisateur
    const { data: service } = await supabase
        .from('services')
        .select('*')
        .or(`id.eq.${serviceId},id.ilike.${serviceId}%`)
        .single();

    if (!service) {
        return interaction.editReply({ content: '❌ Service introuvable.' });
    }

    if (service.user_discord_id !== interaction.user.id) {
        // Vérifier si admin
        const { data: adminConfig } = await supabase
            .from('config')
            .select('value')
            .eq('key', 'admin_role_id')
            .single();

        const adminRoleId = adminConfig?.value ? JSON.parse(adminConfig.value) : null;
        const isAdmin = adminRoleId && interaction.member.roles.cache.has(adminRoleId);

        if (!isAdmin) {
            return interaction.editReply({ content: '❌ Vous ne pouvez supprimer que vos propres services.' });
        }
    }

    const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', service.id);

    if (error) {
        return interaction.editReply({ content: '❌ Erreur: ' + error.message });
    }

    // Container Components V2
    const container = new ContainerBuilder()
        .setAccentColor(0xEF4444)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# 🗑️ Service Supprimé`))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`Le service du **${new Date(service.start_time).toLocaleDateString('fr-FR')}** a été supprimé.`))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Salaire annulé: $${(service.salary_earned || 0).toLocaleString()}`));

    await interaction.editReply({
        components: [container],
        flags: MessageFlags.IsComponentsV2
    });
}

function getISOWeek(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}
