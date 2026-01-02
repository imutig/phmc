const { EmbedBuilder, ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const messageQueue = require('../utils/messageQueue');

/**
 * Service de gestion des rendez-vous patients
 * Réplique le système de candidatures sans les votes
 */

/**
 * Crée un salon de rendez-vous Discord pour un nouveau RDV
 * @param {Client} client - Le client Discord
 * @param {object} supabase - Le client Supabase
 * @param {object} appointment - Les données du rendez-vous
 * @param {object} patient - Les données du patient
 * @returns {Promise<string|null>} L'ID du salon créé ou null en cas d'erreur
 */
async function createAppointmentChannel(client, supabase, appointment, patient) {
    try {
        const guild = await client.guilds.fetch(process.env.DISCORD_GUILD_ID);
        if (!guild) {
            console.error('❌ Guild non trouvée');
            return null;
        }

        // Vérification d'idempotence : si le RDV a déjà un salon, on ne fait rien
        // On refait un fetch pour être sûr d'avoir la dernière version
        const { data: currentAppointment } = await supabase
            .from('appointments')
            .select('discord_channel_id')
            .eq('id', appointment.id)
            .single();

        if (currentAppointment?.discord_channel_id) {
            console.log(`⚠️ Le RDV ${appointment.id} a déjà un salon (${currentAppointment.discord_channel_id}). Ignoré.`);
            return currentAppointment.discord_channel_id;
        }

        // Récupérer la config rendez-vous depuis Supabase
        const { data: configs } = await supabase
            .from('config')
            .select('*')
            .in('key', [
                'appointments_category_id',
                'medical_staff_role_id',
                'direction_role_id'
            ]);

        const configMap = {};
        for (const config of configs || []) {
            try {
                configMap[config.key] = JSON.parse(config.value);
            } catch {
                configMap[config.key] = config.value;
            }
        }

        // Catégorie et rôles
        const categoryId = configMap.appointments_category_id;
        const medicalRoleId = configMap.medical_staff_role_id;
        const directionRoleId = configMap.direction_role_id;

        if (!categoryId) {
            console.error('❌ Catégorie rendez-vous non configurée');
            return null;
        }

        // Nom du salon: rdv-prenom-nom
        const channelName = `rdv-${patient.first_name}-${patient.last_name}`
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9-]/g, '-')
            .replace(/-+/g, '-')
            .substring(0, 32);

        // Déterminer les rôles autorisés
        const allowedRoles = [];

        // Si c'est un RDV Direction, seule la direction a accès
        if (appointment.reason_category === "Un rendez-vous avec la direction") {
            if (directionRoleId) allowedRoles.push(directionRoleId);
        } else {
            // Sinon, staff médical ET direction ont accès
            if (medicalRoleId) allowedRoles.push(medicalRoleId);
            if (directionRoleId) allowedRoles.push(directionRoleId);
        }

        // Créer le salon
        const channel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: categoryId,
            permissionOverwrites: [
                {
                    id: guild.id,
                    deny: [PermissionFlagsBits.ViewChannel],
                },
                ...allowedRoles.map(roleId => ({
                    id: roleId,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ReadMessageHistory,
                    ],
                })),
            ],
        });

        // Mettre à jour le rendez-vous avec l'ID du salon
        await supabase
            .from('appointments')
            .update({ discord_channel_id: channel.id })
            .eq('id', appointment.id);

        // Envoyer l'embed de bienvenue dans le salon
        const welcomeEmbed = new EmbedBuilder()
            .setColor(0x22C55E)
            .setTitle(`📅 Nouveau Rendez-vous`)
            .setDescription(`Un patient demande un rendez-vous !`)
            .addFields(
                { name: '👤 Patient', value: `${patient.first_name} ${patient.last_name}`, inline: true },
                { name: '📞 Téléphone', value: patient.phone || 'Non renseigné', inline: true },
                { name: '📅 Date de naissance', value: patient.birth_date ? new Date(patient.birth_date).toLocaleDateString('fr-FR') : 'Non renseignée', inline: true },
                { name: '📋 Type', value: appointment.reason_category || 'Non précisé' },
                { name: '💬 Détails', value: appointment.reason || 'Aucun détail supplémentaire' },
                { name: '📊 Statut', value: '⏳ En attente de prise en charge', inline: true },
                { name: '🔗 Discord', value: `<@${appointment.discord_id}>`, inline: true }
            )
            .setTimestamp()
            .setFooter({ text: `ID: ${appointment.id}` });

        await messageQueue.sendToChannel(channel, { embeds: [welcomeEmbed] });

        // Boutons d'actions rapides
        const actionRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`rdv_schedule_${appointment.id}`)
                    .setLabel('📅 Programmer')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`rdv_close_${appointment.id}`)
                    .setLabel('❌ Fermer')
                    .setStyle(ButtonStyle.Danger)
            );

        await messageQueue.sendToChannel(channel, {
            content: '**Actions :**',
            components: [actionRow]
        });

        // Mentionner le staff
        if (allowedRoles.length > 0) {
            const mentions = allowedRoles.map(id => `<@&${id}>`).join(' ');
            await messageQueue.sendToChannel(channel, {
                content: `${mentions} Nouveau rendez-vous à traiter !`,
                allowedMentions: { roles: allowedRoles }
            });
        }

        // Lien vers le dossier patient
        const patientRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setLabel('📋 Voir le dossier patient')
                    .setStyle(ButtonStyle.Link)
                    .setURL(`${process.env.WEB_URL || 'http://localhost:3000'}/intranet/patients/${patient.id}`)
            );

        await messageQueue.sendToChannel(channel, {
            content: '**Dossier patient :**',
            components: [patientRow]
        });

        console.log(`✅ Salon RDV créé: ${channel.name} (${channel.id})`);
        return channel.id;

    } catch (error) {
        console.error('❌ Erreur création salon RDV:', error);
        return null;
    }
}

/**
 * Envoie le message DM de confirmation au patient
 * @param {Client} client - Le client Discord
 * @param {object} supabase - Le client Supabase
 * @param {object} appointment - Le rendez-vous
 * @param {object} patient - Le patient
 */
async function sendAppointmentReceivedDM(client, supabase, appointment, patient) {
    // Vérification d'idempotence : si le DM a déjà été envoyé (discord_message_id présent), on ne fait rien
    const { data: currentAppointment } = await supabase
        .from('appointments')
        .select('discord_message_id')
        .eq('id', appointment.id)
        .single();

    if (currentAppointment?.discord_message_id) {
        console.log(`⚠️ DM déjà envoyé pour RDV ${appointment.id}. Ignoré.`);
        return true;
    }

    const embed = new EmbedBuilder()
        .setColor(0x22C55E)
        .setTitle(`📅 Rendez-vous Enregistré`)
        .setDescription([
            `Bonjour **${patient.first_name}**,`,
            ``,
            `Votre demande de rendez-vous a bien été reçue.`,
            ``,
            `Notre équipe médicale va vous contacter prochainement.`,
            ``,
            `💬 **Vous pouvez répondre directement à ce DM** pour communiquer avec nos médecins.`
        ].join('\n'))
        .addFields(
            { name: '📋 Référence', value: `\`${appointment.id.substring(0, 8)}...\``, inline: true },
            { name: '📊 Statut', value: 'En attente', inline: true }
        )
        .setFooter({ text: `PHMC • Pillbox Hill Medical Center` })
        .setTimestamp();

    try {
        const user = await client.users.fetch(appointment.discord_id);
        const dmMessage = await messageQueue.sendToUser(user, { embeds: [embed] });

        // Marquer le DM comme envoyé en base
        if (dmMessage) {
            await supabase
                .from('appointments')
                .update({ discord_message_id: dmMessage.id || 'sent' })
                .eq('id', appointment.id);
        }

        return true;
    } catch (error) {
        console.error('❌ Erreur envoi DM RDV:', error.message);
        return false;
    }
}

module.exports = {
    createAppointmentChannel,
    sendAppointmentReceivedDM
};
