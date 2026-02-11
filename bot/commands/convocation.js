const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    PermissionFlagsBits
} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('convocation')
        .setDescription('Convoquer un membre du personnel')
        .addUserOption(option =>
            option.setName('membre')
                .setDescription('Membre à convoquer')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('date')
                .setDescription('Date de la convocation (ex: 20/12/2024)')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('heure')
                .setDescription('Heure de la convocation (ex: 20h00)')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('lieu')
                .setDescription('Lieu de la convocation')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('motif')
                .setDescription('Motif de la convocation (optionnel)')
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('membre');
        const date = interaction.options.getString('date');
        const heure = interaction.options.getString('heure');
        const lieu = interaction.options.getString('lieu');
        const motif = interaction.options.getString('motif') || 'Non spécifié';
        const convocateur = interaction.member;

        await interaction.deferReply();

        // Créer l'embed de convocation
        const embed = new EmbedBuilder()
            .setColor(0xDC2626) // Rouge
            .setTitle('⚠️ CONVOCATION OFFICIELLE')
            .setDescription(`<@${targetUser.id}>, vous êtes convoqué(e) par la Direction.`)
            .addFields(
                { name: '📅 Date', value: date, inline: true },
                { name: '🕐 Heure', value: heure, inline: true },
                { name: '📍 Lieu', value: lieu, inline: true },
                { name: '📋 Motif', value: motif, inline: false },
                { name: '\u200B', value: '**Votre présence est obligatoire.** En cas d\'empêchement majeur, merci d\'en informer la Direction dans les plus brefs délais.', inline: false }
            )
            .setFooter({ text: `Convocation émise par ${convocateur.nickname || convocateur.user.username}` })
            .setTimestamp();

        // Boutons de réponse
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`convocation_confirm_${targetUser.id}_${Date.now()}`)
                    .setLabel('✅ Je confirme ma présence')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`convocation_absent_${targetUser.id}_${Date.now()}`)
                    .setLabel('❌ Signaler une absence')
                    .setStyle(ButtonStyle.Danger)
            );

        // Mentionner l'utilisateur et envoyer
        await interaction.editReply({
            content: `<@${targetUser.id}>`,
            embeds: [embed],
            components: [buttons]
        });
    }
};
