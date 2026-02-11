const { EmbedBuilder } = require('discord.js');
const log = require('./logger');

/**
 * Gestionnaire d'erreurs centralisé pour les interactions Discord
 * Capture, log et répond de manière cohérente aux erreurs
 */

/**
 * Gère une erreur d'interaction Discord
 * @param {Error} error - L'erreur capturée
 * @param {Interaction} interaction - L'interaction Discord
 * @param {string} context - Contexte de l'erreur (ex: 'button', 'modal', 'command')
 */
async function handleInteractionError(error, interaction, context = 'unknown') {
    // Log structuré
    log.error(`Erreur ${context}: ${error.message}`, {
        context,
        errorName: error.name,
        stack: error.stack?.split('\n').slice(0, 3).join(' | '),
        userId: interaction?.user?.id,
        guildId: interaction?.guild?.id,
        customId: interaction?.customId || interaction?.commandName
    });

    // Créer l'embed d'erreur
    const errorEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ Erreur')
        .setDescription('Une erreur est survenue lors du traitement de votre demande.')
        .setTimestamp();

    // Tenter de répondre à l'utilisateur
    // Si l'erreur est déjà "Unknown interaction" (10062), l'interaction a expiré,
    // inutile de tenter de répondre à nouveau (ça refera la même erreur)
    try {
        if (!interaction) return;
        if (error.code === 10062 || error.message?.includes('Unknown interaction')) return;

        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ embeds: [errorEmbed], flags: 64 });
        } else {
            await interaction.reply({ embeds: [errorEmbed], flags: 64 });
        }
    } catch (replyError) {
        // Ne pas log si c'est encore une interaction expirée (bruit dans les logs)
        if (replyError.code !== 10062) {
            log.error(`Impossible de répondre à l'utilisateur: ${replyError.message}`, {
                context: 'error_handler_reply',
                originalError: error.message
            });
        }
    }
}

/**
 * Wrapper pour exécuter une fonction avec gestion d'erreur automatique
 * @param {Function} fn - La fonction à exécuter
 * @param {Interaction} interaction - L'interaction Discord
 * @param {string} context - Contexte pour le logging
 */
async function withErrorHandling(fn, interaction, context) {
    try {
        await fn();
    } catch (error) {
        await handleInteractionError(error, interaction, context);
    }
}

/**
 * Gère une erreur générique (non liée à une interaction)
 * @param {Error} error - L'erreur capturée
 * @param {string} context - Contexte de l'erreur
 */
function handleGenericError(error, context = 'unknown') {
    log.error(`Erreur ${context}: ${error.message}`, {
        context,
        errorName: error.name,
        stack: error.stack?.split('\n').slice(0, 5).join(' | ')
    });
}

module.exports = {
    handleInteractionError,
    withErrorHandling,
    handleGenericError
};
