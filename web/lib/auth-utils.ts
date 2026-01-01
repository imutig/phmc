import { createClient } from "@/lib/supabase/server"
import { auth } from "@/lib/auth"
import { getDefaultPermissionsForGrade, GradeType, ALL_PERMISSIONS } from "@/lib/permissions"

// Grades EMS : direction, chirurgien, medecin, infirmier, ambulancier + recruiter/candidate
export type RoleType = 'direction' | 'chirurgien' | 'medecin' | 'infirmier' | 'ambulancier' | 'recruiter' | 'candidate'

// Liste des grades EMS (pour calcul salaire)
export const EMS_GRADES: RoleType[] = ['direction', 'chirurgien', 'medecin', 'infirmier', 'ambulancier']

export interface RoleCheckResult {
    roles: RoleType[]
    discordRoles: string[]
    displayName?: string
    avatarUrl?: string | null
    discordId?: string
    error?: string
}

// Cache des infos Discord (15 minutes pour éviter rate limiting)
const memberCache = new Map<string, { result: RoleCheckResult; expiry: number }>()
const CACHE_DURATION = 15 * 60 * 1000 // 15 minutes

// Cache des configurations de rôles (15 minutes)
let roleConfigCache: { data: { role_type: string; discord_role_id: string }[]; expiry: number } | null = null
const CONFIG_CACHE_DURATION = 15 * 60 * 1000

// Cache des permissions par grade (5 minutes)
let permissionsCache: { data: Record<string, Record<string, boolean>>; expiry: number } | null = null
const PERMISSIONS_CACHE_DURATION = 5 * 60 * 1000

/**
 * Récupère la configuration des rôles depuis Supabase (avec cache)
 */
async function getRoleConfig() {
    if (roleConfigCache && roleConfigCache.expiry > Date.now()) {
        return roleConfigCache.data
    }

    const supabase = await createClient()
    const { data } = await supabase
        .from('discord_roles')
        .select('role_type, discord_role_id')

    roleConfigCache = { data: data || [], expiry: Date.now() + CONFIG_CACHE_DURATION }
    return data || []
}

/**
 * Vérifie les rôles Discord d'un utilisateur et retourne ses permissions
 */
export async function checkDiscordRoles(accessToken: string): Promise<RoleCheckResult> {
    // Vérifier le cache d'abord
    const cached = memberCache.get(accessToken)
    if (cached && cached.expiry > Date.now()) {
        return cached.result
    }

    const supabase = await createClient()

    // Récupérer le guild_id depuis la config
    const { data: guildConfig } = await supabase
        .from('config')
        .select('value')
        .eq('key', 'guild_id')
        .single()

    const guildId = guildConfig?.value?.replace(/"/g, '') || process.env.DISCORD_GUILD_ID

    if (!guildId) {
        console.error('[Auth] Guild ID not configured')
        return { roles: [], discordRoles: [], error: 'Guild ID non configuré' }
    }

    try {
        const response = await fetch(
            `https://discord.com/api/v10/users/@me/guilds/${guildId}/member`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
        )

        // Gestion du rate limit Discord
        if (response.status === 429) {
            const retryData = await response.json()
            const retryAfter = retryData.retry_after || 5
            console.warn(`[Auth] Discord rate limited. Retry after ${retryAfter}s. Using cached data if available.`)

            // Retourner le cache MÊME S'IL EST EXPIRÉ plutôt que d'échouer
            const expiredCache = memberCache.get(accessToken)
            if (expiredCache) {
                // Prolonger la validité du cache temporairement pour éviter les requêtes en boucle
                expiredCache.expiry = Date.now() + (retryAfter * 1000) + 5000
                return expiredCache.result
            }

            // Pas de cache ? On attend et on réessaie UNE FOIS
            await new Promise(resolve => setTimeout(resolve, (retryAfter + 0.5) * 1000))
            const retryResponse = await fetch(
                `https://discord.com/api/v10/users/@me/guilds/${guildId}/member`,
                { headers: { Authorization: `Bearer ${accessToken}` } }
            )
            if (!retryResponse.ok) {
                console.error('[Auth] Discord API error after retry:', retryResponse.status)
                return { roles: [], discordRoles: [], error: `Discord API: ${retryResponse.status}` }
            }
            const memberData = await retryResponse.json()
            const userDiscordRoles: string[] = memberData.roles || []
            const roleConfig = await getRoleConfig()
            const userRoleTypes: Set<RoleType> = new Set()
            for (const config of roleConfig) {
                if (userDiscordRoles.includes(config.discord_role_id)) {
                    userRoleTypes.add(config.role_type as RoleType)
                }
            }
            if (userRoleTypes.has('direction')) userRoleTypes.add('recruiter')
            const displayName = memberData.nick || memberData.user?.global_name || memberData.user?.username || 'Inconnu'
            const discordId = memberData.user?.id
            let avatarUrl: string | null = null
            if (memberData.avatar && discordId && guildId) {
                avatarUrl = `https://cdn.discordapp.com/guilds/${guildId}/users/${discordId}/avatars/${memberData.avatar}.png`
            } else if (memberData.user?.avatar && discordId) {
                avatarUrl = `https://cdn.discordapp.com/avatars/${discordId}/${memberData.user.avatar}.png`
            }
            const result: RoleCheckResult = { roles: Array.from(userRoleTypes), discordRoles: userDiscordRoles, displayName, avatarUrl, discordId }
            memberCache.set(accessToken, { result, expiry: Date.now() + CACHE_DURATION })
            return result
        }

        if (!response.ok) {
            console.error('[Auth] Discord API error:', response.status, await response.text())
            return { roles: [], discordRoles: [], error: `Discord API: ${response.status}` }
        }

        const memberData = await response.json()
        const userDiscordRoles: string[] = memberData.roles || []

        // Récupérer la config des rôles
        const roleConfig = await getRoleConfig()

        // Déterminer les types de rôles de l'utilisateur
        const userRoleTypes: Set<RoleType> = new Set()

        for (const config of roleConfig) {
            if (userDiscordRoles.includes(config.discord_role_id)) {
                userRoleTypes.add(config.role_type as RoleType)
            }
        }

        // Direction a tous les droits
        if (userRoleTypes.has('direction')) {
            userRoleTypes.add('recruiter')
        }

        // Construire le displayName et avatar
        const displayName = memberData.nick || memberData.user?.global_name || memberData.user?.username || 'Inconnu'
        const discordId = memberData.user?.id
        let avatarUrl: string | null = null
        if (memberData.avatar && discordId && guildId) {
            avatarUrl = `https://cdn.discordapp.com/guilds/${guildId}/users/${discordId}/avatars/${memberData.avatar}.png`
        } else if (memberData.user?.avatar && discordId) {
            avatarUrl = `https://cdn.discordapp.com/avatars/${discordId}/${memberData.user.avatar}.png`
        }

        const result: RoleCheckResult = {
            roles: Array.from(userRoleTypes),
            discordRoles: userDiscordRoles,
            displayName,
            avatarUrl,
            discordId
        }
        memberCache.set(accessToken, { result, expiry: Date.now() + CACHE_DURATION })
        return result
    } catch (error) {
        console.error('[Auth] Error checking Discord roles:', error)
        // En cas d'erreur réseau, utiliser le cache même expiré
        const expiredCache = memberCache.get(accessToken)
        if (expiredCache) {
            console.log('[Auth] Using expired cache due to network error')
            return expiredCache.result
        }
        return { roles: [], discordRoles: [], error: 'Erreur Discord API' }
    }
}

/**
 * Vérifie si l'utilisateur a au moins un des rôles requis
 */
export function hasRole(userRoles: RoleType[], requiredRoles: RoleType[]): boolean {
    return requiredRoles.some(role => userRoles.includes(role))
}

/**
 * Vérifie l'accès à une ressource selon les rôles requis
 * Utilise les rôles stockés en session (définis à la connexion)
 */
export async function requireRoles(requiredRoles: RoleType[]) {
    const session = await auth()

    if (!session?.user?.discord_id) {
        return { authorized: false, error: "Non authentifié.", status: 401, session: null, roles: [] as RoleType[] }
    }

    // Utiliser les rôles stockés dans la session (définis à la connexion)
    const roles = (session.user.roles || []) as RoleType[]

    if (!hasRole(roles, requiredRoles)) {
        return {
            authorized: false,
            error: "Accès non autorisé.",
            status: 403,
            session,
            roles
        }
    }

    return { authorized: true, session, roles }
}

/**
 * Accès admin (direction + recruteur)
 */
export async function requireAdminAccess() {
    return requireRoles(['direction', 'recruiter'])
}

/**
 * Accès intranet (tous les grades EMS)
 */
export async function requireEmployeeAccess() {
    return requireRoles(['direction', 'chirurgien', 'medecin', 'infirmier', 'ambulancier', 'recruiter'])
}

/**
 * Accès édition (direction uniquement)
 */
export async function requireEditorAccess() {
    return requireRoles(['direction'])
}

/**
 * Récupère le grade principal de l'utilisateur
 */
export function getPrimaryGrade(roles: RoleType[]): RoleType | null {
    const gradeHierarchy: RoleType[] = ['direction', 'chirurgien', 'medecin', 'infirmier', 'ambulancier']
    for (const grade of gradeHierarchy) {
        if (roles.includes(grade)) return grade
    }
    return null
}

/**
 * Invalidate le cache des rôles (utile après modification)
 */
export function invalidateRoleConfigCache() {
    roleConfigCache = null
}

/**
 * Récupère toutes les permissions depuis la DB (avec cache)
 */
async function getPermissionsMap(): Promise<Record<string, Record<string, boolean>>> {
    if (permissionsCache && permissionsCache.expiry > Date.now()) {
        return permissionsCache.data
    }

    const supabase = await createClient()
    const { data: dbPermissions } = await supabase
        .from('grade_permissions')
        .select('grade, permission_key, granted')

    const result: Record<string, Record<string, boolean>> = {}

    // Initialiser avec les permissions par défaut
    const grades: GradeType[] = ['direction', 'chirurgien', 'medecin', 'infirmier', 'ambulancier']
    for (const grade of grades) {
        result[grade] = getDefaultPermissionsForGrade(grade)
    }

    // Appliquer les surcharges de la DB
    if (dbPermissions) {
        for (const row of dbPermissions) {
            if (!result[row.grade]) result[row.grade] = {}
            result[row.grade][row.permission_key] = row.granted
        }
    }

    // Direction a toujours tout
    for (const perm of ALL_PERMISSIONS) {
        if (!result['direction']) result['direction'] = {}
        result['direction'][perm.key] = true
    }

    permissionsCache = { data: result, expiry: Date.now() + PERMISSIONS_CACHE_DURATION }
    return result
}

/**
 * Vérifie si un utilisateur a une permission spécifique
 */
export async function checkPermission(userRoles: RoleType[], permissionKey: string): Promise<boolean> {
    // Direction a toujours tout
    if (userRoles.includes('direction')) return true

    // Trouver le grade principal
    const primaryGrade = getPrimaryGrade(userRoles)
    if (!primaryGrade) return false

    // Récupérer la map des permissions
    const permissionsMap = await getPermissionsMap()

    // Vérifier la permission pour ce grade
    return permissionsMap[primaryGrade]?.[permissionKey] ?? false
}

/**
 * Middleware pour vérifier une permission
 * Utilise les rôles stockés en session (définis à la connexion)
 */
export async function requirePermission(permissionKey: string) {
    const session = await auth()

    if (!session?.user?.discord_id) {
        return { authorized: false, error: "Non authentifié.", status: 401, session: null, roles: [] as RoleType[] }
    }

    // Utiliser les rôles stockés dans la session
    const roles = (session.user.roles || []) as RoleType[]

    const hasPerm = await checkPermission(roles, permissionKey)

    if (!hasPerm) {
        return {
            authorized: false,
            error: "Permission insuffisante.",
            status: 403,
            session,
            roles
        }
    }

    return { authorized: true, session, roles }
}

/**
 * Invalidate le cache des permissions
 */
export function invalidatePermissionsCache() {
    permissionsCache = null
}
