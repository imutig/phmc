const log = require('./logger');

/**
 * File d'attente de messages Discord avec retry automatique
 * Évite les crashes en cas de rate limit ou d'erreur API Discord
 */
class MessageQueue {
    constructor() {
        this.queue = [];
        this.processing = false;
        this.maxRetries = 3;
        this.baseDelay = 1000; // 1 seconde
    }

    /**
     * Ajoute un message à la queue
     * @param {Function} sendFn - Fonction async qui envoie le message
     * @param {string} description - Description pour les logs
     */
    async add(sendFn, description = 'message') {
        this.queue.push({ sendFn, description, retries: 0 });
        this.process();
    }

    /**
     * Traite la queue
     */
    async process() {
        if (this.processing || this.queue.length === 0) return;

        this.processing = true;

        while (this.queue.length > 0) {
            const item = this.queue.shift();

            try {
                await item.sendFn();
                log.debug(`Message envoyé: ${item.description}`);
            } catch (error) {
                // Gérer le rate limit
                if (error.status === 429 || error.code === 'RateLimited') {
                    const retryAfter = error.retryAfter || 5;
                    log.warn(`Rate limit Discord, retry dans ${retryAfter}s`);

                    // Remettre en tête de queue
                    this.queue.unshift(item);
                    await this.sleep(retryAfter * 1000);
                    continue;
                }

                // Retry avec délai exponentiel
                if (item.retries < this.maxRetries) {
                    item.retries++;
                    const delay = this.baseDelay * Math.pow(2, item.retries);
                    log.warn(`Échec ${item.description}, retry ${item.retries}/${this.maxRetries} dans ${delay}ms`);

                    // Remettre à la fin de la queue
                    setTimeout(() => {
                        this.queue.push(item);
                        this.process();
                    }, delay);
                } else {
                    log.error(`Abandon ${item.description} après ${this.maxRetries} tentatives: ${error.message}`);
                }
            }
        }

        this.processing = false;
    }

    /**
     * Sleep utility
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Wrapper pour channel.send avec queue
     * @param {TextChannel} channel - Le salon Discord
     * @param {object} options - Options du message
     */
    async sendToChannel(channel, options) {
        return this.add(
            () => channel.send(options),
            `channel:${channel.id}`
        );
    }

    /**
     * Wrapper pour user.send avec queue
     * @param {User} user - L'utilisateur Discord
     * @param {object} options - Options du message
     */
    async sendToUser(user, options) {
        return this.add(
            () => user.send(options),
            `DM:${user.id}`
        );
    }

    /**
     * Wrapper pour message.edit avec queue
     * @param {Message} message - Le message à éditer
     * @param {object} options - Options du message
     */
    async editMessage(message, options) {
        return this.add(
            () => message.edit(options),
            `edit:${message.id}`
        );
    }

    /**
     * Taille actuelle de la queue
     */
    get size() {
        return this.queue.length;
    }
}

// Singleton
const messageQueue = new MessageQueue();

module.exports = messageQueue;
