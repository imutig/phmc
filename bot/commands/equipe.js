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
