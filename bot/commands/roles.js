const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

// Grades EMS avec leurs permissions
const ROLE_TYPES = {
    direction: { name: 'Direction', emoji: '👑', description: 'Tous les droits (admin)', salary: '1100$/15min' },
    chirurgien: { name: 'Chirurgien', emoji: '💉', description: 'Accès intranet', salary: '1000$/15min' },
    medecin: { name: 'Médecin', emoji: '🩺', description: 'Accès intranet', salary: '900$/15min' },
    infirmier: { name: 'Infirmier', emoji: '💊', description: 'Accès intranet', salary: '700$/15min' },
    ambulancier: { name: 'Ambulancier', emoji: '🚑', description: 'Accès intranet', salary: '625$/15min' },
    recruiter: { name: 'Recruteur', emoji: '📋', description: 'Gestion des candidatures', salary: null },
    candidate: { name: 'Candidat', emoji: '📝', description: 'Peut postuler', salary: null }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('roles')
        .setDescription('Configurer les rôles Discord pour l\'intranet EMS')
        .addSubcommand(subcommand =>
            subcommand
                .setName('ajouter')
                .setDescription('Ajouter un rôle Discord à un type de permission')
                .addStringOption(option =>
                    option
                        .setName('type')
                        .setDescription('Type de permission')
                        .setRequired(true)
                        .addChoices(
                            { name: '👑 Direction', value: 'direction' },
                            { name: '💉 Chirurgien', value: 'chirurgien' },
                            { name: '🩺 Médecin', value: 'medecin' },
                            { name: '💊 Infirmier', value: 'infirmier' },
                            { name: '🚑 Ambulancier', value: 'ambulancier' },
                            { name: '📋 Recruteur', value: 'recruiter' },
                            { name: '📝 Candidat', value: 'candidate' }
                        )
                )
                .addRoleOption(option =>
                    option
                        .setName('role')
                        .setDescription('Rôle Discord à associer')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('retirer')
                .setDescription('Retirer un rôle Discord d\'un type de permission')
                .addRoleOption(option =>
                    option
                        .setName('role')
                        .setDescription('Rôle Discord à retirer')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('liste')
                .setDescription('Afficher la configuration actuelle des rôles')
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        // On diffère avec ephemeral par défaut pour les commandes de gestion
        await interaction.deferReply({ flags: 64 });

        if (subcommand === 'ajouter') {
            const roleType = interaction.options.getString('type');
            const role = interaction.options.getRole('role');

            // Vérifier si le rôle n'est pas déjà configuré
            const { data: existing } = await supabase
                .from('discord_roles')
                .select('*')
                .eq('discord_role_id', role.id)
                .eq('role_type', roleType)
                .single();

            if (existing) {
                return interaction.editReply({
                    content: `❌ Le rôle **${role.name}** est déjà configuré comme **${ROLE_TYPES[roleType].name}**.`
                });
            }

            // Ajouter le rôle
            const { error } = await supabase
                .from('discord_roles')
                .insert({
                    role_type: roleType,
                    discord_role_id: role.id,
                    role_name: role.name
                });

            if (error) {
                console.error('Erreur ajout rôle:', error);
                return interaction.editReply({
                    content: '❌ Erreur lors de l\'ajout du rôle.'
                });
            }

            const roleInfo = ROLE_TYPES[roleType];
            const embed = new EmbedBuilder()
                .setColor(0xDC2626)
                .setTitle('✅ Rôle configuré')
                .setDescription(`Le rôle **${role.name}** a été associé au type **${roleInfo.emoji} ${roleInfo.name}**.`)
                .addFields(
                    { name: 'Permission', value: roleInfo.description, inline: true }
                );

            if (roleInfo.salary) {
                embed.addFields({ name: 'Salaire', value: roleInfo.salary, inline: true });
            }

            embed.setTimestamp();
            await interaction.editReply({ embeds: [embed] });

        } else if (subcommand === 'retirer') {
            const role = interaction.options.getRole('role');

            const { data: existing, error: findError } = await supabase
                .from('discord_roles')
                .select('*')
                .eq('discord_role_id', role.id);

            if (findError || !existing || existing.length === 0) {
                return interaction.editReply({
                    content: `❌ Le rôle **${role.name}** n'est pas configuré.`
                });
            }

            const { error } = await supabase
                .from('discord_roles')
                .delete()
                .eq('discord_role_id', role.id);

            if (error) {
                console.error('Erreur suppression rôle:', error);
                return interaction.editReply({
                    content: '❌ Erreur lors de la suppression du rôle.'
                });
            }

            await interaction.editReply({
                content: `✅ Le rôle **${role.name}** a été retiré de la configuration.`
            });

        } else if (subcommand === 'liste') {
            const { data: roles, error } = await supabase
                .from('discord_roles')
                .select('*')
                .order('role_type');

            if (error) {
                console.error('Erreur liste rôles:', error);
                return interaction.editReply({
                    content: '❌ Erreur lors de la récupération des rôles.'
                });
            }

            const embed = new EmbedBuilder()
                .setColor(0xDC2626)
                .setTitle('🏥 Configuration des Rôles PHMC')
                .setDescription('Voici la liste des rôles Discord configurés pour l\'intranet.')
                .setTimestamp();

            // Grouper par type
            for (const [type, info] of Object.entries(ROLE_TYPES)) {
                const typeRoles = roles?.filter(r => r.role_type === type) || [];
                const rolesList = typeRoles.length > 0
                    ? typeRoles.map(r => `<@&${r.discord_role_id}>`).join(', ')
                    : '*Aucun rôle*';

                let fieldValue = `${info.description}\n${rolesList}`;
                if (info.salary) {
                    fieldValue += `\n💰 ${info.salary}`;
                }

                embed.addFields({
                    name: `${info.emoji} ${info.name}`,
                    value: fieldValue,
                    inline: false
                });
            }

            await interaction.editReply({ embeds: [embed] });
        }
    }
};
