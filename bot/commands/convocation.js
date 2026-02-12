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
        )
        .addStringOption(option =>
            option.setName('duree')
                .setDescription('Durée estimée (optionnel, ex: 1h, 1h30, 90min)')
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
        const dureeInput = interaction.options.getString('duree');
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
        const durationMinutes = parseDurationMinutes(dureeInput);

        if (dureeInput && durationMinutes === null) {
            return interaction.reply({
                content: '❌ Durée invalide. Exemples valides: `1h`, `1h30`, `90min`, `45`.',
                flags: 64
            });
        }

        const resolvedDurationMinutes = durationMinutes ?? 60;
        const durationLabel = formatDurationLabel(resolvedDurationMinutes);
        const convocationContent = getConvocationContent(convocationType);

        await interaction.deferReply();

        // Créer l'embed de convocation
        const embed = new EmbedBuilder()
            .setColor(0xDC2626) // Rouge
            .setTitle(convocationContent.title)
            .setDescription(convocationContent.description.replace('{target}', `<@${targetUser.id}>`))
            .addFields(
                { name: '👤 Type', value: typeLabel, inline: true },
                { name: '📅 Date', value: normalizedDate, inline: true },
                { name: '🕐 Heure', value: normalizedTime, inline: true },
                { name: '⏱️ Durée estimée', value: durationLabel, inline: true },
                { name: '📍 Lieu', value: lieu, inline: true },
                { name: '📋 Motif', value: motif, inline: false },
                { name: '\u200B', value: convocationContent.footerText, inline: false }
            )
            .setFooter({ text: `Convocation émise par ${convocateur.nickname || convocateur.user.username}` })
            .setTimestamp();

        // Boutons de réponse
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`convocation_confirm_${targetUser.id}_${interaction.user.id}_${scheduledTimestamp}_${resolvedDurationMinutes}_${convocationType}`)
                    .setLabel('✅ Je confirme ma présence')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`convocation_absent_${targetUser.id}_${interaction.user.id}_${scheduledTimestamp}_${resolvedDurationMinutes}_${convocationType}`)
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

function parseDurationMinutes(rawValue) {
    if (!rawValue) return null;

    const input = String(rawValue).trim().toLowerCase().replace(/\s+/g, '');

    let match = input.match(/^(\d{1,2})h(\d{1,2})$/);
    if (match) {
        const hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        if (minutes >= 60) return null;
        return normalizeDuration(hours * 60 + minutes);
    }

    match = input.match(/^(\d{1,2})h$/);
    if (match) {
        return normalizeDuration(parseInt(match[1], 10) * 60);
    }

    match = input.match(/^(\d{1,3})(min|m)?$/);
    if (match) {
        return normalizeDuration(parseInt(match[1], 10));
    }

    return null;
}

function normalizeDuration(minutes) {
    if (Number.isNaN(minutes)) return null;
    if (minutes < 10 || minutes > 8 * 60) return null;
    return minutes;
}

function formatDurationLabel(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hours === 0) return `${mins} min`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h${mins.toString().padStart(2, '0')}`;
}

function getConvocationContent(type) {
    if (type === 'staff') {
        return {
            title: '📌 CONVOCATION INTERNE',
            description: '{target}, vous êtes convoqué(e) pour un rendez-vous interne avec le personnel médical.',
            footerText: 'Merci de confirmer votre disponibilité. En cas d\'empêchement, prévenez rapidement afin de reprogrammer ce rendez-vous interne.'
        };
    }

    return {
        title: '📅 RENDEZ-VOUS MÉDICAL',
        description: '{target}, le personnel médical vous propose un rendez-vous médical.',
        footerText: 'Merci de confirmer votre disponibilité. En cas d\'empêchement, prévenez simplement le personnel médical afin de reprogrammer le rendez-vous.'
    };
}
