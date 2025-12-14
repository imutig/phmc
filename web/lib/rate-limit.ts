import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

// Utilisation d'un store en mémoire si Upstash n'est pas configuré
const isUpstashConfigured = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN

let redis: Redis | null = null
if (isUpstashConfigured) {
    redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL!,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
}

// Rate limiter pour les candidatures (1 par 10 minutes par IP)
export const applicationRateLimit = isUpstashConfigured && redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(1, "10 m"),
        analytics: true,
        prefix: "ratelimit:applications",
    })
    : null

// Rate limiter pour les API admin (50 requêtes par minute par utilisateur)
export const adminRateLimit = isUpstashConfigured && redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(50, "1 m"),
        analytics: true,
        prefix: "ratelimit:admin",
    })
    : null

// Rate limiter pour les uploads (10 par minute par IP)
export const uploadRateLimit = isUpstashConfigured && redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(10, "1 m"),
        analytics: true,
        prefix: "ratelimit:upload",
    })
    : null

/**
 * Vérifie le rate limit pour un identifiant donné
 * Retourne { success: true } si autorisé, { success: false, reset } si limité
 */
export async function checkRateLimit(
    limiter: Ratelimit | null,
    identifier: string
): Promise<{ success: boolean; reset?: number; remaining?: number }> {
    // Si Upstash n'est pas configuré, on autorise toujours (mode développement)
    if (!limiter) {
        return { success: true }
    }

    try {
        const result = await limiter.limit(identifier)
        return {
            success: result.success,
            reset: result.reset,
            remaining: result.remaining
        }
    } catch (error) {
        console.error("[Rate Limit] Error:", error)
        // En cas d'erreur, on autorise pour ne pas bloquer les utilisateurs
        return { success: true }
    }
}

/**
 * Headers standard pour les réponses rate limited
 */
export function rateLimitHeaders(reset?: number, remaining?: number) {
    const headers: Record<string, string> = {}
    if (reset) headers["X-RateLimit-Reset"] = String(reset)
    if (remaining !== undefined) headers["X-RateLimit-Remaining"] = String(remaining)
    return headers
}
