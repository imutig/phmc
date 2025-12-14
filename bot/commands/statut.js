const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');

const STATUS_OPTIONS = [
    { name: 'En examen', value: 'reviewing' },
    { name: 'Entretien planifié', value: 'interview_scheduled' },
    { name: 'Entretien réussi', value: 'interview_passed' },
    { name: 'Entretien échoué', value: 'interview_failed' },
    { name: 'Formation', value: 'training' },
    { name: 'Recruté', value: 'recruited' },
    { name: 'Refusé', value: 'rejected' },
];

const STATUS_COLORS = {
    pending: 0xFCD34D,
    reviewing: 0x3B82F6,
    interview_scheduled: 0xA855F7,
    interview_passed: 0x22C55E,
    interview_failed: 0xEF4444,
    training: 0x06B6D4,
    recruited: 0x10B981,
    rejected: 0xEF4444,
};

const STATUS_LABELS = {
    pending: '⏳ En attente',
    reviewing: '🔍 En examen',
    interview_scheduled: '📅 Entretien planifié',
    interview_passed: '✅ Entretien réussi',
    interview_failed: '❌ Entretien échoué',
    training: '📚 Formation',
    recruited: '🎉 Recruté',
    rejected: '🚫 Refusé'
};

// Statuts qui clôturent une candidature
const CLOSED_STATUSES = ['rejected', 'recruited'];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('statut')
        .setDescription('Change le statut d\'une candidature')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addStringOption(option =>
            option.setName('nouveau_statut')
                .setDescription('Le nouveau statut à appliquer')
                .setRequired(true)
                .addChoices(...STATUS_OPTIONS)
        )
        .addStringOption(option =>
            option.setName('date_entretien')
                .setDescription('Date de l\'entretien (format: JJ/MM/AAAA HH:MM)')
                .setRequired(false)
        ),

    async execute(interaction) {
        const supabase = interaction.supabase;
        const channelId = interaction.channelId;
        const newStatus = interaction.options.getString('nouveau_statut');
        const interviewDateStr = interaction.options.getString('date_entretien');

        await interaction.deferReply();

        // Trouver la candidature liée à ce salon
        const { data: application, error } = await supabase
            .from('applications')
            .select('*, users(discord_id, discord_username)')
            .eq('discord_channel_id', channelId)
            .single();

        if (error || !application) {
            return interaction.editReply({
                content: '❌ Ce salon n\'est pas lié à une candidature. Utilisez cette commande dans un salon de candidature.',
                ephemeral: true
            });
        }

        const oldStatus = application.status;

        // Préparer la mise à jour
        const updateData = {
            status: newStatus,
            updated_at: new Date().toISOString()
        };

        // Parser la date d'entretien si fournie
        if (interviewDateStr && newStatus === 'interview_scheduled') {
            const dateParts = interviewDateStr.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/);
            if (dateParts) {
                const [, day, month, year, hour, minute] = dateParts;
                updateData.interview_date = new Date(year, month - 1, day, hour, minute).toISOString();
            }
        }

        // Mettre à jour la candidature
        const { error: updateError } = await supabase
            .from('applications')
            .update(updateData)
            .eq('id', application.id);

        if (updateError) {
            console.error('Erreur mise à jour:', updateError);
            return interaction.editReply({ content: '❌ Erreur lors de la mise à jour du statut.' });
        }

        // Logger l'action
        await supabase.from('application_logs').insert({
            application_id: application.id,
            actor_discord_id: interaction.user.id,
            actor_name: interaction.user.username,
            action: 'status_change',
            details: { old_status: oldStatus, new_status: newStatus }
        });

        // Si la candidature est clôturée, supprimer les documents du storage
        let documentsDeleted = 0;
        if (CLOSED_STATUSES.includes(newStatus)) {
            documentsDeleted = await cleanupApplicationDocuments(supabase, application.id);
        }

        // Embed de confirmation
        const embed = new EmbedBuilder()
            .setColor(STATUS_COLORS[newStatus])
            .setTitle('📝 Statut Mis à Jour')
            .setDescription(`Le statut de la candidature de **${application.first_name} ${application.last_name}** a été modifié.`)
            .addFields(
                { name: 'Ancien statut', value: STATUS_LABELS[oldStatus], inline: true },
                { name: 'Nouveau statut', value: STATUS_LABELS[newStatus], inline: true },
                { name: 'Modifié par', value: `<@${interaction.user.id}>`, inline: false }
            )
            .setTimestamp()
            .setFooter({ text: 'Secrétaire Spades' });

        if (updateData.interview_date) {
            embed.addFields({
                name: '📅 Date d\'entretien',
                value: `<t:${Math.floor(new Date(updateData.interview_date).getTime() / 1000)}:F>`
            });
        }

        // Indiquer si des documents ont été supprimés
        if (documentsDeleted > 0) {
            embed.addFields({
                name: '🗑️ Nettoyage',
                value: `${documentsDeleted} document(s) supprimé(s) du stockage`,
                inline: false
            });
        }

        await interaction.editReply({ embeds: [embed] });

        // Envoyer un DM au candidat pour l'informer du changement
        if (application.users?.discord_id) {
            try {
                const user = await interaction.client.users.fetch(application.users.discord_id);

                const dmEmbed = new EmbedBuilder()
                    .setColor(STATUS_COLORS[newStatus])
                    .setTitle(`📋 Mise à jour de votre candidature ${application.service}`)
                    .setDescription(`Votre candidature a été mise à jour.`)
                    .addFields(
                        { name: 'Nouveau statut', value: STATUS_LABELS[newStatus] }
                    )
                    .setTimestamp()
                    .setFooter({ text: 'Secrétaire Spades' });

                // Message personnalisé selon le statut
                if (newStatus === 'recruited') {
                    dmEmbed.setDescription('🎉 Félicitations ! Votre candidature a été acceptée. Bienvenue dans l\'équipe !');
                } else if (newStatus === 'rejected') {
                    dmEmbed.setDescription('Nous regrettons de vous informer que votre candidature n\'a pas été retenue. Vous pourrez postuler à nouveau dans 24 heures.');
                } else if (newStatus === 'interview_scheduled' && updateData.interview_date) {
                    dmEmbed.addFields({
                        name: '📅 Date de l\'entretien',
                        value: `<t:${Math.floor(new Date(updateData.interview_date).getTime() / 1000)}:F>`
                    });
                }

                await user.send({ embeds: [dmEmbed] });
                console.log(`📨 DM envoyé à ${application.users.discord_username} pour changement de statut`);
            } catch (dmError) {
                console.error('Erreur envoi DM:', dmError.message);
            }
        }
    }
};

/**
 * Supprime les documents d'une candidature du storage
 * @param {object} supabase - Client Supabase
 * @param {string} applicationId - ID de la candidature
 * @returns {Promise<number>} Nombre de documents supprimés
 */
async function cleanupApplicationDocuments(supabase, applicationId) {
    try {
        // Récupérer les documents de la candidature
        const { data: documents, error: fetchError } = await supabase
            .from('application_documents')
            .select('id, file_url')
            .eq('application_id', applicationId);

        if (fetchError || !documents || documents.length === 0) {
            return 0;
        }

        // Extraire les chemins des fichiers depuis les URLs
        const filePaths = documents.map(doc => {
            // URL format: https://{project}.supabase.co/storage/v1/object/public/documents/{path}
            const urlParts = doc.file_url.split('/documents/');
            return urlParts.length > 1 ? urlParts[1] : null;
        }).filter(path => path !== null);

        // Supprimer les fichiers du storage
        if (filePaths.length > 0) {
            const { error: deleteStorageError } = await supabase.storage
                .from('documents')
                .remove(filePaths);

            if (deleteStorageError) {
                console.error('Erreur suppression storage:', deleteStorageError);
            }
        }

        // Supprimer les enregistrements de la base de données
        const { error: deleteDbError } = await supabase
            .from('application_documents')
            .delete()
            .eq('application_id', applicationId);

        if (deleteDbError) {
            console.error('Erreur suppression DB:', deleteDbError);
        }

        console.log(`🗑️ ${documents.length} document(s) supprimé(s) pour la candidature ${applicationId}`);
        return documents.length;

    } catch (error) {
        console.error('Erreur cleanup documents:', error);
        return 0;
    }
}
