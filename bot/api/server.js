const express = require('express');
const cors = require('cors');
const { EmbedBuilder } = require('discord.js');

/**
 * Crée et démarre le serveur API pour les webhooks du site web
 */
function createApiServer(client, supabase) {
    const app = express();
    const PORT = process.env.BOT_API_PORT || 3001;
    const API_SECRET = process.env.BOT_API_SECRET;

    app.use(cors());
    app.use(express.json());

    // Middleware d'authentification
    const authenticate = (req, res, next) => {
        const authHeader = req.headers.authorization;
        if (!authHeader || authHeader !== `Bearer ${API_SECRET}`) {
            return res.status(401).json({ error: 'Non autorisé' });
        }
        next();
    };

    // Health check
    app.get('/health', (req, res) => {
        res.json({ status: 'ok', bot: client.isReady() ? 'connected' : 'disconnected' });
    });

    // Récupérer le displayName d'un membre du serveur
    app.get('/api/member/:discordId', authenticate, async (req, res) => {
        try {
            const { discordId } = req.params;
            const guildId = process.env.DISCORD_GUILD_ID;

            if (!guildId) {
                return res.status(500).json({ error: 'Guild ID non configuré' });
            }

            const guild = await client.guilds.fetch(guildId);
            const member = await guild.members.fetch(discordId);

            res.json({
                displayName: member.displayName,
                username: member.user.username,
                nickname: member.nickname
            });
        } catch (error) {
            console.error('[API] Member fetch error:', error.message);
            res.status(404).json({ error: 'Membre non trouvé' });
        }
    });

    // Envoyer un vote + embed sur Discord
    app.post('/api/vote', authenticate, async (req, res) => {
        try {
            const { applicationId, channelId, voterName, vote, comment } = req.body;

            if (!applicationId || !channelId || !voterName || vote === undefined) {
                return res.status(400).json({ error: 'Paramètres manquants' });
            }

            const channel = await client.channels.fetch(channelId);
            if (!channel) {
                return res.status(404).json({ error: 'Salon Discord non trouvé' });
            }

            // Récupérer tous les votes pour le récapitulatif
            const { data: votes } = await supabase
                .from('application_votes')
                .select('voter_name, vote, comment')
                .eq('application_id', applicationId);

            const { data: app } = await supabase
                .from('applications')
                .select('first_name, last_name, service')
                .eq('id', applicationId)
                .single();

            const votesFor = votes?.filter(v => v.vote) || [];
            const votesAgainst = votes?.filter(v => !v.vote) || [];
            const total = votesFor.length + votesAgainst.length;
            const ratio = total > 0 ? Math.round((votesFor.length / total) * 100) : 0;

            // Créer l'embed
            const embed = new EmbedBuilder()
                .setTitle('📊 RÉCAPITULATIF DES VOTES')
                .setColor(ratio >= 50 ? 0x22c55e : 0xef4444)
                .addFields(
                    {
                        name: 'Candidat',
                        value: `${app?.first_name || 'N/A'} ${app?.last_name || ''}`,
                        inline: true
                    },
                    {
                        name: 'Service',
                        value: app?.service || 'N/A',
                        inline: true
                    },
                    {
                        name: 'Ratio',
                        value: `**${ratio}%** favorable`,
                        inline: true
                    },
                    {
                        name: `👍 Pour (${votesFor.length})`,
                        value: votesFor.length > 0
                            ? votesFor.map(v => `• ${v.voter_name}${v.comment ? ` - "${v.comment}"` : ''}`).join('\n')
                            : 'Aucun vote',
                        inline: false
                    },
                    {
                        name: `👎 Contre (${votesAgainst.length})`,
                        value: votesAgainst.length > 0
                            ? votesAgainst.map(v => `• ${v.voter_name}${v.comment ? ` - "${v.comment}"` : ''}`).join('\n')
                            : 'Aucun vote',
                        inline: false
                    }
                )
                .setFooter({ text: `Nouveau vote de ${voterName} via le site web` })
                .setTimestamp();

            await channel.send({ embeds: [embed] });

            res.json({ success: true });
        } catch (error) {
            console.error('[API] Vote error:', error);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    });

    // Envoyer un message au candidat via DM
    app.post('/api/message', authenticate, async (req, res) => {
        try {
            const { applicationId, channelId, candidateDiscordId, senderName, content } = req.body;

            if (!applicationId || !candidateDiscordId || !senderName || !content) {
                return res.status(400).json({ error: 'Paramètres manquants' });
            }

            // Récupérer le service de la candidature
            const { data: app } = await supabase
                .from('applications')
                .select('service')
                .eq('id', applicationId)
                .single();

            const service = app?.service || 'RECRUTEMENT';

            // Format identique à /message : **[SERVICE]** senderName:
            const dmMessage = `**[${service}]** ${senderName}:\n${content}`;

            // Envoyer le DM au candidat
            try {
                const user = await client.users.fetch(candidateDiscordId);
                await user.send(dmMessage);
            } catch (dmError) {
                console.error('[API] DM error:', dmError);
                return res.status(400).json({ error: 'Impossible d\'envoyer le DM au candidat' });
            }

            // Poster dans le salon Discord de la candidature
            if (channelId) {
                try {
                    const channel = await client.channels.fetch(channelId);
                    if (channel) {
                        // Récupérer le numéro de message
                        const { count } = await supabase
                            .from('application_messages')
                            .select('*', { count: 'exact', head: true })
                            .eq('application_id', applicationId)
                            .eq('is_from_candidate', false);

                        const messageNumber = count || 1;

                        // Format: `(numéro)` **Displayname** - message
                        await channel.send(`\`(${messageNumber})\` **${senderName}** - ${content}`);
                    }
                } catch {
                    // Ignorer si le salon n'existe plus
                }
            }

            res.json({ success: true });
        } catch (error) {
            console.error('[API] Message error:', error);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    });

    // Envoyer un embed de changement de statut
    app.post('/api/status', authenticate, async (req, res) => {
        try {
            const { channelId, newStatus, actorName } = req.body;

            if (!channelId || !newStatus || !actorName) {
                return res.status(400).json({ error: 'Paramètres manquants' });
            }

            const channel = await client.channels.fetch(channelId);
            if (!channel) {
                return res.status(404).json({ error: 'Salon Discord non trouvé' });
            }

            const statusLabels = {
                'pending': '⏳ En attente',
                'reviewing': '📝 En examen',
                'interview_scheduled': '📅 Entretien planifié',
                'interview_passed': '✅ Entretien réussi',
                'interview_failed': '❌ Entretien échoué',
                'training': '🎓 Formation',
                'recruited': '🎉 Recruté',
                'rejected': '🚫 Refusé'
            };

            const embed = new EmbedBuilder()
                .setTitle('📋 CHANGEMENT DE STATUT')
                .setColor(0x8b5cf6)
                .setDescription(`Le statut a été modifié par **${actorName}** via le site web.`)
                .addFields({
                    name: 'Nouveau statut',
                    value: statusLabels[newStatus] || newStatus,
                    inline: false
                })
                .setTimestamp();

            await channel.send({ embeds: [embed] });

            res.json({ success: true });
        } catch (error) {
            console.error('[API] Status error:', error);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    });

    // Notification de retrait de candidature
    app.post('/api/withdrawal', authenticate, async (req, res) => {
        try {
            const { channelId, candidateDiscordId, candidateName, service } = req.body;

            if (!channelId || !candidateDiscordId || !candidateName || !service) {
                return res.status(400).json({ error: 'Paramètres manquants' });
            }

            // Envoyer un message dans le salon Discord
            try {
                const channel = await client.channels.fetch(channelId);
                if (channel) {
                    const embed = new EmbedBuilder()
                        .setColor(0xFFA500) // Orange
                        .setTitle('📤 Candidature Retirée')
                        .setDescription(`**${candidateName}** a retiré sa candidature.`)
                        .addFields(
                            { name: 'Service', value: service, inline: true },
                            { name: 'Action', value: 'Le candidat a volontairement retiré son dossier', inline: false }
                        )
                        .setFooter({ text: 'Ce salon sera archivé' })
                        .setTimestamp();

                    await channel.send({ embeds: [embed] });
                }
            } catch (channelError) {
                console.error('[API] Channel error:', channelError.message);
            }

            // Envoyer un DM au candidat
            try {
                const user = await client.users.fetch(candidateDiscordId);
                if (user) {
                    const dmEmbed = new EmbedBuilder()
                        .setColor(0xFFA500)
                        .setTitle(`📤 Candidature Retirée - ${service}`)
                        .setDescription(`Bonjour **${candidateName.split(' ')[0]}**,\n\nVotre candidature pour le **${service}** a bien été retirée.\n\nSi vous changez d'avis, vous pouvez soumettre une nouvelle candidature à tout moment.`)
                        .setFooter({ text: `${service} • Secrétaire Spades` })
                        .setTimestamp();

                    await user.send({ embeds: [dmEmbed] });
                }
            } catch (dmError) {
                console.error('[API] DM error:', dmError.message);
            }

            res.json({ success: true });
        } catch (error) {
            console.error('[API] Withdrawal error:', error);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    });

    // Clôture de candidature (recruté/refusé)
    app.post('/api/close', authenticate, async (req, res) => {
        try {
            const { applicationId, decision, reason, candidateName, service, channelId, candidateDiscordId } = req.body;

            if (!applicationId || !decision || !candidateName || !service) {
                return res.status(400).json({ error: 'Paramètres manquants' });
            }

            const isRecruited = decision === 'recruited';
            const statusEmoji = isRecruited ? '✅' : '❌';
            const statusText = isRecruited ? 'Recruté(e)' : 'Refusé(e)';
            const color = isRecruited ? 0x00FF00 : 0xFF0000;

            // Récupérer les infos si pas fournies
            let targetChannelId = channelId;
            let targetCandidateId = candidateDiscordId;

            if (!targetChannelId || !targetCandidateId) {
                const { data: app } = await supabase
                    .from('applications')
                    .select('discord_channel_id, users(discord_id)')
                    .eq('id', applicationId)
                    .single();

                if (app) {
                    targetChannelId = targetChannelId || app.discord_channel_id;
                    const userData = app.users;
                    if (userData && typeof userData === 'object' && 'discord_id' in userData) {
                        targetCandidateId = targetCandidateId || userData.discord_id;
                    }
                }
            }

            // Envoyer un DM au candidat
            if (targetCandidateId) {
                try {
                    const user = await client.users.fetch(targetCandidateId);
                    if (user) {
                        let description = `Bonjour **${candidateName.split(' ')[0]}**,\n\n`;

                        if (isRecruited) {
                            description += `🎉 Félicitations ! Votre candidature au **${service}** a été **acceptée** !\n\nUn recruteur vous contactera prochainement pour la suite des démarches.`;
                        } else {
                            description += `Nous avons le regret de vous informer que votre candidature au **${service}** n'a pas été retenue.`;
                            if (reason) {
                                description += `\n\n**Motif :** ${reason}`;
                            }
                            description += `\n\nNous vous remercions pour l'intérêt porté et vous souhaitons bonne continuation.`;
                        }

                        const dmEmbed = new EmbedBuilder()
                            .setColor(color)
                            .setTitle(`${statusEmoji} Candidature ${statusText} - ${service}`)
                            .setDescription(description)
                            .setFooter({ text: `${service} • Secrétaire Spades` })
                            .setTimestamp();

                        await user.send({ embeds: [dmEmbed] });
                    }
                } catch (dmError) {
                    console.error('[API] DM error:', dmError.message);
                }
            }

            // Envoyer un message dans le salon Discord avec bouton de fermeture
            if (targetChannelId) {
                try {
                    const channel = await client.channels.fetch(targetChannelId);
                    if (channel) {
                        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

                        const embed = new EmbedBuilder()
                            .setColor(color)
                            .setTitle(`${statusEmoji} Candidature Clôturée`)
                            .setDescription(`**${candidateName}** a été ${statusText.toLowerCase()}.`)
                            .addFields(
                                { name: 'Service', value: service, inline: true },
                                { name: 'Décision', value: statusText, inline: true }
                            )
                            .setTimestamp();

                        if (reason) {
                            embed.addFields({ name: 'Motif', value: reason, inline: false });
                        }

                        const row = new ActionRowBuilder()
                            .addComponents(
                                new ButtonBuilder()
                                    .setCustomId(`close_channel_${applicationId}`)
                                    .setLabel('Fermer le salon')
                                    .setStyle(ButtonStyle.Danger)
                                    .setEmoji('🔒')
                            );

                        await channel.send({ embeds: [embed], components: [row] });
                    }
                } catch (channelError) {
                    console.error('[API] Channel error:', channelError.message);
                }
            }

            res.json({ success: true });
        } catch (error) {
            console.error('[API] Close error:', error);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    });

    app.listen(PORT, () => {
        console.log(`🌐 API Server running on port ${PORT}`);
    });

    return app;
}

module.exports = { createApiServer };
