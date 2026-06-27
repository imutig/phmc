require('dotenv').config();
const { Client, GatewayIntentBits, Collection, REST, Routes, Partials } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');
const fs = require('node:fs');
const path = require('node:path');
const { createApplicationChannel, sendApplicationReceivedDM } = require('./services/applicationService');
const { createAppointmentChannel, sendAppointmentReceivedDM } = require('./services/appointmentService');
const { createApiServer } = require('./api/server');
const log = require('./utils/logger');
const equipeCommand = require('./commands/equipe');
const { initPointeuseListener } = require('./listeners/pointeuseListener');

// Garder trace des IDs de rendez-vous déjà traités
const processedAppointments = new Set();

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
        setupLiveServicesListener,
        checkNewApplications,
        startApiServer,
        startReminderChecker,
        initPointeuseListener
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
        log.info(`Enregistrement de ${commands.length} slash commands pour la guilde ${process.env.DISCORD_GUILD_ID}...`);

        await rest.put(
            Routes.applicationGuildCommands(clientInstance.user.id, process.env.DISCORD_GUILD_ID),
            { body: commands }
        );

        log.success('Slash commands enregistrées avec succès !');
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

    // Listener pour les rendez-vous
    supabase
        .channel('appointments-changes')
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'appointments'
            },
            async (payload) => {
                log.realtime(`Nouveau rendez-vous: ${payload.new.id}`);

                // Vérifier si déjà traité
                if (processedAppointments.has(payload.new.id)) return;
                processedAppointments.add(payload.new.id);

                // Récupérer les données complètes
                const { data: appointment, error: appError } = await supabase
                    .from('appointments')
                    .select('*')
                    .eq('id', payload.new.id)
                    .single();

                if (appError || !appointment) return;

                const { data: patient, error: patientError } = await supabase
                    .from('patients')
                    .select('*')
                    .eq('id', appointment.patient_id)
                    .single();

                if (patientError || !patient) return;

                // Envoyer le DM de confirmation au patient (sans créer de salon)
                const dmSent = await sendAppointmentReceivedDM(client, supabase, appointment, patient);
                if (dmSent) {
                    log.discord(`DM envoyé à ${appointment.discord_username}`);
                } else {
                    log.warn(`Impossible d'envoyer le DM à ${appointment.discord_username}`);
                }
            }
        )
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                log.success('Realtime actif - En attente de rendez-vous');
            }
        });

    return channel;
}

function setupLiveServicesListener() {
    log.section('Live Services');

    const channel = supabase
        .channel('live-services-changes')
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'services'
            },
            async (payload) => {
                // On met à jour si :
                // - Nouveau service (INSERT)
                // - Fin de service (UPDATE avec end_time qui change)
                // - Service supprimé/annulé (DELETE)
                if (payload.eventType === 'INSERT' ||
                    payload.eventType === 'DELETE' ||
                    (payload.eventType === 'UPDATE' && payload.new.end_time !== payload.old?.end_time)) {

                    log.realtime(`Service update: ${payload.eventType}`);
                    // Mettre à jour tous les messages /equipe
                    await equipeCommand.updateLiveMessages();
                }
            }
        )
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                log.success('Live services listener actif');
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

// Set pour éviter d'envoyer plusieurs rappels pour le même RDV
const sentReminders = new Set();
const sentConvocationReminders = new Set();

// Vérifier les RDV à rappeler (5 min avant)
async function checkAppointmentReminders() {
    try {
        const now = new Date();
        const fiveMinLater = new Date(now.getTime() + 5 * 60 * 1000);
        const sixMinLater = new Date(now.getTime() + 6 * 60 * 1000);

        // Récupérer les RDV programmés dans les 5-6 prochaines minutes
        const { data: appointments, error } = await supabase
            .from('appointments')
            .select('*, patients(*)')
            .eq('status', 'scheduled')
            .gte('scheduled_date', fiveMinLater.toISOString())
            .lt('scheduled_date', sixMinLater.toISOString());

        if (error || !appointments) return;

        for (const appointment of appointments) {
            // Éviter les doublons
            if (sentReminders.has(appointment.id)) continue;
            sentReminders.add(appointment.id);

            const scheduledDate = new Date(appointment.scheduled_date);
            const { EmbedBuilder } = require('discord.js');

            // Rappel au patient
            try {
                const patientUser = await client.users.fetch(appointment.discord_id);
                const patientEmbed = new EmbedBuilder()
                    .setColor(0xF59E0B)
                    .setTitle('⏰ Rappel: Rendez-vous dans 5 minutes !')
                    .setDescription([
                        `Bonjour,`,
                        ``,
                        `Votre rendez-vous est prévu dans **5 minutes**.`,
                        ``,
                        `📅 **Date:** ${scheduledDate.toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })}`,
                        ``,
                        `Préparez-vous !`
                    ].join('\n'))
                    .setTimestamp();

                await patientUser.send({ embeds: [patientEmbed] });
                log.info(`Rappel patient envoyé pour RDV ${appointment.id}`);
            } catch (dmError) {
                log.warn(`Rappel patient échoué pour ${appointment.id}`);
            }

            // Rappel au médecin assigné (si différent du patient)
            if (appointment.assigned_to && appointment.assigned_to !== appointment.discord_id) {
                try {
                    const staffUser = await client.users.fetch(appointment.assigned_to);
                    const patient = appointment.patients;
                    const patientName = patient ? `${patient.first_name} ${patient.last_name}` : 'Patient';

                    const staffEmbed = new EmbedBuilder()
                        .setColor(0xF59E0B)
                        .setTitle('⏰ Rappel: Rendez-vous dans 5 minutes !')
                        .setDescription([
                            `Bonjour,`,
                            ``,
                            `Votre rendez-vous avec **${patientName}** est prévu dans **5 minutes**.`,
                            ``,
                            `📅 **Date:** ${scheduledDate.toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })}`,
                            `📋 **Motif:** ${appointment.reason_category || 'Non précisé'}`,
                        ].join('\n'))
                        .setTimestamp();

                    await staffUser.send({ embeds: [staffEmbed] });
                    log.info(`Rappel staff envoyé pour RDV ${appointment.id}`);
                } catch (dmError) {
                    log.warn(`Rappel staff échoué pour ${appointment.id}`);
                }
            }

            // Message dans le canal Discord du RDV avec ping du staff
            if (appointment.discord_channel_id) {
                try {
                    const channel = await client.channels.fetch(appointment.discord_channel_id);
                    if (channel) {
                        const embed = new EmbedBuilder()
                            .setColor(0xF59E0B)
                            .setTitle('⏰ Rappel: Rendez-vous dans 5 minutes !')
                            .setDescription(`Le rendez-vous prévu à ${scheduledDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} commence bientôt !`)
                            .setTimestamp();

                        // Ping le staff assigné s'il existe
                        const pingContent = appointment.assigned_to
                            ? `<@${appointment.assigned_to}> 📢 **Rappel !**`
                            : '📢 **Rappel !**';

                        await channel.send({ content: pingContent, embeds: [embed] });
                    }
                } catch (channelError) {
                    // Canal supprimé ou inaccessible
                }
            }
        }

        // Nettoyer les anciens rappels (plus de 10 minutes)
        const twentyMinAgo = new Date(now.getTime() - 20 * 60 * 1000);
        for (const id of sentReminders) {
            // On pourrait vérifier en BDD si le RDV est passé, mais ici on garde simple
            // et on laisse le Set grandir un peu (sera reset au redémarrage)
        }

    } catch (error) {
        log.error(`Erreur rappels RDV: ${error.message}`);
    }
}

async function checkConvocationReminders() {
    try {
        const now = new Date();
        const reminderWindowStart = new Date(now.getTime() + 58 * 60 * 1000);
        const reminderWindowEnd = new Date(now.getTime() + 62 * 60 * 1000);

        const { data: events, error } = await supabase
            .from('events')
            .select(`
                id,
                title,
                description,
                location,
                event_date,
                start_time,
                event_participants (
                    user_discord_id,
                    user_name
                )
            `)
            .eq('event_type', 'rdv')
            .ilike('description', '%via Ticket%')
            .is('deleted_at', null)
            .eq('is_published', true);

        if (error) {
            log.error(`[ConvocationReminder] Erreur query events: ${error.message}`);
            return;
        }

        if (!events || events.length === 0) {
            return;
        }

        for (const event of events) {
            const convocationType = parseConvocationTypeFromDescription(event.description);
            if (!convocationType) {
                continue;
            }

            const scheduledDate = buildEventDateTime(event.event_date, event.start_time);
            if (!scheduledDate) {
                log.warn(`[ConvocationReminder] Event ${event.id} ignoré: date invalide (event_date=${event.event_date}, start_time=${event.start_time})`);
                continue;
            }

            if (scheduledDate < reminderWindowStart || scheduledDate >= reminderWindowEnd) {
                continue;
            }

            const participants = event.event_participants || [];
            if (participants.length === 0) {
                log.warn(`[ConvocationReminder] Event ${event.id} sans participant - aucun DM envoyé.`);
            }

            for (const participant of participants) {
                if (!participant?.user_discord_id) continue;

                const reminderKey = `${event.id}:${participant.user_discord_id}`;
                if (sentConvocationReminders.has(reminderKey)) {
                    continue;
                }

                sentConvocationReminders.add(reminderKey);

                try {
                    const user = await client.users.fetch(participant.user_discord_id);
                    const { EmbedBuilder } = require('discord.js');
                    const reminderEmbed = new EmbedBuilder()
                        .setColor(0xF59E0B)
                        .setTitle(convocationType === 'staff'
                            ? '⏰ Rappel: Convocation interne dans 1 heure'
                            : '⏰ Rappel: Rendez-vous médical dans 1 heure')
                        .setDescription([
                            `Bonjour,`,
                            ``,
                            convocationType === 'staff'
                                ? `Votre convocation interne est prévue dans **1 heure**.`
                                : `Votre rendez-vous médical est prévu dans **1 heure**.`,
                            ``,
                            `📅 **Date:** ${scheduledDate.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' })}`,
                            `🕐 **Heure:** ${scheduledDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })}`,
                            `📍 **Lieu:** ${event.location || 'Non précisé'}`,
                            ``,
                            `Merci d'être présent(e) à l'heure.`
                        ].join('\n'))
                        .setTimestamp();

                    await user.send({ embeds: [reminderEmbed] });
                    log.info(`Rappel convocation envoyé pour event ${event.id} -> ${participant.user_discord_id}`);
                } catch (dmError) {
                    log.warn(`Rappel convocation échoué pour event ${event.id} -> ${participant.user_discord_id}: ${dmError.message}`);
                }
            }
        }
    } catch (error) {
        log.error(`Erreur rappels convocations: ${error.message}`);
    }
}

function buildEventDateTime(eventDate, startTime) {
    if (!eventDate) {
        return null;
    }

    const datePart = String(eventDate).split('T')[0];
    const timePart = String(startTime || '').slice(0, 5);

    // Priorité à start_time pour conserver l'horaire métier saisi côté France.
    // Cela évite les décalages DST/serveur quand event_date (TIMESTAMPTZ) est interprétée en UTC.
    if (timePart) {
        return parseParisLocalDateTime(datePart, timePart);
    }

    const fromEventDate = new Date(eventDate);
    if (!Number.isNaN(fromEventDate.getTime())) {
        return fromEventDate;
    }

    if (!startTime) {
        return null;
    }

    const [yearStr, monthStr, dayStr] = datePart.split('-');
    const [hourStr, minuteStr] = String(startTime).slice(0, 5).split(':');

    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10) - 1;
    const day = parseInt(dayStr, 10);
    const hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);

    if ([year, month, day, hour, minute].some(Number.isNaN)) {
        return null;
    }

    const date = new Date(year, month, day, hour, minute, 0, 0);
    return Number.isNaN(date.getTime()) ? null : date;
}

function parseParisLocalDateTime(datePart, timePart) {
    const [yearStr, monthStr, dayStr] = String(datePart).split('-');
    const [hourStr, minuteStr] = String(timePart).split(':');

    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const day = parseInt(dayStr, 10);
    const hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);

    if ([year, month, day, hour, minute].some(Number.isNaN)) {
        return null;
    }

    // Conversion d'une date locale Europe/Paris vers un instant UTC.
    const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
    const offsetMinutes = getTimeZoneOffsetMinutes(new Date(utcGuess), 'Europe/Paris');
    const utcTimestamp = utcGuess - offsetMinutes * 60 * 1000;
    const utcDate = new Date(utcTimestamp);

    return Number.isNaN(utcDate.getTime()) ? null : utcDate;
}

function getTimeZoneOffsetMinutes(date, timeZone) {
    const dtf = new Intl.DateTimeFormat('en-US', {
        timeZone,
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });

    const parts = dtf.formatToParts(date);
    const map = {};
    for (const part of parts) {
        if (part.type !== 'literal') {
            map[part.type] = part.value;
        }
    }

    const asUtc = Date.UTC(
        Number(map.year),
        Number(map.month) - 1,
        Number(map.day),
        Number(map.hour),
        Number(map.minute),
        Number(map.second)
    );

    return (asUtc - date.getTime()) / 60000;
}

function parseConvocationTypeFromDescription(description) {
    if (!description || typeof description !== 'string') {
        return null;
    }

    const typeMatch = description.match(/Type:\s*(patient|staff)/i);
    if (typeMatch) {
        return typeMatch[1].toLowerCase();
    }

    if (/via Ticket/i.test(description)) {
        return 'patient';
    }

    return null;
}

// Démarrer les vérifications de rappel toutes les minutes
function startReminderChecker() {
    log.info('Système de rappels RDV activé (vérification chaque minute)');
    setInterval(checkAppointmentReminders, 60 * 1000);
    setInterval(checkConvocationReminders, 60 * 1000);
    // Vérifier immédiatement au démarrage
    checkAppointmentReminders();
    checkConvocationReminders();
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

// Gestion des erreurs non capturées pour éviter le crash silencieux
process.on('unhandledRejection', (reason, promise) => {
    log.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
});

process.on('uncaughtException', (error) => {
    log.error(`Uncaught Exception: ${error.message}`);
    log.error(error.stack);
    // On laisse le processus s'arrêter proprement, Railway le redémarrera
    process.exit(1);
});
