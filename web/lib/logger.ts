// Codes d'erreur standardisés
export const ErrorCodes = {
    // Authentification
    AUTH_001: 'Non authentifié',
    AUTH_002: 'Non autorisé - rôle insuffisant',
    AUTH_003: 'Session expirée',
    AUTH_004: 'Token Discord invalide',

    // Candidatures
    APP_001: 'Candidature non trouvée',
    APP_002: 'Candidature déjà clôturée',
    APP_003: 'Statut invalide',
    APP_004: 'Candidature déjà existante',

    // Documents
    DOC_001: 'Type de fichier non autorisé',
    DOC_002: 'Fichier trop volumineux',
    DOC_003: 'Erreur upload ImgBB',
    DOC_004: 'Document manquant',

    // Votes
    VOTE_001: 'Vote déjà enregistré',
    VOTE_002: 'Vote invalide',

    // Messages
    MSG_001: 'Message non trouvé',
    MSG_002: 'Message vide',
    MSG_003: 'Message trop long',

    // Bot
    BOT_001: 'Salon Discord non trouvé',
    BOT_002: 'Utilisateur Discord non trouvé',
    BOT_003: 'Erreur envoi DM',

    // Général
    SERVER_001: 'Erreur serveur interne',
    SERVER_002: 'Base de données indisponible',
    VALIDATION_001: 'Données invalides',
} as const

export type ErrorCode = keyof typeof ErrorCodes

interface LogContext {
    userId?: string
    applicationId?: string
    route?: string
    [key: string]: unknown
}

class Logger {
    private formatContext(context?: LogContext): string {
        if (!context) return ''
        return Object.entries(context)
            .map(([k, v]) => `${k}=${v}`)
            .join(' ')
    }

    error(code: ErrorCode, message: string, context?: LogContext) {
        const timestamp = new Date().toISOString()
        const contextStr = this.formatContext(context)
        console.error(`[${timestamp}] [ERROR] [${code}] ${message} ${contextStr}`)

        // TODO: Envoyer à un service de monitoring (Sentry, etc.)
    }

    warn(code: ErrorCode, message: string, context?: LogContext) {
        const timestamp = new Date().toISOString()
        const contextStr = this.formatContext(context)
        console.warn(`[${timestamp}] [WARN] [${code}] ${message} ${contextStr}`)
    }

    info(message: string, context?: LogContext) {
        const timestamp = new Date().toISOString()
        const contextStr = this.formatContext(context)
        console.info(`[${timestamp}] [INFO] ${message} ${contextStr}`)
    }

    debug(message: string, context?: LogContext) {
        if (process.env.NODE_ENV === 'development') {
            const timestamp = new Date().toISOString()
            const contextStr = this.formatContext(context)
            console.debug(`[${timestamp}] [DEBUG] ${message} ${contextStr}`)
        }
    }
}

export const logger = new Logger()

// Helper pour créer une réponse d'erreur standardisée
export function createErrorResponse(code: ErrorCode, status: number = 400) {
    return {
        error: ErrorCodes[code],
        code,
        status
    }
}
