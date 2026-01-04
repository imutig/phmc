const log = require('../utils/logger');
const { handleAutoServiceStart, handleAutoServiceEnd } = require('../handlers/autoServiceHandlers');

/**
 * Listener pour le bot Pointeuse
 * Écoute les messages du bot dans le salon dédié et synchronise les services
 */

const POINTEUSE_CHANNEL_ID = '1294095397442027553';
const POINTEUSE_BOT_ID = '1294095675864125512';

/**
 * Initialise le listener Pointeuse
 * @param {Object} client - Le client Discord
 * @param {Object} supabase - Le client Supabase
 */
function initPointeuseListener(client, supabase) {
    client.on('messageCreate', async (message) => {
        // Filtrer : uniquement le bon salon
        if (message.channelId !== POINTEUSE_CHANNEL_ID) return;

        // Filtrer : uniquement le bot Pointeuse
        if (message.author.id !== POINTEUSE_BOT_ID) return;

        // Extraire le texte de l'embed (titre ou description)
        let embedText = null;
        if (message.embeds && message.embeds.length > 0) {
            const embed = message.embeds[0];
            embedText = embed.title || embed.description;
        }

        // Si pas d'embed, essayer le contenu du message
        if (!embedText && message.content) {
            embedText = message.content;
        }

        if (!embedText) {
            log.debug('[Pointeuse] Message sans texte exploitable, ignoré');
            return;
        }

        // Parser le message
        const textLower = embedText.toLowerCase();
        const isPrise = textLower.includes('prise de service');
        const isFin = textLower.includes('fin de service');

        if (!isPrise && !isFin) {
            log.debug(`[Pointeuse] Message non reconnu: "${embedText}"`);
            return;
        }

        // Extraire le nom (tout avant "prise de service" ou "fin de service")
        const regex = /^(.+?)\s+(prise de service|fin de service)$/i;
        const match = embedText.match(regex);

        if (!match) {
            log.warn(`[Pointeuse] Format de message invalide: "${embedText}"`);
            return;
        }

        const ign = match[1].trim();
        const action = isPrise ? 'prise' : 'fin';

        log.info(`[Pointeuse] Détecté: "${ign}" - ${action} de service`);

        // Chercher l'utilisateur par IGN (insensible à la casse)
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .ilike('ign', ign)
            .maybeSingle();

        if (error) {
            log.error(`[Pointeuse] Erreur recherche utilisateur: ${error.message}`);
            return;
        }

        if (!user) {
            log.info(`[Pointeuse] IGN non trouvé en base: "${ign}"`);
            return;
        }

        // Exécuter l'action appropriée
        if (isPrise) {
            await handleAutoServiceStart(user, supabase, client);
        } else {
            await handleAutoServiceEnd(user, supabase);
        }
    });

    log.success('[Pointeuse] Listener activé - Synchronisation des services in-game');
}

module.exports = {
    initPointeuseListener,
    POINTEUSE_CHANNEL_ID,
    POINTEUSE_BOT_ID
};
