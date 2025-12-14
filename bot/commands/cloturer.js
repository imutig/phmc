const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

module.exports = {
    data: new SlashCommandBuilder()
        .setName('cloturer')
        .setDescription('Clôturer une candidature (recruté ou refusé)')
        .addStringOption(option =>
            option
                .setName('decision')
                .setDescription('Décision finale')
                .setRequired(true)
                .addChoices(
                    { name: '✅ Recruté', value: 'recruited' },
                    { name: '❌ Refusé', value: 'rejected' }
                )
        )
        .addStringOption(option =>
            option
                .setName('raison')
                .setDescription('Raison de la décision (optionnel)')
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async execute(interaction) {
        const decision = interaction.options.getString('decision');
        const reason = interaction.options.getString('raison') || null;
        const channelId = interaction.channelId;

        // Trouver la candidature liée à ce salon
        const { data: application, error } = await supabase
            .from('applications')
            .select('*, users(discord_id, discord_username)')
            .eq('discord_channel_id', channelId)
            .single();

        if (error || !application) {
            return interaction.reply({
                content: '❌ Ce salon n\'est pas lié à une candidature.',
                flags: 64
            });
        }

        // Vérifier que la candidature n'est pas déjà clôturée
        if (application.status === 'recruited' || application.status === 'rejected') {
            return interaction.reply({
                content: '⚠️ Cette candidature est déjà clôturée.',
                flags: 64
            });
        }

        // Mettre à jour la candidature avec la raison
        const now = new Date().toISOString();
        const { error: updateError } = await supabase
            .from('applications')
            .update({
                status: decision,
                closed_at: now,
                close_reason: reason,
                updated_at: now
            })
            .eq('id', application.id);

        if (updateError) {
            console.error('Erreur clôture:', updateError);
            return interaction.reply({
                content: '❌ Erreur lors de la clôture.',
                flags: 64
            });
        }

        // Logger l'action
        await supabase.from('application_logs').insert({
            application_id: application.id,
            action: 'status_change',
            details: `Candidature clôturée: ${decision === 'recruited' ? 'Recruté' : 'Refusé'}${reason ? ` - ${reason}` : ''}`,
            performed_by_discord_id: interaction.user.id,
            performed_by_name: interaction.user.username
        });

        // Construire l'embed de confirmation avec bouton de fermeture
        const isRecruited = decision === 'recruited';
        const statusEmoji = isRecruited ? '✅' : '❌';
        const statusText = isRecruited ? 'RECRUTÉ' : 'REFUSÉ';
        const embedColor = isRecruited ? 0x22C55E : 0xEF4444;

        const confirmEmbed = new EmbedBuilder()
            .setColor(embedColor)
            .setTitle(`${statusEmoji} Candidature Clôturée`)
            .setDescription(`La candidature de **${application.first_name} ${application.last_name}** a été clôturée.`)
            .addFields(
                { name: 'Décision', value: statusText, inline: true },
                { name: 'Par', value: `<@${interaction.user.id}>`, inline: true }
            )
            .setTimestamp();

        if (reason) {
            confirmEmbed.addFields({ name: 'Raison', value: reason });
        }

        // Ajouter le bouton de fermeture du salon
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`close_channel_${application.id}`)
                    .setLabel('Fermer le salon')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🔒')
            );

        await interaction.reply({ embeds: [confirmEmbed], components: [row] });

        // Envoyer un DM au candidat
        if (application.users?.discord_id) {
            try {
                const user = await interaction.client.users.fetch(application.users.discord_id);

                const candidateEmbed = new EmbedBuilder()
                    .setColor(embedColor)
                    .setTitle(`${statusEmoji} Décision de Candidature - ${application.service}`)
                    .setDescription(isRecruited
                        ? `Félicitations **${application.first_name}** ! 🎉\n\nVotre candidature pour le **${application.service}** a été **acceptée** !\n\nBienvenue dans l'équipe ! Un membre du staff vous contactera prochainement pour la suite.`
                        : `Bonjour **${application.first_name}**,\n\nAprès examen de votre dossier, nous avons le regret de vous informer que votre candidature pour le **${application.service}** n'a pas été retenue.\n\nNous vous remercions pour l'intérêt porté à notre organisation.`
                    )
                    .setFooter({ text: `${application.service} • Secrétaire Spades` })
                    .setTimestamp();

                if (reason && !isRecruited) {
                    candidateEmbed.addFields({ name: 'Motif', value: reason });
                }

                await user.send({ embeds: [candidateEmbed] });
            } catch (dmError) {
                console.error('Erreur DM candidat:', dmError.message);
            }
        }
    }
};
