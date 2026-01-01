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

const GRADE_ORDER = ['direction', 'chirurgien', 'medecin', 'infirmier', 'ambulancier'];
const GRADE_DISPLAY = {
    direction: { name: 'Direction', emoji: '👑', color: 0xDC2626 },
    chirurgien: { name: 'Chirurgien', emoji: '🔬', color: 0xA855F7 },
    medecin: { name: 'Médecin', emoji: '⚕️', color: 0x3B82F6 },
    infirmier: { name: 'Infirmier', emoji: '💉', color: 0x22C55E },
    ambulancier: { name: 'Ambulancier', emoji: '🚑', color: 0xF97316 }
};

const GRADE_SALARIES = {
    direction: { perSlot: 1100, maxWeekly: 150000 },
    chirurgien: { perSlot: 1000, maxWeekly: 120000 },
    medecin: { perSlot: 900, maxWeekly: 100000 },
    infirmier: { perSlot: 700, maxWeekly: 85000 },
    ambulancier: { perSlot: 625, maxWeekly: 80000 }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('profil')
        .setDescription('Affiche votre profil EMS complet')
        .addUserOption(option =>
            option.setName('membre')
                .setDescription('Membre dont afficher le profil (par défaut: vous)')
                .setRequired(false)
        ),

    async execute(interaction) {
        const supabase = interaction.supabase;
        const targetUser = interaction.options.getUser('membre') || interaction.user;
        const targetMember = interaction.guild.members.cache.get(targetUser.id) ||
            await interaction.guild.members.fetch(targetUser.id).catch(() => null);

        await interaction.deferReply();

        if (!targetMember) {
            return interaction.editReply({ content: '❌ Membre introuvable.' });
        }

        // Récupérer les rôles configurés
        const { data: roleConfigs } = await supabase
            .from('discord_roles')
            .select('role_type, discord_role_id');

        // Trouver le grade de l'utilisateur
        let userGrade = null;
        for (const grade of GRADE_ORDER) {
            const config = roleConfigs?.find(r => r.role_type === grade);
            if (config && targetMember.roles.cache.has(config.discord_role_id)) {
                userGrade = grade;
                break;
            }
        }

        if (!userGrade) {
            return interaction.editReply({ content: '❌ Ce membre n\'a pas de grade EMS.' });
        }

        // Récupérer les stats de la semaine
        const now = new Date();
        const week = getISOWeek(now);
        const year = now.getFullYear();

        const { data: weekServices } = await supabase
            .from('services')
            .select('duration_minutes, salary_earned')
            .eq('user_discord_id', targetUser.id)
            .eq('week_number', week)
            .eq('year', year)
            .not('end_time', 'is', null);

        const { data: allTimeServices } = await supabase
            .from('services')
            .select('duration_minutes, salary_earned')
            .eq('user_discord_id', targetUser.id)
            .not('end_time', 'is', null);

        // Vérifier si en service
        const { data: liveService } = await supabase
            .from('services')
            .select('*')
            .eq('user_discord_id', targetUser.id)
            .is('end_time', null)
            .maybeSingle();

        // Calculs
        const weekMinutes = weekServices?.reduce((sum, s) => sum + (s.duration_minutes || 0), 0) || 0;
        const weekSalary = weekServices?.reduce((sum, s) => sum + (s.salary_earned || 0), 0) || 0;
        const totalMinutes = allTimeServices?.reduce((sum, s) => sum + (s.duration_minutes || 0), 0) || 0;
        const totalSalary = allTimeServices?.reduce((sum, s) => sum + (s.salary_earned || 0), 0) || 0;
        const serviceCount = allTimeServices?.length || 0;

        const gradeInfo = GRADE_DISPLAY[userGrade];
        const salaryInfo = GRADE_SALARIES[userGrade];
        const remainingSalary = Math.max(0, salaryInfo.maxWeekly - weekSalary);

        // Formatage
        const formatHours = (mins) => {
            const h = Math.floor(mins / 60);
            const m = mins % 60;
            return m > 0 ? `${h}h${m}m` : `${h}h`;
        };

        const statusText = liveService
            ? '<a:green_dot:1452045357914525940> En service'
            : '⚫ Hors service';

        // Construire le container Components V2
        const container = new ContainerBuilder()
            .setAccentColor(gradeInfo.color)
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`# ${gradeInfo.emoji} Profil de ${targetMember.displayName}`)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`**Grade:** ${gradeInfo.name} • **Statut:** ${statusText}`)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`**Salaire/15min:** $${salaryInfo.perSlot.toLocaleString()}`)
            )
            .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`## 📊 Stats Semaine ${week}`)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`⏱️ **Heures:** ${formatHours(weekMinutes)} • 💰 **Salaire:** $${weekSalary.toLocaleString()} • 📈 **Reste:** $${remainingSalary.toLocaleString()}`)
            )
            .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`## 🏆 Stats Globales`)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`📋 **Services:** ${serviceCount} • ⏱️ **Heures:** ${formatHours(totalMinutes)} • 💵 **Gains:** $${totalSalary.toLocaleString()}`)
            );

        // Si c'est son propre profil, ajouter des boutons
        if (targetUser.id === interaction.user.id) {
            container.addSeparatorComponents(new SeparatorBuilder().setDivider(false));
            const actionRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('profil_services')
                    .setLabel('Voir mes services')
                    .setEmoji('📋')
                    .setStyle(ButtonStyle.Primary)
            );
            container.addActionRowComponents(actionRow);
        }

        await interaction.editReply({
            components: [container],
            flags: MessageFlags.IsComponentsV2
        });
    }
};

function getISOWeek(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}
