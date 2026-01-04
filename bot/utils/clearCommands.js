require('dotenv').config();
const { REST, Routes } = require('discord.js');
const log = require('./logger');

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID; // On essaiera de le déduire ou l'utilisateur devra le mettre, mais souvent le token suffit pour l'instanciation REST, mais pour les routes on a besoin de l'ID application.
// NOTE: clientId est souvent nécessaire. Si pas dans .env, on va le récupérer via une requête me() ou demander à l'utilisateur.
// Pour simplifier, on va supposer que l'utilisateur a DISCORD_CLIENT_ID ou on va tenter de le récupérer via le token.

async function clearCommands() {
    if (!token) {
        console.error('Erreur: DISCORD_TOKEN manquant dans .env');
        process.exit(1);
    }

    const rest = new REST().setToken(token);

    try {
        log.info('Récupération des informations du bot...');
        const user = await rest.get(Routes.user('@me'));
        const applicationId = user.id;
        log.info(`Bot ID détecté: ${applicationId}`);

        // 1. Supprimer les commandes globales
        log.info('Suppression des commandes GLOBALES...');
        await rest.put(Routes.applicationCommands(applicationId), { body: [] });
        log.success('Commandes globales supprimées.');

        // 2. Supprimer les commandes de guilde (si GUILD_ID présent)
        const guildId = process.env.DISCORD_GUILD_ID;
        if (guildId) {
            log.info(`Suppression des commandes de GUILDE (${guildId})...`);
            await rest.put(Routes.applicationGuildCommands(applicationId, guildId), { body: [] });
            log.success('Commandes de guilde supprimées.');
        } else {
            log.warn('DISCORD_GUILD_ID non défini, impossible de nettoyer les commandes de guilde spécifiques.');
        }

        log.success('Nettoyage terminé ! Redémarrez le bot pour ré-enregistrer les commandes correctes.');

    } catch (error) {
        log.error(`Erreur lors du nettoyage: ${error.message}`);
    }
}

clearCommands();
