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
        .setDescription('Voir vos services et statistiques de la semaine'),

    async execute(interaction) {
        try {
            const supabase = interaction.supabase;
            await handleViewServices(interaction, supabase);
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
            new TextDisplayBuilder().setContent(`📭 *Aucun service enregistré cette semaine.*\n\nUtilisez le bouton de prise de service sur l'intranet.`)
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
                new TextDisplayBuilder().setContent(`• **${dateStr}** | ${timeStr} | $${(service.salary_earned || 0).toLocaleString()}`)
            );
        }

        if (services.length > 5) {
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`-# ... et ${services.length - 5} autres services`)
            );
        }
    }

    // Bouton actualiser
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(false));
    const actionRow = new ActionRowBuilder().addComponents(
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

function getISOWeek(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}
