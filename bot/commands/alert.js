const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('alert')
        .setDescription('Recevez une mention au prochain message du candidat')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async execute(interaction) {
        const supabase = interaction.supabase;
        const channelId = interaction.channelId;

        await interaction.deferReply({ flags: 64 });

        // Trouver la candidature liée à ce salon
        const { data: application, error } = await supabase
            .from('applications')
            .select('id, first_name, last_name, alert_user_id')
            .eq('discord_channel_id', channelId)
            .single();

        if (error || !application) {
            return interaction.editReply('❌ Ce salon n\'est pas lié à une candidature.');
        }

        // Toggle l'alerte
        if (application.alert_user_id === interaction.user.id) {
            // Désactiver l'alerte
            await supabase
                .from('applications')
                .update({ alert_user_id: null })
                .eq('id', application.id);

            return interaction.editReply('🔕 Alerte désactivée. Vous ne serez plus mentionné au prochain message.');
        } else {
            // Activer l'alerte
            await supabase
                .from('applications')
                .update({ alert_user_id: interaction.user.id })
                .eq('id', application.id);

            return interaction.editReply(`🔔 Alerte activée ! Vous serez mentionné au prochain message de **${application.first_name} ${application.last_name}**.`);
        }
    }
};
