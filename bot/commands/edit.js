const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('edit')
        .setDescription('Modifie un message envoyé au candidat')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addIntegerOption(option =>
            option.setName('numero')
                .setDescription('Numéro du message à modifier (ex: 1, 2, 3...)')
                .setRequired(true)
                .setMinValue(1)
        )
        .addStringOption(option =>
            option.setName('contenu')
                .setDescription('Le nouveau contenu du message')
                .setRequired(true)
        ),

    async execute(interaction) {
        const supabase = interaction.supabase;
        const channelId = interaction.channelId;
        const messageNumber = interaction.options.getInteger('numero');
        const newContent = interaction.options.getString('contenu');

        await interaction.deferReply({ flags: 64 });

        // Trouver la candidature liée à ce salon
        const { data: application } = await supabase
            .from('applications')
            .select('*, users(discord_id, discord_username)')
            .eq('discord_channel_id', channelId)
            .single();

        if (!application) {
            return interaction.editReply('❌ Ce salon n\'est pas lié à une candidature.');
        }

        // Trouver le message
        const { data: message, error } = await supabase
            .from('application_messages')
            .select('*')
            .eq('application_id', application.id)
            .eq('message_number', messageNumber)
            .eq('is_from_candidate', false)
            .single();

        if (error || !message) {
            return interaction.editReply(`❌ Message #${messageNumber} introuvable.`);
        }

        if (message.is_deleted) {
            return interaction.editReply(`❌ Le message #${messageNumber} a été supprimé.`);
        }

        // Vérifier que l'auteur est le même (ou admin)
        const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
        if (message.sender_discord_id !== interaction.user.id && !isAdmin) {
            return interaction.editReply('❌ Vous ne pouvez modifier que vos propres messages.');
        }

        try {
            // Modifier le DM si possible
            if (message.discord_message_id && application.users?.discord_id) {
                try {
                    const user = await interaction.client.users.fetch(application.users.discord_id);
                    const dmChannel = await user.createDM();
                    const dmMessage = await dmChannel.messages.fetch(message.discord_message_id);

                    const member = await interaction.guild.members.fetch(interaction.user.id);
                    const senderName = member.displayName || interaction.user.username;

                    await dmMessage.edit({ content: `**[${application.service}]** ${senderName}:\n${newContent}` });
                } catch (dmError) {
                    console.error('Erreur édition DM:', dmError.message);
                    // Continuer même si l'édition du DM échoue
                }
            }

            // Mettre à jour en base
            await supabase
                .from('application_messages')
                .update({
                    content: newContent,
                    edited_at: new Date().toISOString()
                })
                .eq('id', message.id);

            // Logger
            await supabase.from('application_logs').insert({
                application_id: application.id,
                actor_discord_id: interaction.user.id,
                actor_name: interaction.user.username,
                action: 'message_edited',
                details: {
                    message_number: messageNumber,
                    old_content: message.content.substring(0, 100),
                    new_content: newContent.substring(0, 100)
                }
            });

            await interaction.editReply(`✅ Message #${messageNumber} modifié.`);

        } catch (error) {
            console.error('Erreur edit:', error);
            await interaction.editReply('❌ Erreur lors de la modification.');
        }
    }
};
