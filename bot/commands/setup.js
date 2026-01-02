const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Configure le système de recrutement')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('categorie')
                .setDescription('Configure la catégorie pour les salons de candidature EMS')
                .addChannelOption(option =>
                    option.setName('categorie')
                        .setDescription('La catégorie où créer les salons')
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildCategory)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('role')
                .setDescription('Configure un rôle')
                .addStringOption(option =>
                    option.setName('type')
                        .setDescription('Le type de rôle à configurer')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Recruteur EMS', value: 'RECRUITER' },
                            { name: 'Admin', value: 'ADMIN' },
                            { name: 'Direction (RDV Direction)', value: 'DIRECTION' },
                            { name: 'Staff Médical (Infirmier+)', value: 'MEDICAL_STAFF' }
                        )
                )
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('Le rôle à assigner')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('rdv')
                .setDescription('Configure la catégorie pour les salons de rendez-vous')
                .addChannelOption(option =>
                    option.setName('categorie')
                        .setDescription('La catégorie où créer les salons de RDV')
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildCategory)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('afficher')
                .setDescription('Affiche la configuration actuelle')
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const supabase = interaction.supabase;

        if (subcommand === 'categorie') {
            await handleCategorie(interaction, supabase);
        } else if (subcommand === 'role') {
            await handleRole(interaction, supabase);
        } else if (subcommand === 'rdv') {
            await handleRdv(interaction, supabase);
        } else if (subcommand === 'afficher') {
            await handleAfficher(interaction, supabase);
        }
    }
};

async function handleCategorie(interaction, supabase) {
    const category = interaction.options.getChannel('categorie');

    await interaction.deferReply({ flags: 64 }); // ephemeral

    const { error } = await supabase
        .from('config')
        .upsert({
            key: 'ems_category_id',
            value: JSON.stringify(category.id),
            updated_at: new Date().toISOString()
        }, { onConflict: 'key' });

    if (error) {
        console.error('Erreur config:', error);
        return interaction.editReply({ content: '❌ Erreur lors de la sauvegarde.' });
    }

    const embed = new EmbedBuilder()
        .setColor(0xDC2626) // Rouge EMS
        .setTitle('✅ Configuration Mise à Jour')
        .setDescription(`La catégorie **EMS** est maintenant: **${category.name}**`)
        .addFields({ name: 'ID', value: category.id })
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}

async function handleRdv(interaction, supabase) {
    const category = interaction.options.getChannel('categorie');

    await interaction.deferReply({ flags: 64 });

    const { error } = await supabase
        .from('config')
        .upsert({
            key: 'appointments_category_id',
            value: JSON.stringify(category.id),
            updated_at: new Date().toISOString()
        }, { onConflict: 'key' });

    if (error) {
        console.error('Erreur config:', error);
        return interaction.editReply({ content: '❌ Erreur lors de la sauvegarde.' });
    }

    const embed = new EmbedBuilder()
        .setColor(0x22C55E) // Vert médical
        .setTitle('✅ Configuration Mise à Jour')
        .setDescription(`La catégorie **Rendez-vous** est maintenant: **${category.name}**`)
        .addFields({ name: 'ID', value: category.id })
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}

async function handleCategorie(interaction, supabase) {
    const category = interaction.options.getChannel('categorie');

    await interaction.deferReply({ flags: 64 }); // ephemeral

    const { error } = await supabase
        .from('config')
        .upsert({
            key: 'ems_category_id',
            value: JSON.stringify(category.id),
            updated_at: new Date().toISOString()
        }, { onConflict: 'key' });

    if (error) {
        console.error('Erreur config:', error);
        return interaction.editReply({ content: '❌ Erreur lors de la sauvegarde.' });
    }

    const embed = new EmbedBuilder()
        .setColor(0xDC2626) // Rouge EMS
        .setTitle('✅ Configuration Mise à Jour')
        .setDescription(`La catégorie **EMS** est maintenant: **${category.name}**`)
        .addFields({ name: 'ID', value: category.id })
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}

async function handleRole(interaction, supabase) {
    const type = interaction.options.getString('type');
    const role = interaction.options.getRole('role');

    await interaction.deferReply({ flags: 64 }); // ephemeral

    const configKey = type === 'RECRUITER' ? 'ems_recruiter_role_id'
        : type === 'DIRECTION' ? 'direction_role_id'
            : type === 'MEDICAL_STAFF' ? 'medical_staff_role_id'
                : 'admin_role_id';

    const displayName = type === 'RECRUITER' ? 'Recruteur EMS'
        : type === 'DIRECTION' ? 'Direction'
            : type === 'MEDICAL_STAFF' ? 'Staff Médical'
                : 'Admin';

    const { error } = await supabase
        .from('config')
        .upsert({
            key: configKey,
            value: JSON.stringify(role.id),
            updated_at: new Date().toISOString()
        }, { onConflict: 'key' });

    if (error) {
        console.error('Erreur config:', error);
        return interaction.editReply({ content: '❌ Erreur lors de la sauvegarde.' });
    }

    const embed = new EmbedBuilder()
        .setColor(0xDC2626) // Rouge EMS
        .setTitle('✅ Rôle Configuré')
        .setDescription(`Le rôle **${displayName}** est maintenant: **${role.name}**`)
        .addFields({ name: 'ID', value: role.id })
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}

async function handleAfficher(interaction, supabase) {
    await interaction.deferReply({ flags: 64 }); // ephemeral

    const { data: configs, error } = await supabase
        .from('config')
        .select('*');

    if (error) {
        console.error('Erreur config:', error);
        return interaction.editReply({ content: '❌ Erreur lors de la récupération.' });
    }

    const configMap = {};
    for (const config of configs) {
        configMap[config.key] = config.value;
    }

    const embed = new EmbedBuilder()
        .setColor(0xDC2626) // Rouge EMS
        .setTitle('⚙️ Configuration Actuelle')
        .addFields(
            { name: '🏥 Catégorie EMS', value: configMap.ems_category_id ? `<#${JSON.parse(configMap.ems_category_id)}>` : '❌ Non configuré', inline: true },
            { name: '📅 Catégorie RDV', value: configMap.appointments_category_id ? `<#${JSON.parse(configMap.appointments_category_id)}>` : '❌ Non configuré', inline: true },
            { name: '🩺 Rôle Recruteur', value: configMap.ems_recruiter_role_id ? `<@&${JSON.parse(configMap.ems_recruiter_role_id)}>` : '❌ Non configuré', inline: true },
            { name: '🏥 Rôle Médical', value: configMap.medical_staff_role_id ? `<@&${JSON.parse(configMap.medical_staff_role_id)}>` : '❌ Non configuré', inline: true },
            { name: '👔 Rôle Direction', value: configMap.direction_role_id ? `<@&${JSON.parse(configMap.direction_role_id)}>` : '❌ Non configuré', inline: true },
            { name: '👑 Rôle Admin', value: configMap.admin_role_id ? `<@&${JSON.parse(configMap.admin_role_id)}>` : '❌ Non configuré', inline: true },
            { name: '⏱️ Cooldown', value: `${configMap.cooldown_hours || 24}h`, inline: true }
        )
        .setTimestamp()
        .setFooter({ text: 'Secrétaire Spades' });

    await interaction.editReply({ embeds: [embed] });
}
