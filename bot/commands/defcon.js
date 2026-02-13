const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const DEFCON_LEVELS = {
    vert: {
        label: 'DEFCON VERT',
        color: 0x22C55E,
        description: 'Niveau d\'alerte minimal, aucune indication particulière.'
    },
    orange: {
        label: 'DEFCON ORANGE',
        color: 0xF59E0B,
        description: 'Niveau d\'alerte moyen, vigilance renforcée recommandée.'
    },
    rouge: {
        label: 'DEFCON ROUGE',
        color: 0xEF4444,
        description: 'Port du gilet obligatoire, interventions à 2 minimum et prime de risque active.'
    },
    noir: {
        label: 'DEFCON NOIR',
        color: 0x111827,
        description: 'Mesures DEFCON ROUGE renforcées : gilet obligatoire, interventions à 2 minimum et prime de risque active.'
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('defcon')
        .setDescription('Met à jour le niveau DEFCON de la ville')
        .addStringOption(option =>
            option.setName('couleur')
                .setDescription('Niveau DEFCON à appliquer')
                .setRequired(true)
                .addChoices(
                    { name: 'Vert', value: 'vert' },
                    { name: 'Orange', value: 'orange' },
                    { name: 'Rouge', value: 'rouge' },
                    { name: 'Noir', value: 'noir' }
                )
        ),

    async execute(interaction) {
        const supabase = interaction.supabase;
        const level = interaction.options.getString('couleur');

        await interaction.deferReply({ flags: 64 });

        const isDirection = await hasDirectionRole(interaction, supabase);
        if (!isDirection) {
            return interaction.editReply({
                content: '❌ Seule la Direction peut modifier le niveau DEFCON.'
            });
        }

        const selected = DEFCON_LEVELS[level];
        if (!selected) {
            return interaction.editReply({
                content: '❌ Niveau DEFCON invalide.'
            });
        }

        const { error } = await supabase
            .from('config')
            .upsert({
                key: 'defcon_level',
                value: level,
                updated_at: new Date().toISOString()
            }, { onConflict: 'key' });

        if (error) {
            return interaction.editReply({
                content: `❌ Erreur lors de la mise à jour DEFCON: ${error.message}`
            });
        }

        const embed = new EmbedBuilder()
            .setColor(selected.color)
            .setTitle(`✅ ${selected.label} appliqué`)
            .setDescription(selected.description)
            .addFields({
                name: 'Mis à jour par',
                value: interaction.member?.displayName || interaction.user.username,
                inline: true
            })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    }
};

async function hasDirectionRole(interaction, supabase) {
    if (interaction.memberPermissions?.has('Administrator')) {
        return true;
    }

    try {
        const { data: roleConfigs, error } = await supabase
            .from('discord_roles')
            .select('discord_role_id')
            .eq('role_type', 'direction');

        if (error || !roleConfigs || roleConfigs.length === 0) {
            return false;
        }

        const directionRoleIds = roleConfigs
            .map(role => role.discord_role_id)
            .filter(Boolean);

        if (directionRoleIds.length === 0) {
            return false;
        }

        return interaction.member.roles.cache.some(role => directionRoleIds.includes(role.id));
    } catch {
        return false;
    }
}
