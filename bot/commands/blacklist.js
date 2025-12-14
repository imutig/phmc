const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('blacklist')
        .setDescription('Gère la liste noire des candidats')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Ajoute un utilisateur à la blacklist')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('L\'utilisateur à blacklister')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('raison')
                        .setDescription('Raison du bannissement')
                        .setRequired(true)
                )
                .addBooleanOption(option =>
                    option.setName('bloquer_dm')
                        .setDescription('Bloquer également les DMs (défaut: oui)')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Retire un utilisateur de la blacklist')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('L\'utilisateur à retirer')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('Liste les utilisateurs blacklistés')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('check')
                .setDescription('Vérifie si un utilisateur est blacklisté')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('L\'utilisateur à vérifier')
                        .setRequired(true)
                )
        ),

    async execute(interaction) {
        const supabase = interaction.supabase;
        const subcommand = interaction.options.getSubcommand();

        await interaction.deferReply({ flags: 64 });

        // === ADD ===
        if (subcommand === 'add') {
            const user = interaction.options.getUser('user');
            const reason = interaction.options.getString('raison');
            const blockDm = interaction.options.getBoolean('bloquer_dm') ?? true;

            // Vérifier si déjà blacklisté
            const { data: existing } = await supabase
                .from('blacklist')
                .select('id')
                .eq('discord_id', user.id)
                .single();

            if (existing) {
                return interaction.editReply(`❌ **${user.username}** est déjà dans la blacklist.`);
            }

            // Ajouter à la blacklist
            const { error } = await supabase
                .from('blacklist')
                .insert({
                    discord_id: user.id,
                    reason,
                    block_dm: blockDm,
                    banned_by_discord_id: interaction.user.id,
                    banned_by_name: interaction.user.username
                });

            if (error) {
                console.error('Erreur ajout blacklist:', error);
                return interaction.editReply('❌ Erreur lors de l\'ajout à la blacklist.');
            }

            const embed = new EmbedBuilder()
                .setColor(0xEF4444)
                .setTitle('🚫 Utilisateur Blacklisté')
                .addFields(
                    { name: 'Utilisateur', value: `${user.username} (<@${user.id}>)`, inline: true },
                    { name: 'Par', value: interaction.user.username, inline: true },
                    { name: 'Raison', value: reason },
                    { name: 'DMs bloqués', value: blockDm ? 'Oui' : 'Non', inline: true }
                )
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        }

        // === REMOVE ===
        if (subcommand === 'remove') {
            const user = interaction.options.getUser('user');

            const { error, count } = await supabase
                .from('blacklist')
                .delete()
                .eq('discord_id', user.id);

            if (error) {
                return interaction.editReply('❌ Erreur lors de la suppression.');
            }

            return interaction.editReply(`✅ **${user.username}** a été retiré de la blacklist.`);
        }

        // === LIST ===
        if (subcommand === 'list') {
            const { data: blacklisted, error } = await supabase
                .from('blacklist')
                .select('*')
                .order('banned_at', { ascending: false });

            if (error || !blacklisted || blacklisted.length === 0) {
                return interaction.editReply('📭 Aucun utilisateur dans la blacklist.');
            }

            const embed = new EmbedBuilder()
                .setColor(0xEF4444)
                .setTitle('🚫 Blacklist')
                .setDescription(blacklisted.map(b =>
                    `• <@${b.discord_id}> - ${b.reason} ${b.block_dm ? '(DMs bloqués)' : ''}`
                ).join('\n'))
                .setFooter({ text: `${blacklisted.length} utilisateur(s) blacklisté(s)` })
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        }

        // === CHECK ===
        if (subcommand === 'check') {
            const user = interaction.options.getUser('user');

            const { data: blacklisted } = await supabase
                .from('blacklist')
                .select('*')
                .eq('discord_id', user.id)
                .single();

            if (!blacklisted) {
                return interaction.editReply(`✅ **${user.username}** n'est pas dans la blacklist.`);
            }

            const embed = new EmbedBuilder()
                .setColor(0xEF4444)
                .setTitle('🚫 Utilisateur Blacklisté')
                .addFields(
                    { name: 'Utilisateur', value: `${user.username}`, inline: true },
                    { name: 'Raison', value: blacklisted.reason || 'Non spécifiée' },
                    { name: 'Blacklisté par', value: blacklisted.banned_by_name || 'Inconnu', inline: true },
                    { name: 'Date', value: new Date(blacklisted.banned_at).toLocaleDateString('fr-FR'), inline: true },
                    { name: 'DMs bloqués', value: blacklisted.block_dm ? 'Oui' : 'Non', inline: true }
                )
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        }
    }
};
