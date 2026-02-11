const {
    SlashCommandBuilder,
    EmbedBuilder
} = require('discord.js');

// Stockage temporaire des rappels
const pendingReminders = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rappel')
        .setDescription('Programmer un rappel personnel')
        .addStringOption(option =>
            option.setName('dans')
                .setDescription('Délai avant le rappel (ex: 30m, 2h, 1h30)')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('message')
                .setDescription('Message du rappel')
                .setRequired(true)
        ),

    async execute(interaction) {
        const delayStr = interaction.options.getString('dans');
        const message = interaction.options.getString('message');

        await interaction.deferReply({ flags: 64 });

        // Parser le délai
        const delayMs = parseDelay(delayStr);
        if (!delayMs) {
            return interaction.editReply({
                content: '❌ Format de délai invalide. Utilisez: `30m`, `2h`, `1h30`, `90m`'
            });
        }

        // Limiter à 24h max
        const maxDelay = 24 * 60 * 60 * 1000;
        if (delayMs > maxDelay) {
            return interaction.editReply({
                content: '❌ Le délai maximum est de 24 heures.'
            });
        }

        // Calculer l'heure du rappel
        const reminderTime = new Date(Date.now() + delayMs);
        const formattedTime = reminderTime.toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit'
        });

        // Créer le rappel
        const reminderId = `reminder_${interaction.user.id}_${Date.now()}`;
        const timeout = setTimeout(async () => {
            try {
                const embed = new EmbedBuilder()
                    .setColor(0x22C55E)
                    .setTitle('⏰ Rappel')
                    .setDescription(message)
                    .setFooter({ text: `Rappel programmé il y a ${formatDuration(delayMs)}` })
                    .setTimestamp();

                await interaction.user.send({ embeds: [embed] });
            } catch (err) {
                // L'utilisateur a peut-être désactivé les DMs
                console.error('Impossible d\'envoyer le rappel:', err.message);
            } finally {
                pendingReminders.delete(reminderId);
            }
        }, delayMs);

        pendingReminders.set(reminderId, {
            userId: interaction.user.id,
            message,
            timeout,
            reminderTime
        });

        // Confirmation
        const embed = new EmbedBuilder()
            .setColor(0x3B82F6)
            .setTitle('✅ Rappel programmé')
            .setDescription(`Je t'enverrai un DM à **${formattedTime}** avec le message:`)
            .addFields({
                name: '📝 Message',
                value: message.length > 200 ? message.slice(0, 200) + '...' : message
            })
            .setFooter({ text: `Dans ${formatDuration(delayMs)}` });

        await interaction.editReply({ embeds: [embed] });
    }
};

// Parser un délai du format "30m", "2h", "1h30", "90m"
function parseDelay(str) {
    if (!str) return null;

    const lower = str.toLowerCase().trim();

    // Format: 1h30m ou 1h30
    const combinedMatch = lower.match(/^(\d+)h\s*(\d+)m?$/);
    if (combinedMatch) {
        const hours = parseInt(combinedMatch[1]);
        const minutes = parseInt(combinedMatch[2]);
        return (hours * 60 + minutes) * 60 * 1000;
    }

    // Format: 2h
    const hoursMatch = lower.match(/^(\d+)h$/);
    if (hoursMatch) {
        return parseInt(hoursMatch[1]) * 60 * 60 * 1000;
    }

    // Format: 30m ou 30min
    const minutesMatch = lower.match(/^(\d+)m(?:in)?$/);
    if (minutesMatch) {
        return parseInt(minutesMatch[1]) * 60 * 1000;
    }

    return null;
}

// Formater une durée en texte lisible
function formatDuration(ms) {
    const minutes = Math.floor(ms / (60 * 1000));
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (hours > 0 && remainingMinutes > 0) {
        return `${hours}h${remainingMinutes}min`;
    } else if (hours > 0) {
        return `${hours}h`;
    } else {
        return `${remainingMinutes}min`;
    }
}
