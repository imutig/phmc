const log = require('../utils/logger');

module.exports = {
    name: 'ready',
    once: true,
    async execute(client, { registerCommands, checkConfiguration, setupRealtimeListener, checkNewApplications, startApiServer }) {
        log.startup();
        log.connected(client.user.tag, client.guilds.cache.size);

        log.section('Initialisation');
        await registerCommands(client);
        checkConfiguration();
        setupRealtimeListener();

        log.section('Services');
        log.info('Polling activé (intervalle: 10s)');
        setInterval(checkNewApplications, 10000);
        setTimeout(checkNewApplications, 2000);

        // Démarrer le serveur API
        startApiServer(client);
    }
};
