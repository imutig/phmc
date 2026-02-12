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
        const dateInput = interaction.options.getString('date');
        const heureInput = interaction.options.getString('heure');
        const lieu = interaction.options.getString('lieu');
        const motif = interaction.options.getString('motif') || 'Non spécifié';
        const convocateur = interaction.member;
        const typeLabel = convocationType === 'patient' ? 'Patient' : 'Membre du personnel';

        const parsedDateTime = parseConvocationDateTime(dateInput, heureInput);
        if (!parsedDateTime) {
            return interaction.reply({
                content: '❌ Format date/heure invalide. Utilisez `JJ/MM/AAAA` (ou `JJ/MM/AA`) et `HH:MM` (ou `HHhMM`).',
                flags: 64
            });
        }

        if (parsedDateTime.date.getTime() <= Date.now()) {
            return interaction.reply({
                content: '❌ La convocation doit être programmée dans le futur.',
                flags: 64
            });
        }

        const normalizedDate = `${parsedDateTime.day.toString().padStart(2, '0')}/${parsedDateTime.month.toString().padStart(2, '0')}/${parsedDateTime.year}`;
        const normalizedTime = `${parsedDateTime.hours.toString().padStart(2, '0')}:${parsedDateTime.minutes.toString().padStart(2, '0')}`;
        const scheduledTimestamp = parsedDateTime.date.getTime();

        await interaction.deferReply();

        // Créer l'embed de convocation
        const embed = new EmbedBuilder()
            .setColor(0xDC2626) // Rouge
            .setTitle('📅 RENDEZ-VOUS')
            .setDescription(`<@${targetUser.id}>, le personnel médical vous propose un rendez-vous.`)
            .addFields(
                { name: '👤 Type', value: typeLabel, inline: true },
                { name: '📅 Date', value: normalizedDate, inline: true },
                { name: '🕐 Heure', value: normalizedTime, inline: true },
                { name: '📍 Lieu', value: lieu, inline: true },
                { name: '📋 Motif', value: motif, inline: false },
                { name: '\u200B', value: 'Merci de confirmer votre disponibilité. En cas d\'empêchement, prévenez simplement le personnel médical afin de reprogrammer le rendez-vous.', inline: false }
            )
            .setFooter({ text: `Convocation émise par ${convocateur.nickname || convocateur.user.username}` })
            .setTimestamp();

        // Boutons de réponse
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`convocation_confirm_${targetUser.id}_${interaction.user.id}_${scheduledTimestamp}`)
                    .setLabel('✅ Je confirme ma présence')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`convocation_absent_${targetUser.id}_${interaction.user.id}_${scheduledTimestamp}`)
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

function parseConvocationDateTime(dateInput, timeInput) {
    if (!dateInput || !timeInput) {
        return null;
    }

    const cleanDate = String(dateInput).trim();
    const cleanTime = String(timeInput).trim();

    const dateMatch = cleanDate.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2}|\d{4})$/);
    if (!dateMatch) {
        return null;
    }

    const timeMatch = cleanTime.match(/^(\d{1,2})[:hH](\d{2})$/);
    if (!timeMatch) {
        return null;
    }

    const day = parseInt(dateMatch[1], 10);
    const month = parseInt(dateMatch[2], 10);
    let year = parseInt(dateMatch[3], 10);
    const hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2], 10);

    if (year < 100) {
        year += 2000;
    }

    if (month < 1 || month > 12 || day < 1 || day > 31 || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        return null;
    }

    const date = new Date(year, month - 1, day, hours, minutes, 0, 0);
    if (Number.isNaN(date.getTime())) {
        return null;
    }

    // Validation stricte (évite les débordements auto JS, ex: 32/01)
    if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day ||
        date.getHours() !== hours ||
        date.getMinutes() !== minutes
    ) {
        return null;
    }

    return { date, day, month, year, hours, minutes };
}
