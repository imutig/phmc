const { EmbedBuilder, ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const messageQueue = require('../utils/messageQueue');

/**
 * Service de gestion des candidatures
 * Utilisé par le site web via API pour créer les salons de candidature
 */

/**
 * Crée un salon de candidature Discord pour une nouvelle candidature
 * @param {Client} client - Le client Discord
 * @param {object} supabase - Le client Supabase
 * @param {object} application - Les données de la candidature
 * @returns {Promise<string|null>} L'ID du salon créé ou null en cas d'erreur
 */
async function createApplicationChannel(client, supabase, application) {
    try {
        const guild = await client.guilds.fetch(process.env.DISCORD_GUILD_ID);
        if (!guild) {
            console.error('❌ Guild non trouvée');
            return null;
        }

        // Récupérer la config EMS depuis Supabase
        const { data: configs } = await supabase
            .from('config')
            .select('*')
            .in('key', [
                'ems_category_id',
                'ems_recruiter_role_id'
            ]);

        const configMap = {};
        for (const config of configs || []) {
            configMap[config.key] = JSON.parse(config.value);
        }

        // Catégorie et rôle EMS
        const categoryId = configMap.ems_category_id;
        const recruiterRoleId = configMap.ems_recruiter_role_id;

        if (!categoryId) {
            console.error('❌ Catégorie EMS non configurée');
            return null;
        }

        // Nom du salon: prenom-nom (en minuscules, sans accents)
        const channelName = `${application.first_name}-${application.last_name}`
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9-]/g, '-')
            .replace(/-+/g, '-')
            .substring(0, 32);

        // Créer le salon (Pas de queue pour createChannel car c'est une action lourde et unique)
        const channel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: categoryId,
            permissionOverwrites: [
                {
                    id: guild.id,
                    deny: [PermissionFlagsBits.ViewChannel],
                },
                ...(recruiterRoleId ? [{
                    id: recruiterRoleId,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ReadMessageHistory,
                    ],
                }] : []),
            ],
        });

        // Mettre à jour la candidature avec l'ID du salon
        await supabase
            .from('applications')
            .update({ discord_channel_id: channel.id })
            .eq('id', application.id);

        // Envoyer l'embed de bienvenue dans le salon (EMBED - info importante)
        const serviceColor = application.service === 'LSPD' ? 0x3B82F6 : 0xEAB308;

        const welcomeEmbed = new EmbedBuilder()
            .setColor(serviceColor)
            .setTitle(`📋 Nouvelle Candidature ${application.service}`)
            .setDescription(`Une nouvelle candidature a été déposée !`)
            .addFields(
                { name: '👤 Identité', value: `${application.first_name} ${application.last_name}`, inline: true },
                { name: '📅 Date de naissance', value: new Date(application.birth_date).toLocaleDateString('fr-FR'), inline: true },
                { name: '🏙️ Ancienneté en ville', value: application.seniority, inline: true },
                { name: '📝 Motivation', value: application.motivation.length > 500 ? application.motivation.substring(0, 500) + '...' : application.motivation },
                { name: '📆 Disponibilités', value: application.availability },
                { name: '📊 Statut', value: '⏳ En attente d\'examen', inline: true },
                { name: '🔗 Discord', value: `<@${application.users?.discord_id || 'Unknown'}>`, inline: true }
            )
            .setTimestamp()
            .setFooter({ text: `ID: ${application.id}` });

        await messageQueue.sendToChannel(channel, { embeds: [welcomeEmbed] });

        // Boutons d'actions rapides
        const actionRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`vote_pour_${application.id}`)
                    .setLabel('👍 Pour')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`vote_contre_${application.id}`)
                    .setLabel('👎 Contre')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId(`alert_${application.id}`)
                    .setLabel('🔔 Alerte')
                    .setStyle(ButtonStyle.Secondary)
            );

        await messageQueue.sendToChannel(channel, {
            content: '**Actions rapides :**',
            components: [actionRow]
        });

        // Mentionner les recruteurs
        if (recruiterRoleId) {
            await messageQueue.sendToChannel(channel, {
                content: `<@&${recruiterRoleId}> Nouvelle candidature à examiner !`,
                allowedMentions: { roles: [recruiterRoleId] }
            });
        }

        // Bouton pour voir les documents
        const { data: documents } = await supabase
            .from('application_documents')
            .select('type, file_url')
            .eq('application_id', application.id);

        if (documents && documents.length > 0) {
            const docRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`docs_${application.id}`)
                        .setLabel(`📎 Voir les documents (${documents.length})`)
                        .setStyle(ButtonStyle.Secondary)
                );

            await messageQueue.sendToChannel(channel, {
                content: '**Documents fournis :**',
                components: [docRow]
            });
        }

        console.log(`✅ Salon créé: ${channel.name} (${channel.id})`);
        return channel.id;

    } catch (error) {
        console.error('❌ Erreur création salon:', error);
        return null;
    }
}

/**
 * Envoie un message DM au candidat (texte simple)
 * @param {Client} client - Le client Discord
 * @param {string} discordId - L'ID Discord du candidat
 * @param {string} content - Le contenu du message
 * @returns {Promise<boolean>} true si envoyé, false sinon
 */
async function sendSimpleDMToCandidate(client, discordId, content) {
    try {
        const user = await client.users.fetch(discordId);
        await messageQueue.sendToUser(user, { content });
        return true;
    } catch (error) {
        console.error('❌ Erreur envoi DM:', error.message);
        return false;
    }
}

/**
 * Envoie un embed DM au candidat (messages importants)
 * @param {Client} client - Le client Discord
 * @param {string} discordId - L'ID Discord du candidat
 * @param {EmbedBuilder} embed - L'embed à envoyer
 * @returns {Promise<boolean>} true si envoyé, false sinon
 */
async function sendEmbedDMToCandidate(client, discordId, embed) {
    try {
        const user = await client.users.fetch(discordId);
        await messageQueue.sendToUser(user, { embeds: [embed] });
        return true;
    } catch (error) {
        console.error('❌ Erreur envoi DM embed:', error.message);
        return false;
    }
}

/**
 * Envoie le message d'ouverture de candidature (EMBED - info importante)
 * @param {Client} client - Le client Discord
 * @param {object} application - La candidature
 */
async function sendApplicationReceivedDM(client, application) {
    const serviceColor = application.service === 'LSPD' ? 0x3B82F6 : 0xEAB308;

    const embed = new EmbedBuilder()
        .setColor(serviceColor)
        .setTitle(`📬 Candidature Reçue - ${application.service}`)
        .setDescription([
            `Bonjour **${application.first_name}**,`,
            ``,
            `Votre candidature pour le **${application.service}** a bien été reçue et enregistrée.`,
            ``,
            `Notre équipe de recrutement va examiner votre dossier et vous contactera prochainement.`,
            ``,
            `💬 **Vous pouvez répondre directement à ce DM** pour communiquer avec les recruteurs.`
        ].join('\n'))
        .addFields(
            { name: '📋 Référence', value: `\`${application.id.substring(0, 8)}...\``, inline: true },
            { name: '📊 Statut', value: 'En attente', inline: true }
        )
        .setFooter({ text: `${application.service} • Secrétaire Spades` })
        .setTimestamp();

    if (application.users?.discord_id) {
        return sendEmbedDMToCandidate(client, application.users.discord_id, embed);
    }
    return false;
}

module.exports = {
    createApplicationChannel,
    sendSimpleDMToCandidate,
    sendEmbedDMToCandidate,
    sendApplicationReceivedDM
};
