const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Vérifie que le bot fonctionne correctement'),

    async execute(interaction) {
        const latency = Date.now() - interaction.createdTimestamp;
        const apiLatency = Math.round(interaction.client.ws.ping);

        const embed = new EmbedBuilder()
            .setColor(0x3B82F6)
            .setTitle('🏓 Pong !')
            .setDescription('Secrétaire Spades est opérationnel.')
            .addFields(
                { name: 'Latence Bot', value: `${latency}ms`, inline: true },
                { name: 'Latence API', value: `${apiLatency}ms`, inline: true }
            )
            .setFooter({ text: 'Secrétaire Spades • Système de Recrutement' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};
