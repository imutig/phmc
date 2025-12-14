const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('candidatures')
        .setDescription('Gestion des candidatures')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addSubcommand(subcommand =>
            subcommand
                .setName('liste')
                .setDescription('Liste les candidatures en attente')
                .addStringOption(option =>
                    option.setName('service')
                        .setDescription('Filtrer par service')
                        .setRequired(false)
                        .addChoices(
                            { name: 'LSPD', value: 'LSPD' },
                            { name: 'BCSO', value: 'BCSO' }
                        )
                )
                .addStringOption(option =>
                    option.setName('statut')
                        .setDescription('Filtrer par statut')
                        .setRequired(false)
                        .addChoices(
                            { name: 'En attente', value: 'pending' },
                            { name: 'En examen', value: 'reviewing' },
                            { name: 'Entretien planifié', value: 'interview_scheduled' },
                            { name: 'Formation', value: 'training' }
                        )
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('stats')
                .setDescription('Affiche les statistiques de recrutement')
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const supabase = interaction.supabase;

        if (subcommand === 'liste') {
            await handleList(interaction, supabase);
        } else if (subcommand === 'stats') {
            await handleStats(interaction, supabase);
        }
    }
};

async function handleList(interaction, supabase) {
    await interaction.deferReply();

    const service = interaction.options.getString('service');
    const status = interaction.options.getString('statut');

    let query = supabase
        .from('applications')
        .select('*, users(discord_username)')
        .order('created_at', { ascending: false })
        .limit(10);

    if (service) {
        query = query.eq('service', service);
    }
    if (status) {
        query = query.eq('status', status);
    } else {
        // Par défaut, exclure les terminées
        query = query.not('status', 'in', '("rejected","recruited")');
    }

    const { data: applications, error } = await query;

    if (error) {
        console.error('Erreur DB:', error);
        return interaction.editReply({ content: '❌ Erreur lors de la récupération des candidatures.' });
    }

    if (!applications || applications.length === 0) {
        return interaction.editReply({ content: '📭 Aucune candidature trouvée avec ces critères.' });
    }

    const statusLabels = {
        pending: '⏳ En attente',
        reviewing: '🔍 En examen',
        interview_scheduled: '📅 Entretien planifié',
        interview_passed: '✅ Entretien réussi',
        interview_failed: '❌ Entretien échoué',
        training: '📚 Formation',
        recruited: '🎉 Recruté',
        rejected: '🚫 Refusé'
    };

    const embed = new EmbedBuilder()
        .setColor(0x3B82F6)
        .setTitle('📋 Candidatures en cours')
        .setDescription(`*${applications.length} candidature(s) trouvée(s)*`)
        .setTimestamp()
        .setFooter({ text: 'Secrétaire Spades' });

    for (const app of applications.slice(0, 10)) {
        const statusLabel = statusLabels[app.status] || app.status;
        const serviceColor = app.service === 'LSPD' ? '🔵' : '🟡';

        embed.addFields({
            name: `${serviceColor} ${app.first_name} ${app.last_name}`,
            value: `**Statut:** ${statusLabel}\n**Discord:** ${app.users?.discord_username || 'N/A'}\n**Créée:** <t:${Math.floor(new Date(app.created_at).getTime() / 1000)}:R>`,
            inline: true
        });
    }

    await interaction.editReply({ embeds: [embed] });
}

async function handleStats(interaction, supabase) {
    await interaction.deferReply();

    // Stats globales
    const { data: allApps, error } = await supabase
        .from('applications')
        .select('service, status');

    if (error) {
        console.error('Erreur DB:', error);
        return interaction.editReply({ content: '❌ Erreur lors de la récupération des statistiques.' });
    }

    const stats = {
        total: allApps.length,
        lspd: allApps.filter(a => a.service === 'LSPD').length,
        bcso: allApps.filter(a => a.service === 'BCSO').length,
        pending: allApps.filter(a => a.status === 'pending').length,
        reviewing: allApps.filter(a => a.status === 'reviewing').length,
        recruited: allApps.filter(a => a.status === 'recruited').length,
        rejected: allApps.filter(a => a.status === 'rejected').length,
    };

    const embed = new EmbedBuilder()
        .setColor(0x10B981)
        .setTitle('📊 Statistiques de Recrutement')
        .addFields(
            { name: '📋 Total Candidatures', value: `${stats.total}`, inline: true },
            { name: '🔵 LSPD', value: `${stats.lspd}`, inline: true },
            { name: '🟡 BCSO', value: `${stats.bcso}`, inline: true },
            { name: '⏳ En attente', value: `${stats.pending}`, inline: true },
            { name: '🔍 En examen', value: `${stats.reviewing}`, inline: true },
            { name: '🎉 Recrutés', value: `${stats.recruited}`, inline: true },
            { name: '🚫 Refusés', value: `${stats.rejected}`, inline: true }
        )
        .setTimestamp()
        .setFooter({ text: 'Secrétaire Spades' });

    await interaction.editReply({ embeds: [embed] });
}
