const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('snippet')
        .setDescription('Gère les snippets de réponses rapides')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Crée un nouveau snippet')
                .addStringOption(option =>
                    option.setName('nom')
                        .setDescription('Nom du snippet (ex: bienvenue, refus, etc.)')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('contenu')
                        .setDescription('Contenu du message')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('send')
                .setDescription('Envoie un snippet au candidat')
                .addStringOption(option =>
                    option.setName('nom')
                        .setDescription('Nom du snippet à envoyer')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('Liste tous les snippets disponibles')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('delete')
                .setDescription('Supprime un snippet')
                .addStringOption(option =>
                    option.setName('nom')
                        .setDescription('Nom du snippet à supprimer')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
        ),

    async autocomplete(interaction) {
        const supabase = interaction.supabase;
        const focusedValue = interaction.options.getFocused().toLowerCase();

        const { data: snippets } = await supabase
            .from('snippets')
            .select('name')
            .ilike('name', `%${focusedValue}%`)
            .limit(25);

        const choices = (snippets || []).map(s => ({
            name: s.name,
            value: s.name
        }));

        await interaction.respond(choices);
    },

    async execute(interaction) {
        const supabase = interaction.supabase;
        const subcommand = interaction.options.getSubcommand();

        await interaction.deferReply({ flags: 64 });

        // === CREATE ===
        if (subcommand === 'create') {
            const name = interaction.options.getString('nom').toLowerCase().replace(/\s+/g, '_');
            const content = interaction.options.getString('contenu');

            // Vérifier si le snippet existe déjà
            const { data: existing } = await supabase
                .from('snippets')
                .select('id')
                .eq('name', name)
                .single();

            if (existing) {
                return interaction.editReply('❌ Un snippet avec ce nom existe déjà.');
            }

            // Créer le snippet
            const { error } = await supabase
                .from('snippets')
                .insert({
                    name,
                    content,
                    created_by: interaction.user.id,
                    created_by_name: interaction.user.username
                });

            if (error) {
                console.error('Erreur création snippet:', error);
                return interaction.editReply('❌ Erreur lors de la création du snippet.');
            }

            return interaction.editReply(`✅ Snippet **${name}** créé avec succès !`);
        }

        // === LIST ===
        if (subcommand === 'list') {
            const { data: snippets, error } = await supabase
                .from('snippets')
                .select('*')
                .order('name');

            if (error || !snippets || snippets.length === 0) {
                return interaction.editReply('📭 Aucun snippet disponible. Créez-en un avec `/snippet create`.');
            }

            const embed = new EmbedBuilder()
                .setColor(0x3B82F6)
                .setTitle('📝 Snippets Disponibles')
                .setDescription(snippets.map(s =>
                    `**${s.name}** - ${s.content.substring(0, 50)}${s.content.length > 50 ? '...' : ''}`
                ).join('\n'))
                .setFooter({ text: `${snippets.length} snippet(s)` })
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        }

        // === DELETE ===
        if (subcommand === 'delete') {
            const name = interaction.options.getString('nom');

            const { error } = await supabase
                .from('snippets')
                .delete()
                .eq('name', name);

            if (error) {
                return interaction.editReply('❌ Erreur lors de la suppression.');
            }

            return interaction.editReply(`✅ Snippet **${name}** supprimé.`);
        }

        // === SEND ===
        if (subcommand === 'send') {
            const name = interaction.options.getString('nom');
            const channelId = interaction.channelId;

            // Récupérer le snippet
            const { data: snippet } = await supabase
                .from('snippets')
                .select('content')
                .eq('name', name)
                .single();

            if (!snippet) {
                return interaction.editReply(`❌ Snippet **${name}** introuvable.`);
            }

            // Trouver la candidature liée à ce salon
            const { data: application } = await supabase
                .from('applications')
                .select('*, users(discord_id, discord_username)')
                .eq('discord_channel_id', channelId)
                .single();

            if (!application || !application.users?.discord_id) {
                return interaction.editReply('❌ Ce salon n\'est pas lié à une candidature.');
            }

            try {
                // Récupérer le displayName du recruteur
                const member = await interaction.guild.members.fetch(interaction.user.id);
                const senderDisplayName = member.displayName || interaction.user.username;

                // Envoyer le DM
                const user = await interaction.client.users.fetch(application.users.discord_id);
                const dmMessage = `**[${application.service}]** ${senderDisplayName}:\n${snippet.content}`;
                await user.send({ content: dmMessage });

                // Logger le message
                await supabase.from('application_messages').insert({
                    application_id: application.id,
                    sender_discord_id: interaction.user.id,
                    sender_name: senderDisplayName,
                    content: `[Snippet: ${name}] ${snippet.content}`,
                    is_from_candidate: false
                });

                return interaction.editReply(`✅ Snippet **${name}** envoyé à **${application.first_name} ${application.last_name}**`);

            } catch (dmError) {
                console.error('Erreur envoi snippet:', dmError);
                return interaction.editReply('❌ Impossible d\'envoyer le message. Le candidat a peut-être désactivé les DMs.');
            }
        }
    }
};
