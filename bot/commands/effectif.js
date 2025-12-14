const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('effectif')
        .setDescription('Affiche la liste des membres EMS par grade'),

    async execute(interaction) {
        const supabase = interaction.supabase;
        const guild = interaction.guild;

        await interaction.deferReply({ flags: 64 }); // ephemeral

        try {
            // Récupérer les rôles configurés depuis Supabase
            const { data: roleConfigs, error: configError } = await supabase
                .from('discord_roles')
                .select('role_type, discord_role_id, display_name')
                .order('id', { ascending: true });

            if (configError || !roleConfigs || roleConfigs.length === 0) {
                return interaction.editReply({
                    content: '❌ Aucun rôle EMS configuré. Utilisez `/roles ajouter` d\'abord.'
                });
            }

            // Ordre d'affichage des grades (du plus haut au plus bas)
            const gradeOrder = ['direction', 'chirurgien', 'medecin', 'infirmier', 'ambulancier'];

            // Récupérer les membres du serveur
            await guild.members.fetch();

            const membersByGrade = {};
            let totalMembers = 0;

            // Pour chaque grade EMS
            for (const grade of gradeOrder) {
                const config = roleConfigs.find(r => r.role_type === grade);
                if (!config) continue;

                const role = guild.roles.cache.get(config.discord_role_id);
                if (!role) continue;

                const members = role.members.map(m => ({
                    name: m.displayName,
                    id: m.id
                }));

                if (members.length > 0) {
                    membersByGrade[grade] = {
                        displayName: config.display_name || grade,
                        members: members,
                        roleColor: role.hexColor
                    };
                    totalMembers += members.length;
                }
            }

            if (totalMembers === 0) {
                return interaction.editReply({
                    content: '📋 Aucun membre EMS trouvé avec les rôles configurés.'
                });
            }

            // Créer l'embed
            const embed = new EmbedBuilder()
                .setColor(0xDC2626)
                .setTitle('🏥 Effectif EMS')
                .setDescription(`**${totalMembers}** membre${totalMembers > 1 ? 's' : ''} actif${totalMembers > 1 ? 's' : ''}`)
                .setTimestamp()
                .setFooter({ text: 'Pillbox Hill Medical Center' });

            // Ajouter chaque grade comme un field
            for (const grade of gradeOrder) {
                const data = membersByGrade[grade];
                if (!data) continue;

                const memberList = data.members
                    .map(m => `• ${m.name}`)
                    .join('\n');

                // Limiter à 1024 caractères (limite Discord)
                const truncatedList = memberList.length > 1000
                    ? memberList.substring(0, 997) + '...'
                    : memberList;

                embed.addFields({
                    name: `${getGradeEmoji(grade)} ${data.displayName} (${data.members.length})`,
                    value: truncatedList || 'Aucun',
                    inline: false
                });
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Erreur effectif:', error);
            await interaction.editReply({
                content: '❌ Erreur lors de la récupération de l\'effectif.'
            });
        }
    }
};

function getGradeEmoji(grade) {
    const emojis = {
        direction: '👑',
        chirurgien: '🔬',
        medecin: '⚕️',
        infirmier: '💉',
        ambulancier: '🚑'
    };
    return emojis[grade] || '👤';
}
