const log = require('../utils/logger');
const equipeCommand = require('../commands/equipe');

module.exports = {
    name: 'ready',
    once: true,
    async execute(client, { registerCommands, checkConfiguration, setupRealtimeListener, setupLiveServicesListener, checkNewApplications, startApiServer, supabase }) {
        log.startup();
        log.connected(client.user.tag, client.guilds.cache.size);

        log.section('Initialisation');
        await registerCommands(client);
        checkConfiguration();
        setupRealtimeListener();
        setupLiveServicesListener(); // Activer le live view pour /equipe

        // Restaurer les messages live /equipe depuis la base de données
        if (supabase) {
            await equipeCommand.loadLiveMessagesFromDB(client, supabase);
        }

        log.section('Services');
        log.info('Polling activé (intervalle: 10s)');
        setInterval(checkNewApplications, 10000);
        setTimeout(checkNewApplications, 2000);

        // Démarrer le serveur API
        startApiServer(client);
    }
};
