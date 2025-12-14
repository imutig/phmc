const log = require('../utils/logger');

module.exports = {
    name: 'messageCreate',
    async execute(message, { supabase, client }) {
        // Ignorer les messages des bots
        if (message.author.bot) return;

        // Seulement les DMs
        if (!message.guild) {
            await handleCandidateDM(message, supabase, client);
        }
    }
};

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
