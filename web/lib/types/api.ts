import { NextResponse } from "next/server"
import { RoleType } from "@/lib/auth-utils"
import { GradeType } from "@/lib/permissions"

// ============================================================
// TYPES DE SESSION
// ============================================================

/**
 * Extension du type User de NextAuth avec les champs Discord
 */
export interface DiscordUser {
    discord_id: string
    discord_username: string
    discord_avatar?: string
    roles: RoleType[]
    displayName: string
    name?: string
    email?: string
    image?: string
}

/**
 * Session étendue avec les infos Discord
 */
export interface ExtendedSession {
    user: DiscordUser
    accessToken: string
    expires: string
}

// ============================================================
// TYPES DE RÉPONSES API STANDARDISÉES
// ============================================================

/**
 * Réponse d'erreur standard
 */
export interface ApiError {
    error: string
    code?: string
    details?: Record<string, unknown>
}

/**
 * Réponse de succès standard
 */
export interface ApiSuccess<T = unknown> {
    success: true
    data?: T
    message?: string
}

/**
 * Type union pour les réponses API
 */
export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiError

// ============================================================
// CODES D'ERREUR STANDARDISÉS
// ============================================================

export const ErrorCodes = {
    // Authentification
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    TOKEN_EXPIRED: 'TOKEN_EXPIRED',

    // Validation
    INVALID_INPUT: 'INVALID_INPUT',
    MISSING_FIELD: 'MISSING_FIELD',

    // Ressources
    NOT_FOUND: 'NOT_FOUND',
    ALREADY_EXISTS: 'ALREADY_EXISTS',
    CONFLICT: 'CONFLICT',

    // Serveur
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    DATABASE_ERROR: 'DATABASE_ERROR',
    EXTERNAL_API_ERROR: 'EXTERNAL_API_ERROR',
} as const

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes]

// ============================================================
// HELPERS POUR LES RÉPONSES API
// ============================================================

/**
 * Crée une réponse d'erreur standardisée
 */
export function apiError(
    message: string,
    status: number = 500,
    code?: ErrorCode,
    details?: Record<string, unknown>
): NextResponse<ApiError> {
    const body: ApiError = { error: message }
    if (code) body.code = code
    if (details) body.details = details
    return NextResponse.json(body, { status })
}

/**
 * Crée une réponse de succès standardisée
 */
export function apiSuccess<T>(
    data?: T,
    message?: string,
    status: number = 200
): NextResponse<ApiSuccess<T>> {
    const body: ApiSuccess<T> = { success: true }
    if (data !== undefined) body.data = data
    if (message) body.message = message
    return NextResponse.json(body, { status })
}

// ============================================================
// TYPES SPÉCIFIQUES AUX MODULES
// ============================================================

// --- Services ---
export interface Service {
    id: string
    user_discord_id: string
    user_name: string
    user_avatar_url?: string
    grade_name: string
    start_time: string
    end_time: string | null
    duration_minutes: number
    slots_count: number | null
    salary_earned: number | null
    week_number: number
    year: number
    service_date: string
    created_at: string
}

export interface ServiceStats {
    totalMinutes: number
    totalSlots: number
    totalSalary: number
    serviceCount: number
}

// --- Permissions ---
export interface Permission {
    key: string
    label: string
    description: string
    category: string
}

export interface GradePermissions {
    grade: GradeType
    permission_key: string
    granted: boolean
    updated_by?: string
    updated_at?: string
}

// --- Utilisateur ---
export interface UserProfile {
    id: string
    discord_id: string
    discord_username: string
    display_name: string
    avatar_url?: string
    grade: GradeType | null
    gradeName: string
    roles: RoleType[]
}

// --- Session Logs ---
export interface SessionLog {
    id: string
    user_discord_id: string
    user_name: string
    action: 'login' | 'logout'
    ip_address?: string
    user_agent?: string
    created_at: string
}
