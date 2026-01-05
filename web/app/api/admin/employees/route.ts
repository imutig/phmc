import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { requirePermission } from "@/lib/auth-utils"
import { createClient } from "@supabase/supabase-js"
import { GRADE_INFO, GradeType } from "@/lib/permissions"

export const dynamic = 'force-dynamic'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
)

/**
 * GET /api/admin/employees
 * Liste tous les employés avec leurs informations
 * Nécessite la permission manage_employees
 */
export async function GET() {
    // Vérifier les permissions
    const { authorized, error: permError } = await requirePermission('manage_employees')
    if (!authorized) {
        return NextResponse.json({ error: permError || 'Accès refusé' }, { status: 403 })
    }

    try {
        // Récupérer tous les utilisateurs avec leurs infos
        const { data: users, error } = await supabase
            .from('users')
            .select('id, discord_id, discord_username, avatar_url, ign, grade, updated_at, created_at')
            .order('discord_username', { ascending: true })

        if (error) {
            console.error('Erreur récupération employés:', error)
            return NextResponse.json({ error: 'Erreur base de données' }, { status: 500 })
        }

        // Enrichir les données avec les infos de grade
        const employees = (users || []).map(user => ({
            id: user.id,
            discordId: user.discord_id,
            displayName: user.discord_username || 'Inconnu',
            avatarUrl: user.avatar_url || null,
            ign: user.ign || null,
            grade: user.grade || null,
            gradeInfo: user.grade && GRADE_INFO[user.grade as GradeType]
                ? GRADE_INFO[user.grade as GradeType]
                : null,
            lastSync: user.updated_at,
            createdAt: user.created_at
        }))

        return NextResponse.json({ employees })
    } catch (error) {
        console.error('Erreur API employees:', error)
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
}
