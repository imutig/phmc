const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('message')
        .setDescription('Envoie un message au candidat via DM')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addStringOption(option =>
            option.setName('contenu')
                .setDescription('Le message à envoyer au candidat')
                .setRequired(true)
        ),

    async execute(interaction) {
        const supabase = interaction.supabase;
        const channelId = interaction.channelId;
        const messageContent = interaction.options.getString('contenu');

        await interaction.deferReply();

        // Trouver la candidature liée à ce salon
        const { data: application, error } = await supabase
            .from('applications')
            .select('*, users(discord_id, discord_username)')
            .eq('discord_channel_id', channelId)
            .single();

        if (error || !application) {
            return interaction.editReply({
                content: '❌ Ce salon n\'est pas lié à une candidature. Utilisez cette commande dans un salon de candidature.'
            });
        }

        if (!application.users?.discord_id) {
            return interaction.editReply({
                content: '❌ Impossible de trouver l\'utilisateur Discord lié à cette candidature.'
            });
        }

        try {
            // Récupérer l'utilisateur Discord
            const user = await interaction.client.users.fetch(application.users.discord_id);

            // Récupérer le membre pour avoir le displayName (nom RP)
            const member = await interaction.guild.members.fetch(interaction.user.id);
            const senderDisplayName = member.displayName || interaction.user.username;

            // Calculer le numéro de message
            const { count } = await supabase
                .from('application_messages')
                .select('*', { count: 'exact', head: true })
                .eq('application_id', application.id)
                .eq('is_from_candidate', false);

            const messageNumber = (count || 0) + 1;

            // Envoyer le message en texte simple (pas d'embed pour les communications simples)
            const dmMessage = `**[${application.service}]** ${senderDisplayName}:\n${messageContent}`;
            const sentDM = await user.send({ content: dmMessage });

            // Logger le message dans la base avec le discord_message_id
            const { data: savedMessage } = await supabase.from('application_messages').insert({
                application_id: application.id,
                sender_discord_id: interaction.user.id,
                sender_name: senderDisplayName,
                content: messageContent,
                is_from_candidate: false,
                message_number: messageNumber,
                discord_message_id: sentDM.id
            }).select('id').single();

            // Logger l'action
            await supabase.from('application_logs').insert({
                application_id: application.id,
                actor_discord_id: interaction.user.id,
                actor_name: senderDisplayName,
                action: 'message_sent',
                details: { preview: messageContent.substring(0, 100), message_number: messageNumber }
            });

            // Confirmation dans le salon avec le format: `(numéro)` **Displayname** - message
            await interaction.editReply({
                content: `\`(${messageNumber})\` **${senderDisplayName}** - ${messageContent}`
            });

        } catch (dmError) {
            console.error('Erreur envoi DM:', dmError);
            await interaction.editReply({
                content: '❌ Impossible d\'envoyer le message. Le candidat a peut-être désactivé les DMs.'
            });
        }
    }
};
