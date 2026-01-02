const chalk = require('chalk');

/**
 * Logger stylisé pour le bot Secrétaire Spades
 * Supporte à la fois un affichage console coloré et une sortie JSON structurée
 */

const LOG_LEVELS = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3
};

const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL] ?? LOG_LEVELS.info;

/**
 * Génère un log JSON structuré pour les outils de monitoring
 */
function logJson(level, message, metadata = {}) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        ...metadata
    };

    // En production ou si JSON_LOGS est activé, sortie JSON pure
    if (process.env.NODE_ENV === 'production' || process.env.JSON_LOGS === 'true') {
        console.log(JSON.stringify(logEntry));
    }
}

const logger = {
    // Préfixes
    prefix: chalk.gray('[Secrétaire]'),

    // Styles avec logging structuré
    success: (msg, meta = {}) => {
        console.log(`${chalk.green('✓')} ${msg}`);
        logJson('info', msg, { type: 'success', ...meta });
    },
    error: (msg, meta = {}) => {
        console.log(`${chalk.red('✗')} ${chalk.red(msg)}`);
        logJson('error', msg, { type: 'error', ...meta });
    },
    warn: (msg, meta = {}) => {
        if (currentLevel >= LOG_LEVELS.warn) {
            console.log(`${chalk.yellow('⚠')} ${chalk.yellow(msg)}`);
            logJson('warn', msg, { type: 'warning', ...meta });
        }
    },
    info: (msg, meta = {}) => {
        if (currentLevel >= LOG_LEVELS.info) {
            console.log(`${chalk.blue('ℹ')} ${msg}`);
            logJson('info', msg, meta);
        }
    },
    debug: (msg, meta = {}) => {
        if (currentLevel >= LOG_LEVELS.debug || process.env.DEBUG) {
            console.log(`${chalk.gray('⋯')} ${chalk.gray(msg)}`);
            logJson('debug', msg, meta);
        }
    },

    // Catégories spécifiques
    command: (name, meta = {}) => {
        console.log(`${chalk.cyan('⌘')} Commande: ${chalk.cyan(name)}`);
        logJson('info', `Command executed: ${name}`, { type: 'command', command: name, ...meta });
    },
    api: (msg, meta = {}) => {
        console.log(`${chalk.magenta('⚡')} ${chalk.magenta('API')} ${msg}`);
        logJson('info', msg, { type: 'api', ...meta });
    },
    realtime: (msg, meta = {}) => {
        console.log(`${chalk.green('◉')} ${chalk.green('Realtime')} ${msg}`);
        logJson('info', msg, { type: 'realtime', ...meta });
    },
    discord: (msg, meta = {}) => {
        console.log(`${chalk.blue('💬')} ${chalk.blue('Discord')} ${msg}`);
        logJson('info', msg, { type: 'discord', ...meta });
    },

    // En-tête de démarrage
    startup: () => {
        console.log('');
        console.log(chalk.cyan('╔════════════════════════════════════════════════════════════╗'));
        console.log(chalk.cyan('║') + chalk.white.bold('           SECRÉTAIRE SPADES - Bot de Recrutement           ') + chalk.cyan('║'));
        console.log(chalk.cyan('╚════════════════════════════════════════════════════════════╝'));
        console.log('');
        logJson('info', 'Bot starting up', { type: 'startup' });
    },

    // Section
    section: (title) => {
        console.log('');
        console.log(chalk.gray('─'.repeat(50)));
        console.log(chalk.white.bold(`  ${title}`));
        console.log(chalk.gray('─'.repeat(50)));
    },

    // Stats de connexion
    connected: (botName, serverCount) => {
        console.log('');
        console.log(`${chalk.green('●')} Bot connecté: ${chalk.cyan(botName)}`);
        console.log(`${chalk.blue('●')} Serveurs: ${chalk.white(serverCount)}`);
        console.log('');
        logJson('info', 'Bot connected', { type: 'connection', botName, serverCount });
    }
};

module.exports = logger;

