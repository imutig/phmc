const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('delete')
        .setDescription('Supprime un message envoyé au candidat')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addIntegerOption(option =>
            option.setName('numero')
                .setDescription('Numéro du message à supprimer (ex: 1, 2, 3...)')
                .setRequired(true)
                .setMinValue(1)
        ),

    async execute(interaction) {
        const supabase = interaction.supabase;
        const channelId = interaction.channelId;
        const messageNumber = interaction.options.getInteger('numero');

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
            return interaction.editReply(`❌ Le message #${messageNumber} a déjà été supprimé.`);
        }

        // Vérifier que l'auteur est le même (ou admin)
        const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
        if (message.sender_discord_id !== interaction.user.id && !isAdmin) {
            return interaction.editReply('❌ Vous ne pouvez supprimer que vos propres messages.');
        }

        try {
            // Supprimer le DM si possible
            if (message.discord_message_id && application.users?.discord_id) {
                try {
                    const user = await interaction.client.users.fetch(application.users.discord_id);
                    const dmChannel = await user.createDM();
                    const dmMessage = await dmChannel.messages.fetch(message.discord_message_id);
                    await dmMessage.delete();
                } catch (dmError) {
                    console.error('Erreur suppression DM:', dmError.message);
                    // Continuer même si la suppression du DM échoue
                }
            }

            // Marquer comme supprimé en base (soft delete)
            await supabase
                .from('application_messages')
                .update({ is_deleted: true })
                .eq('id', message.id);

            // Logger
            await supabase.from('application_logs').insert({
                application_id: application.id,
                actor_discord_id: interaction.user.id,
                actor_name: interaction.user.username,
                action: 'message_deleted',
                details: {
                    message_number: messageNumber,
                    content_preview: message.content.substring(0, 100)
                }
            });

            await interaction.editReply(`✅ Message #${messageNumber} supprimé.`);

        } catch (error) {
            console.error('Erreur delete:', error);
            await interaction.editReply('❌ Erreur lors de la suppression.');
        }
    }
};
