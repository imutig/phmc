require('dotenv').config();
const { Client, GatewayIntentBits, Collection, REST, Routes, Partials } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');
const fs = require('node:fs');
const path = require('node:path');
const { createApplicationChannel, sendApplicationReceivedDM } = require('./services/applicationService');
const { createApiServer } = require('./api/server');
const log = require('./utils/logger');

// Configuration
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel, Partials.Message]
});

// Supabase client avec service key (full access)
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

// Collection pour les commandes
client.commands = new Collection();

// Garder trace des IDs de candidatures déjà traitées
const processedApplications = new Set();

// Chargement des commandes
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

const commands = [];
for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        commands.push(command.data.toJSON());
        log.command(command.data.name);
    }
}

// Chargement des events
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);

    // Contexte partagé pour les events
    const context = {
        supabase,
        client,
        registerCommands,
        checkConfiguration,
        setupRealtimeListener,
        checkNewApplications,
        startApiServer
    };

    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, context));
    } else {
        client.on(event.name, (...args) => event.execute(...args, context));
    }
}

async function registerCommands(clientInstance) {
    const rest = new REST().setToken(process.env.DISCORD_TOKEN);

    try {
        log.info('Enregistrement des slash commands...');

        await rest.put(
            Routes.applicationGuildCommands(clientInstance.user.id, process.env.DISCORD_GUILD_ID),
            { body: commands }
        );

        log.success('Slash commands enregistrées');
    } catch (error) {
        log.error(`Erreur enregistrement commandes: ${error.message}`);
    }
}

async function checkNewApplications() {
    try {
        const { data: applications, error } = await supabase
            .from('applications')
            .select('*, users(discord_id, discord_username)')
            .is('discord_channel_id', null)
            .eq('status', 'pending')
            .order('created_at', { ascending: true });

        if (error) {
            log.error(`Erreur vérification candidatures: ${error.message}`);
            return;
        }

        if (!applications || applications.length === 0) {
            return;
        }

        for (const application of applications) {
            if (processedApplications.has(application.id)) {
                continue;
            }

            processedApplications.add(application.id);
            log.realtime(`Candidature: ${application.first_name} ${application.last_name}`);

            await handleNewApplication(application);
        }

    } catch (error) {
        log.error(`Erreur polling: ${error.message}`);
    }
}

async function handleNewApplication(application) {
    try {
        const channelId = await createApplicationChannel(client, supabase, application);

        if (channelId) {
            log.success(`Salon créé pour ${application.first_name} ${application.last_name}`);

            if (application.users?.discord_id) {
                const dmSent = await sendApplicationReceivedDM(client, application);
                if (dmSent) {
                    log.discord(`DM envoyé à ${application.users.discord_username}`);
                } else {
                    log.warn(`Impossible d'envoyer le DM à ${application.users.discord_username}`);
                }
            }
        } else {
            log.warn(`Échec création salon pour ${application.first_name} - vérifiez /setup categorie`);
        }

    } catch (error) {
        log.error(`Erreur traitement candidature: ${error.message}`);
    }
}

function setupRealtimeListener() {
    log.section('Realtime');

    const channel = supabase
        .channel('applications-changes')
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'applications'
            },
            async (payload) => {
                log.realtime(`Nouvelle candidature: ${payload.new.id}`);

                const { data: fullApp, error } = await supabase
                    .from('applications')
                    .select('*, users(discord_id, discord_username)')
                    .eq('id', payload.new.id)
                    .single();

                if (!error && fullApp && !processedApplications.has(fullApp.id)) {
                    processedApplications.add(fullApp.id);
                    await handleNewApplication(fullApp);
                }
            }
        )
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                log.success('Realtime actif - En attente de candidatures');
            }
        });

    return channel;
}

function startApiServer(clientInstance) {
    if (process.env.BOT_API_SECRET) {
        createApiServer(clientInstance, supabase);
    } else {
        log.warn('BOT_API_SECRET non configuré - API désactivée');
    }
}

function checkConfiguration() {
    const requiredEnvVars = [
        'DISCORD_TOKEN',
        'DISCORD_GUILD_ID',
        'SUPABASE_URL',
        'SUPABASE_SERVICE_KEY'
    ];

    let hasErrors = false;

    for (const envVar of requiredEnvVars) {
        if (!process.env[envVar]) {
            log.error(`Variable manquante: ${envVar}`);
            hasErrors = true;
        }
    }

    if (hasErrors) {
        log.error('Configuration incomplète. Vérifiez votre fichier .env');
    } else {
        log.success('Configuration validée');
    }
}

// Démarrage
client.login(process.env.DISCORD_TOKEN);
