const {
    SlashCommandBuilder,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    ButtonBuilder,
    ActionRowBuilder,
    ButtonStyle,
    MessageFlags
} = require('discord.js');

// Stockage des messages live pour mise à jour (en mémoire + base de données)
const liveMessages = new Map();

const GRADE_DISPLAY = {
    direction: { name: 'Direction', emoji: '👑' },
    chirurgien: { name: 'Chirurgien', emoji: '🔬' },
    medecin: { name: 'Médecin', emoji: '⚕️' },
    infirmier: { name: 'Infirmier', emoji: '💉' },
    ambulancier: { name: 'Ambulancier', emoji: '🚑' }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('equipe')
        .setDescription('Affiche les médecins actuellement en service (mise à jour en temps réel)'),

    // Export pour accès depuis d'autres fichiers
    liveMessages,
    updateLiveMessages,
    loadLiveMessagesFromDB,

    async execute(interaction) {
        const supabase = interaction.supabase;

        await interaction.deferReply();

        // Construire et envoyer le message initial
        const messageData = await buildLiveMessage(supabase, interaction.guild);

        const reply = await interaction.editReply(messageData);

        // Stocker la référence du message pour mise à jour (mémoire)
        const msgData = {
            channelId: reply.channelId,
            guildId: interaction.guild.id,
            messageId: reply.id,
            client: interaction.client,
            supabase: supabase
        };
        liveMessages.set(reply.id, msgData);

        // Stocker en base de données pour persistance
        await saveLiveMessageToDB(supabase, {
            channelId: reply.channelId,
            guildId: interaction.guild.id,
            messageId: reply.id
        });

        // Auto-suppression après 30 minutes
        setTimeout(async () => {
            liveMessages.delete(reply.id);
            await removeLiveMessageFromDB(supabase, reply.id);
        }, 30 * 60 * 1000);
    }
};

// Sauvegarder une référence de message live en base
async function saveLiveMessageToDB(supabase, data) {
    try {
        // Récupérer les messages existants
        const { data: existing } = await supabase
            .from('config')
            .select('value')
            .eq('key', 'live_equipe_messages')
            .single();

        let messages = [];
        if (existing?.value) {
            try {
                messages = JSON.parse(existing.value);
            } catch (e) {
                messages = [];
            }
        }

        // Ajouter le nouveau message
        messages.push(data);

        // Garder seulement les 10 derniers pour éviter l'accumulation
        messages = messages.slice(-10);

        // Upsert
        await supabase
            .from('config')
            .upsert({
                key: 'live_equipe_messages',
                value: JSON.stringify(messages)
            }, { onConflict: 'key' });
    } catch (error) {
        console.error('Erreur sauvegarde live message:', error);
    }
}

// Supprimer une référence de message live de la base
async function removeLiveMessageFromDB(supabase, messageId) {
    try {
        const { data: existing } = await supabase
            .from('config')
            .select('value')
            .eq('key', 'live_equipe_messages')
            .single();

        if (existing?.value) {
            let messages = JSON.parse(existing.value);
            messages = messages.filter(m => m.messageId !== messageId);

            await supabase
                .from('config')
                .upsert({
                    key: 'live_equipe_messages',
                    value: JSON.stringify(messages)
                }, { onConflict: 'key' });
        }
    } catch (error) {
        console.error('Erreur suppression live message:', error);
    }
}

// Charger les messages live depuis la base au démarrage
async function loadLiveMessagesFromDB(client, supabase) {
    try {
        const { data: existing } = await supabase
            .from('config')
            .select('value')
            .eq('key', 'live_equipe_messages')
            .single();

        if (!existing?.value) return;

        const messages = JSON.parse(existing.value);
        const validMessages = [];

        for (const msg of messages) {
            try {
                const channel = await client.channels.fetch(msg.channelId);
                if (!channel) continue;

                const message = await channel.messages.fetch(msg.messageId).catch(() => null);
                if (!message) continue;

                // Message existe encore, l'ajouter au Map
                liveMessages.set(msg.messageId, {
                    channelId: msg.channelId,
                    guildId: msg.guildId,
                    messageId: msg.messageId,
                    client: client,
                    supabase: supabase
                });

                validMessages.push(msg);
            } catch (error) {
                // Message n'existe plus, l'ignorer
            }
        }

        // Mettre à jour la base avec seulement les messages valides
        if (validMessages.length !== messages.length) {
            await supabase
                .from('config')
                .upsert({
                    key: 'live_equipe_messages',
                    value: JSON.stringify(validMessages)
                }, { onConflict: 'key' });
        }

        console.log(`✓ ${validMessages.length} message(s) live /equipe restauré(s)`);
    } catch (error) {
        console.error('Erreur chargement live messages:', error);
    }
}

async function buildLiveMessage(supabase, guild) {
    // Récupérer les services en cours
    const { data: liveServices, error } = await supabase
        .from('services')
        .select('*')
        .is('end_time', null)
        .order('start_time', { ascending: true });

    if (error) {
        console.error('Erreur récupération services live:', error);
    }

    const now = new Date();
    const services = liveServices || [];

    // Formatage de la durée
    const formatDuration = (startTime) => {
        const start = new Date(startTime).getTime();
        const diffMs = now.getTime() - start;
        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        return hours > 0 ? `${hours}h${minutes.toString().padStart(2, '0')}` : `${minutes}min`;
    };

    // Construire le container Components V2
    const container = new ContainerBuilder()
        .setAccentColor(0x22C55E)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`# <a:green_dot:1452045357914525940> Équipe en Service`)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`*${services.length} membre${services.length > 1 ? 's' : ''} actif${services.length > 1 ? 's' : ''} • Mise à jour en temps réel*`)
        )
        .addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    if (services.length === 0) {
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`\n😴 **Aucun médecin en service actuellement**\n\n*Utilisez le bouton de prise de service sur l'intranet pour commencer.*`)
        );
    } else {
        // Grouper par grade pour un affichage ordonné
        const byGrade = {};
        for (const service of services) {
            const grade = service.grade_name || 'ambulancier';
            if (!byGrade[grade]) byGrade[grade] = [];
            byGrade[grade].push(service);
        }

        // Ordre d'affichage
        const gradeOrder = ['direction', 'chirurgien', 'medecin', 'infirmier', 'ambulancier'];

        for (const grade of gradeOrder) {
            const gradeServices = byGrade[grade];
            if (!gradeServices) continue;

            const gradeInfo = GRADE_DISPLAY[grade] || { name: grade, emoji: '👤' };

            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`### ${gradeInfo.emoji} ${gradeInfo.name}`)
            );

            for (const service of gradeServices) {
                const duration = formatDuration(service.start_time);
                container.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`• **${service.user_name}** — en service depuis ${duration}`)
                );
            }
        }
    }

    // === Graphique d'activité des dernières 12 heures ===
    const hourlyActivity = await getHourlyActivity(supabase);
    if (hourlyActivity.length > 0) {
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`### 📊 Activité (12 dernières heures)`)
        );

        const maxCount = Math.max(...hourlyActivity.map(h => h.count), 1);
        const graphLines = [];
        for (const hour of hourlyActivity) {
            const barLength = Math.round((hour.count / maxCount) * 8);
            const bar = '█'.repeat(barLength) + '░'.repeat(8 - barLength);
            graphLines.push(`\`${hour.label}\` ${bar} ${hour.count}`);
        }
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(graphLines.join('\n'))
        );
    }

    // === Top 3 de la semaine ===
    const topPerformers = await getWeeklyTopPerformers(supabase);
    if (topPerformers.length > 0) {
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`### 🏆 Top 3 de la semaine`)
        );

        const medals = ['🥇', '🥈', '🥉'];
        const leaderboardLines = topPerformers.slice(0, 3).map((p, i) => {
            const hours = Math.floor(p.total_minutes / 60);
            const mins = p.total_minutes % 60;
            return `${medals[i]} **${p.user_name}** — ${hours}h${mins.toString().padStart(2, '0')}`;
        });
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(leaderboardLines.join('\n'))
        );
    }

    // Boutons de prise de service
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(false));
    const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('equipe_start_service')
            .setLabel('Prendre mon service')
            .setEmoji('🟢')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('equipe_end_service')
            .setLabel('Fin de service')
            .setEmoji('🔴')
            .setStyle(ButtonStyle.Danger)
    );
    container.addActionRowComponents(actionRow);

    // Footer avec timestamp
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(false));
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`-# Dernière mise à jour: <t:${Math.floor(Date.now() / 1000)}:R>`)
    );

    return {
        components: [container],
        flags: MessageFlags.IsComponentsV2
    };
}

// Récupérer l'activité horaire des 12 dernières heures
async function getHourlyActivity(supabase) {
    const now = new Date();
    const hours = [];

    for (let i = 11; i >= 0; i--) {
        const hourStart = new Date(now);
        hourStart.setHours(now.getHours() - i, 0, 0, 0);
        const hourEnd = new Date(hourStart);
        hourEnd.setHours(hourEnd.getHours() + 1);

        hours.push({
            label: `${hourStart.getHours().toString().padStart(2, '0')}h`,
            start: hourStart.toISOString(),
            end: hourEnd.toISOString(),
            count: 0
        });
    }

    // Récupérer les services actifs pendant ces heures
    const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString();

    const { data: services } = await supabase
        .from('services')
        .select('start_time, end_time')
        .gte('start_time', twelveHoursAgo)
        .order('start_time');

    if (!services) return hours;

    // Compter combien de services étaient actifs à chaque heure
    for (const hour of hours) {
        const hourStart = new Date(hour.start).getTime();
        const hourEnd = new Date(hour.end).getTime();

        for (const service of services) {
            const serviceStart = new Date(service.start_time).getTime();
            const serviceEnd = service.end_time ? new Date(service.end_time).getTime() : now.getTime();

            // Le service était-il actif pendant cette heure ?
            if (serviceStart < hourEnd && serviceEnd > hourStart) {
                hour.count++;
            }
        }
    }

    return hours;
}

// Récupérer les top performers de la semaine
async function getWeeklyTopPerformers(supabase) {
    // Calculer le début de la semaine ISO
    const now = new Date();
    const dayOfWeek = now.getDay() || 7; // Dimanche = 7
    const monday = new Date(now);
    monday.setDate(now.getDate() - dayOfWeek + 1);
    monday.setHours(0, 0, 0, 0);

    const { data: services } = await supabase
        .from('services')
        .select('user_discord_id, user_name, duration_minutes')
        .gte('start_time', monday.toISOString())
        .not('end_time', 'is', null);

    if (!services || services.length === 0) return [];

    // Agréger par utilisateur
    const userTotals = {};
    for (const service of services) {
        if (!userTotals[service.user_discord_id]) {
            userTotals[service.user_discord_id] = {
                user_name: service.user_name,
                total_minutes: 0
            };
        }
        userTotals[service.user_discord_id].total_minutes += service.duration_minutes || 0;
    }

    // Trier et retourner top 3
    return Object.values(userTotals)
        .sort((a, b) => b.total_minutes - a.total_minutes)
        .slice(0, 3);
}

// Fonction pour mettre à jour tous les messages live
async function updateLiveMessages() {
    for (const [messageId, data] of liveMessages) {
        try {
            const channel = await data.client.channels.fetch(data.channelId);
            if (!channel) {
                liveMessages.delete(messageId);
                continue;
            }

            const message = await channel.messages.fetch(messageId).catch(() => null);
            if (!message) {
                liveMessages.delete(messageId);
                await removeLiveMessageFromDB(data.supabase, messageId);
                continue;
            }

            const guild = await data.client.guilds.fetch(data.guildId);
            const messageData = await buildLiveMessage(data.supabase, guild);

            await message.edit(messageData);
        } catch (error) {
            console.error('Erreur mise à jour message live:', error);
            liveMessages.delete(messageId);
        }
    }
}

// Exporter la fonction de build pour usage externe
module.exports.buildLiveMessage = buildLiveMessage;

