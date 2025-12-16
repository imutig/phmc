const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('absence')
        .setDescription('Déclarer une absence')
        .addStringOption(option =>
            option.setName('debut')
                .setDescription('Date de début (ex: 25/12/2024)')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('fin')
                .setDescription('Date de fin (ex: 02/01/2025)')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('raison')
                .setDescription('Raison de l\'absence')
                .setRequired(true)
        ),

    async execute(interaction) {
        const debut = interaction.options.getString('debut');
        const fin = interaction.options.getString('fin');
        const raison = interaction.options.getString('raison');
        const member = interaction.member;

        // Créer l'embed d'absence
        const embed = new EmbedBuilder()
            .setColor(0xF59E0B) // Orange/Amber
            .setTitle('📅 Déclaration d\'Absence')
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: '👤 Employé', value: `<@${member.id}>`, inline: true },
                { name: '📋 Grade', value: member.nickname || member.user.username, inline: true },
                { name: '\u200B', value: '\u200B', inline: true },
                { name: '📆 Début', value: debut, inline: true },
                { name: '📆 Fin', value: fin, inline: true },
                { name: '\u200B', value: '\u200B', inline: true },
                { name: '📝 Raison', value: raison, inline: false }
            )
            .setFooter({ text: 'Pillbox Hill Medical Center • Gestion des Absences' })
            .setTimestamp();

        // Envoyer dans le canal actuel
        await interaction.reply({ embeds: [embed] });

        // Optionnel: Enregistrer dans Supabase si disponible
        const supabase = interaction.supabase;
        if (supabase) {
            try {
                await supabase.from('absences').insert({
                    discord_id: member.id,
                    discord_username: member.user.username,
                    date_debut: debut,
                    date_fin: fin,
                    raison: raison,
                    declared_at: new Date().toISOString()
                });
            } catch (error) {
                console.error('[Absence] Erreur enregistrement DB:', error);
                // On ne bloque pas l'utilisateur si la DB échoue
            }
        }
    }
};
