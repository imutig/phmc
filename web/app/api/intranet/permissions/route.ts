import { createClient } from "@/lib/supabase/server"
import { requireEditorAccess, requireEmployeeAccess, RoleType } from "@/lib/auth-utils"
import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"
import { ALL_PERMISSIONS, GradeType, GRADE_HIERARCHY, getDefaultPermissionsForGrade } from "@/lib/permissions"

// Cache des permissions (5 minutes)
let permissionsCache: { data: Record<string, Record<string, boolean>>; expiry: number } | null = null
const CACHE_DURATION = 5 * 60 * 1000

/**
 * Récupère toutes les permissions avec le cache
 */
async function getAllPermissionsFromDB(): Promise<Record<string, Record<string, boolean>>> {
    if (permissionsCache && permissionsCache.expiry > Date.now()) {
        return permissionsCache.data
    }

    const supabase = await createClient()
    const { data: dbPermissions } = await supabase
        .from('grade_permissions')
        .select('grade, permission_key, granted')

    // Construire la map des permissions
    const result: Record<string, Record<string, boolean>> = {}

    // Initialiser avec les permissions par défaut pour chaque grade
    for (const grade of GRADE_HIERARCHY) {
        result[grade] = getDefaultPermissionsForGrade(grade)
    }

    // Appliquer les personnalisations depuis la DB
    if (dbPermissions) {
        for (const row of dbPermissions) {
            if (!result[row.grade]) {
                result[row.grade] = {}
            }
            result[row.grade][row.permission_key] = row.granted
        }
    }

    // Direction a TOUJOURS toutes les permissions
    for (const perm of ALL_PERMISSIONS) {
        result['direction'][perm.key] = true
    }

    permissionsCache = { data: result, expiry: Date.now() + CACHE_DURATION }
    return result
}

/**
 * Invalide le cache des permissions
 */
export function invalidatePermissionsCache() {
    permissionsCache = null
}

// GET - Récupérer les permissions
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const myOnly = searchParams.get('my') === 'true'

    if (myOnly) {
        // Récupérer les permissions de l'utilisateur connecté
        const authResult = await requireEmployeeAccess()
        if (!authResult.authorized) {
            return NextResponse.json({ error: authResult.error }, { status: authResult.status })
        }

        const session = await auth()
        if (!session?.user?.discord_id) {
            return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
        }

        // Déterminer le grade principal de l'utilisateur
        const gradeHierarchy: GradeType[] = ['direction', 'chirurgien', 'medecin', 'infirmier', 'ambulancier']
        let userGrade: GradeType = 'ambulancier'
        for (const grade of gradeHierarchy) {
            if (authResult.roles.includes(grade as RoleType)) {
                userGrade = grade
                break
            }
        }

        const allPerms = await getAllPermissionsFromDB()
        const userPerms = allPerms[userGrade] || {}

        return NextResponse.json({
            grade: userGrade,
            permissions: userPerms
        })
    } else {
        // Récupérer toutes les permissions (Direction uniquement)
        const authResult = await requireEditorAccess()
        if (!authResult.authorized) {
            return NextResponse.json({ error: authResult.error }, { status: authResult.status })
        }

        const allPerms = await getAllPermissionsFromDB()

        return NextResponse.json({
            permissions: allPerms,
            definitions: ALL_PERMISSIONS
        })
    }
}

// PUT - Modifier une permission
export async function PUT(request: Request) {
    const authResult = await requireEditorAccess()
    if (!authResult.authorized) {
        return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const session = await auth()
    if (!session?.user?.discord_id) {
        return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }

    const body = await request.json()
    const { grade, permission_key, granted } = body

    if (!grade || !permission_key || typeof granted !== 'boolean') {
        return NextResponse.json({ error: "grade, permission_key et granted requis" }, { status: 400 })
    }

    // Impossible de modifier les permissions de la direction
    if (grade === 'direction') {
        return NextResponse.json({ error: "Impossible de modifier les permissions de la Direction" }, { status: 400 })
    }

    // Vérifier que le grade existe
    if (!GRADE_HIERARCHY.includes(grade)) {
        return NextResponse.json({ error: "Grade invalide" }, { status: 400 })
    }

    // Vérifier que la permission existe
    const permExists = ALL_PERMISSIONS.find(p => p.key === permission_key)
    if (!permExists) {
        return NextResponse.json({ error: "Permission invalide" }, { status: 400 })
    }

    const supabase = await createClient()

    // Upsert la permission
    const { error } = await supabase
        .from('grade_permissions')
        .upsert({
            grade,
            permission_key,
            granted,
            updated_by: session.user.discord_id,
            updated_at: new Date().toISOString()
        }, {
            onConflict: 'grade,permission_key'
        })

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Audit log
    const { logAudit, getDisplayName } = await import('@/lib/audit')
    await logAudit({
        actorDiscordId: session.user.discord_id,
        actorName: getDisplayName(session.user),
        action: 'update',
        tableName: 'grade_permissions',
        newData: { grade, permission_key, granted }
    })

    // Invalider le cache
    invalidatePermissionsCache()

    return NextResponse.json({ success: true })
}

// POST - Réinitialiser les permissions par défaut d'un grade
export async function POST(request: Request) {
    const authResult = await requireEditorAccess()
    if (!authResult.authorized) {
        return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const body = await request.json()
    const { grade, reset } = body

    if (!grade || !reset) {
        return NextResponse.json({ error: "grade et reset=true requis" }, { status: 400 })
    }

    if (grade === 'direction') {
        return NextResponse.json({ error: "Impossible de modifier la Direction" }, { status: 400 })
    }

    if (!GRADE_HIERARCHY.includes(grade)) {
        return NextResponse.json({ error: "Grade invalide" }, { status: 400 })
    }

    const supabase = await createClient()

    // Supprimer toutes les personnalisations pour ce grade
    const { error } = await supabase
        .from('grade_permissions')
        .delete()
        .eq('grade', grade)

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Audit log
    const { logAudit, getDisplayName } = await import('@/lib/audit')
    await logAudit({
        actorDiscordId: authResult.session?.user?.discord_id || 'unknown',
        actorName: authResult.session?.user ? getDisplayName(authResult.session.user) : undefined,
        action: 'update',
        tableName: 'grade_permissions',
        newData: { grade, action: 'reset_to_default' }
    })

    // Invalider le cache
    invalidatePermissionsCache()

    return NextResponse.json({ success: true, message: `Permissions de ${grade} réinitialisées` })
}
