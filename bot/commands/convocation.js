const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('convocation')
        .setDescription('Convoquer un patient ou un membre du personnel')
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Type de convocation')
                .setRequired(true)
                .addChoices(
                    { name: 'Membre du personnel', value: 'staff' },
                    { name: 'Patient', value: 'patient' }
                )
        )
        .addUserOption(option =>
            option.setName('membre')
                .setDescription('Personne à convoquer')
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
        ),

    async execute(interaction) {
        const supabase = interaction.supabase;

        const isMedicalRole = await hasMedicalRole(interaction, supabase);
        if (!isMedicalRole) {
            return interaction.reply({
                content: '❌ Cette commande est réservée au personnel médical.',
                flags: 64
            });
        }

        const convocationType = interaction.options.getString('type');
        const targetUser = interaction.options.getUser('membre');
        const date = interaction.options.getString('date');
        const heure = interaction.options.getString('heure');
        const lieu = interaction.options.getString('lieu');
        const motif = interaction.options.getString('motif') || 'Non spécifié';
        const convocateur = interaction.member;
        const typeLabel = convocationType === 'patient' ? 'Patient' : 'Membre du personnel';

        await interaction.deferReply();

        // Créer l'embed de convocation
        const embed = new EmbedBuilder()
            .setColor(0xDC2626) // Rouge
            .setTitle('⚠️ CONVOCATION OFFICIELLE')
            .setDescription(`<@${targetUser.id}>, vous êtes convoqué(e) par le personnel médical.`)
            .addFields(
                { name: '👤 Type', value: typeLabel, inline: true },
                { name: '📅 Date', value: date, inline: true },
                { name: '🕐 Heure', value: heure, inline: true },
                { name: '📍 Lieu', value: lieu, inline: true },
                { name: '📋 Motif', value: motif, inline: false },
                { name: '\u200B', value: '**Votre présence est obligatoire.** En cas d\'empêchement majeur, merci d\'en informer le personnel médical dans les plus brefs délais.', inline: false }
            )
            .setFooter({ text: `Convocation émise par ${convocateur.nickname || convocateur.user.username}` })
            .setTimestamp();

        // Boutons de réponse
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`convocation_confirm_${targetUser.id}_${interaction.user.id}_${Date.now()}`)
                    .setLabel('✅ Je confirme ma présence')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`convocation_absent_${targetUser.id}_${interaction.user.id}_${Date.now()}`)
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

async function hasMedicalRole(interaction, supabase) {
    try {
        const { data: roleConfigs, error } = await supabase
            .from('discord_roles')
            .select('role_type, discord_role_id')
            .in('role_type', ['direction', 'chirurgien', 'medecin', 'infirmier', 'ambulancier']);

        if (error || !roleConfigs || roleConfigs.length === 0) {
            return false;
        }

        const allowedRoleIds = roleConfigs
            .map(role => role.discord_role_id)
            .filter(Boolean);

        if (allowedRoleIds.length === 0) {
            return false;
        }

        return interaction.member.roles.cache.some(role => allowedRoleIds.includes(role.id));
    } catch {
        return false;
    }
}
