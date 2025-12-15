const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

const GRADE_SALARIES = {
    direction: 1100,
    chirurgien: 1000,
    medecin: 900,
    infirmier: 700,
    ambulancier: 625
};

// Grille des grades dans l'ordre hiérarchique
const GRADE_ORDER = ['direction', 'chirurgien', 'medecin', 'infirmier', 'ambulancier'];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('service')
        .setDescription('Gestion des services EMS')
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
                .setName('liste')
                .setDescription('Voir vos services de la semaine')
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
        const supabase = interaction.supabase;
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'ajouter') {
            await handleAddService(interaction, supabase);
        } else if (subcommand === 'liste') {
            await handleListServices(interaction, supabase);
        } else if (subcommand === 'supprimer') {
            await handleDeleteService(interaction, supabase);
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
        return interaction.editReply('❌ Format d\'heure invalide. Utilisez HH:MM (ex: 14:30)');
    }

    const debutHour = parseInt(debutMatch[1]);
    const debutMin = parseInt(debutMatch[2]);
    const finHour = parseInt(finMatch[1]);
    const finMin = parseInt(finMatch[2]);

    // Valider les minutes (par tranche de 15)
    if (debutMin % 15 !== 0 || finMin % 15 !== 0) {
        return interaction.editReply('❌ Les minutes doivent être sur des tranches de 15 (:00, :15, :30, :45)');
    }

    // Parser la date
    let serviceDate = new Date();
    if (dateStr) {
        const dateMatch = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (dateMatch) {
            serviceDate = new Date(dateMatch[3], dateMatch[2] - 1, dateMatch[1]);
        } else {
            return interaction.editReply('❌ Format de date invalide. Utilisez JJ/MM/AAAA');
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
        return interaction.editReply('❌ Service minimum de 15 minutes');
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
        return interaction.editReply('❌ Aucun grade EMS trouvé. Contactez la direction.');
    }

    // Calcul salaire
    const slotsCount = Math.floor(durationMinutes / 15);
    const salaryPer15min = GRADE_SALARIES[userGrade] || 625;
    const salaryEarned = slotsCount * salaryPer15min;

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
        return interaction.editReply('❌ Erreur lors de l\'enregistrement: ' + error.message);
    }

    const embed = new EmbedBuilder()
        .setColor(0x22C55E)
        .setTitle('✅ Service Enregistré')
        .addFields(
            { name: '📅 Date', value: startTime.toLocaleDateString('fr-FR'), inline: true },
            { name: '⏰ Horaires', value: `${debutStr} → ${finStr}`, inline: true },
            { name: '⏱️ Durée', value: `${Math.floor(durationMinutes / 60)}h${durationMinutes % 60 > 0 ? (durationMinutes % 60) + 'm' : ''}`, inline: true },
            { name: '💰 Salaire', value: `$${salaryEarned.toLocaleString()}`, inline: true },
            { name: '📋 Grade', value: userGrade.charAt(0).toUpperCase() + userGrade.slice(1), inline: true }
        )
        .setFooter({ text: `ID: ${data.id.substring(0, 8)}` })
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}

async function handleListServices(interaction, supabase) {
    await interaction.deferReply({ flags: 64 });

    // Semaine courante
    const now = new Date();
    const week = getISOWeek(now);
    const year = now.getFullYear();

    const { data: services, error } = await supabase
        .from('services')
        .select('*')
        .eq('user_discord_id', interaction.user.id)
        .eq('week_number', week)
        .eq('year', year)
        .order('start_time', { ascending: true });

    if (error) {
        return interaction.editReply('❌ Erreur: ' + error.message);
    }

    if (!services || services.length === 0) {
        return interaction.editReply('📭 Aucun service enregistré cette semaine.');
    }

    // Calculs
    const totalMinutes = services.reduce((sum, s) => sum + s.duration_minutes, 0);
    const totalSalary = services.reduce((sum, s) => sum + s.salary_earned, 0);

    const embed = new EmbedBuilder()
        .setColor(0x3B82F6)
        .setTitle(`📋 Vos Services - Semaine ${week}`)
        .setDescription(services.map(s => {
            const start = new Date(s.start_time);
            const end = new Date(s.end_time);
            return `• **${start.toLocaleDateString('fr-FR')}** : ${start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} → ${end.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} ($${s.salary_earned.toLocaleString()})`;
        }).join('\n'))
        .addFields(
            { name: '⏱️ Total heures', value: `${Math.floor(totalMinutes / 60)}h${totalMinutes % 60 > 0 ? (totalMinutes % 60) + 'm' : ''}`, inline: true },
            { name: '💰 Total salaire', value: `$${totalSalary.toLocaleString()}`, inline: true }
        )
        .setFooter({ text: 'Pillbox Hill Medical Center' })
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}

async function handleDeleteService(interaction, supabase) {
    await interaction.deferReply({ flags: 64 });

    const serviceId = interaction.options.getString('id');

    // Vérifier que le service appartient à l'utilisateur
    const { data: service } = await supabase
        .from('services')
        .select('*')
        .eq('id', serviceId)
        .single();

    if (!service) {
        return interaction.editReply('❌ Service introuvable.');
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
            return interaction.editReply('❌ Vous ne pouvez supprimer que vos propres services.');
        }
    }

    const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', serviceId);

    if (error) {
        return interaction.editReply('❌ Erreur: ' + error.message);
    }

    await interaction.editReply('✅ Service supprimé.');
}

function getISOWeek(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}
