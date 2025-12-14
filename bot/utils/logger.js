const chalk = require('chalk');

/**
 * Logger stylisé pour le bot Secrétaire Spades
 */
const logger = {
    // Préfixes
    prefix: chalk.gray('[Secrétaire]'),

    // Styles
    success: (msg) => console.log(`${chalk.green('✓')} ${msg}`),
    error: (msg) => console.log(`${chalk.red('✗')} ${chalk.red(msg)}`),
    warn: (msg) => console.log(`${chalk.yellow('⚠')} ${chalk.yellow(msg)}`),
    info: (msg) => console.log(`${chalk.blue('ℹ')} ${msg}`),
    debug: (msg) => process.env.DEBUG && console.log(`${chalk.gray('⋯')} ${chalk.gray(msg)}`),

    // Catégories spécifiques
    command: (name) => console.log(`${chalk.cyan('⌘')} Commande: ${chalk.cyan(name)}`),
    api: (msg) => console.log(`${chalk.magenta('⚡')} ${chalk.magenta('API')} ${msg}`),
    realtime: (msg) => console.log(`${chalk.green('◉')} ${chalk.green('Realtime')} ${msg}`),
    discord: (msg) => console.log(`${chalk.blue('💬')} ${chalk.blue('Discord')} ${msg}`),

    // En-tête de démarrage
    startup: () => {
        console.log('');
        console.log(chalk.cyan('╔════════════════════════════════════════════════════════════╗'));
        console.log(chalk.cyan('║') + chalk.white.bold('           SECRÉTAIRE SPADES - Bot de Recrutement           ') + chalk.cyan('║'));
        console.log(chalk.cyan('╚════════════════════════════════════════════════════════════╝'));
        console.log('');
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
    }
};

module.exports = logger;
