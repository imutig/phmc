const log = require('../utils/logger');

module.exports = {
    name: 'messageCreate',
    async execute(message, { supabase, client }) {
        // Ignorer les messages des bots
        if (message.author.bot) return;

        // Seulement les DMs
        if (!message.guild) {
            await handleCandidateDM(message, supabase, client);
            await handleAppointmentDM(message, supabase, client);
        } else {
            // Messages dans les salons de guilde (pour le relais vers le web/DM)
            await handleGuildMessage(message, supabase);
        }
    }
};

async function handleGuildMessage(message, supabase) {
    // Vérifier si c'est un salon de ticket (candidature ou RDV)
    const channelName = message.channel.name;

    // 1. Gestion des Candidatures (ticket-*)
    if (channelName.startsWith('ticket-')) {
        // ... (logique existante pour candidatures si nécessaire, ou laisser vide si géré ailleurs)
        // Note: Le code actuel ne gérait que les DMs vers le salon. 
        // Si on veut que les messages du staff dans le salon soient sauvegardés/envoyés en DM, il faut le faire ici.
        // Pour l'instant, je me concentre sur les RDV comme demandé.
    }

    // 2. Gestion des Rendez-vous (rdv-*)
    if (channelName.startsWith('rdv-')) {
        await handleAppointmentGuildMessage(message, supabase);
    }
}

async function handleAppointmentGuildMessage(message, supabase) {
    // Trouver le RDV lié à ce salon
    const { data: appointment } = await supabase
        .from('appointments')
        .select('*')
        .eq('discord_channel_id', message.channel.id)
        .single();

    if (!appointment) return;

    // Récupérer le rôle principal du staff (le plus haut dans la hiérarchie médicale)
    const member = message.member;
    const displayName = member.displayName || message.author.username;

    // Déterminer le rôle à afficher (chercher dans les rôles du membre)
    const roleNames = member.roles.cache.map(r => r.name.toLowerCase());
    let roleLabel = 'Staff';

    // Ordre de priorité: Direction > Chirurgien > Médecin > Infirmier
    if (roleNames.some(r => r.includes('direction') || r.includes('directeur') || r.includes('directrice'))) {
        roleLabel = 'Direction';
    } else if (roleNames.some(r => r.includes('chirurgien'))) {
        roleLabel = 'Chirurgien';
    } else if (roleNames.some(r => r.includes('médecin') || r.includes('medecin'))) {
        roleLabel = 'Médecin';
    } else if (roleNames.some(r => r.includes('infirmier') || r.includes('infirmière') || r.includes('infirmiere'))) {
        roleLabel = 'Infirmier';
    }

    // Sauvegarder le message en BDD
    await supabase.from('appointment_messages').insert({
        appointment_id: appointment.id,
        sender_discord_id: message.author.id,
        sender_name: `${displayName} (${roleLabel})`,
        content: message.content,
        is_from_staff: true
    });

    // Relayer en DM au patient
    try {
        const user = await message.client.users.fetch(appointment.discord_id);
        if (user) {
            await user.send(`**${displayName}** (${roleLabel}): ${message.content}`);
        }
    } catch (error) {
        console.error('Erreur envoi DM patient:', error);
        // On ne bloque pas le flux si le DM échoue (ex: DMs fermés)
    }
}

async function handleAppointmentDM(message, supabase, client) {
    // Trouver le RDV actif du patient
    const { data: appointment } = await supabase
        .from('appointments')
        .select('*')
        .eq('discord_id', message.author.id)
        .not('discord_channel_id', 'is', null)
        .in('status', ['pending', 'scheduled']) // RDV actifs
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (!appointment || !appointment.discord_channel_id) return;

    try {
        // Récupérer le salon
        const guild = await client.guilds.fetch(process.env.DISCORD_GUILD_ID);
        const channel = await guild.channels.fetch(appointment.discord_channel_id);

        if (!channel) return;

        // Sauvegarder en BDD
        await supabase.from('appointment_messages').insert({
            appointment_id: appointment.id,
            sender_discord_id: message.author.id,
            sender_name: `${appointment.discord_username} (Patient)`,
            content: message.content,
            is_from_staff: false
        });

        // Relayer dans le salon
        await channel.send(`**${appointment.discord_username}** (Patient): ${message.content}`);
        await message.react('✅');

    } catch (error) {
        console.error('Erreur relay DM RDV:', error);
        await message.react('❌');
    }
}

async function handleCandidateDM(message, supabase, client) {
    // Trouver la candidature active du candidat
    const { data: application } = await supabase
        .from('applications')
        .select('*, users(discord_id, discord_username)')
        .eq('users.discord_id', message.author.id)
        .not('discord_channel_id', 'is', null)
        .in('status', ['pending', 'reviewing', 'interview_scheduled'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (!application || !application.discord_channel_id) {
        // Pas de candidature active, ignorer silencieusement
        return;
    }

    try {
        // Récupérer le salon de candidature
        const guild = await client.guilds.fetch(process.env.DISCORD_GUILD_ID);
        const channel = await guild.channels.fetch(application.discord_channel_id);

        if (!channel) {
            log.error(`Salon de candidature introuvable: ${application.discord_channel_id}`);
            return;
        }

        // Format: Prénom Nom (pseudo): message
        const candidateName = `${application.first_name} ${application.last_name}`;
        const candidatePseudo = application.users?.discord_username || message.author.username;

        // Format: **Prénom Nom (pseudo)** - message
        let relayedMessage = `**${candidateName} (${candidatePseudo})** - ${message.content}`;

        // Si une alerte est configurée, mentionner le recruteur
        if (application.alert_user_id) {
            relayedMessage = `<@${application.alert_user_id}> 🔔 Nouveau message !\n\n` + relayedMessage;

            // Reset l'alerte après utilisation
            await supabase
                .from('applications')
                .update({ alert_user_id: null })
                .eq('id', application.id);
        }

        await channel.send({ content: relayedMessage });

        // Logger le message dans la base
        await supabase.from('application_messages').insert({
            application_id: application.id,
            sender_discord_id: message.author.id,
            sender_name: candidateName,
            content: message.content,
            is_from_candidate: true
        });

        // Confirmer au candidat que son message a été transmis
        await message.react('✅');

    } catch (error) {
        log.error(`Erreur relay DM: ${error.message}`);
        await message.react('❌');
    }
}
