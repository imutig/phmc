import { NextRequest, NextResponse } from "next/server"
import { requirePermission } from "@/lib/auth-utils"
import { createClient } from "@supabase/supabase-js"

export const dynamic = 'force-dynamic'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
)

/**
 * PATCH /api/admin/employees/[discordId]/ign
 * Met à jour l'IGN d'un employé
 * Nécessite la permission manage_employees
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ discordId: string }> }
) {
    const { discordId } = await params

    // Vérifier les permissions
    const { authorized, error: permError } = await requirePermission('manage_employees')
    if (!authorized) {
        return NextResponse.json({ error: permError || 'Accès refusé' }, { status: 403 })
    }

    try {
        const body = await request.json()
        const { ign } = body

        if (ign === undefined) {
            return NextResponse.json({ error: 'IGN requis' }, { status: 400 })
        }

        // Mettre à jour l'IGN
        const { error: updateError } = await supabase
            .from('users')
            .update({
                ign: ign || null,
                updated_at: new Date().toISOString()
            })
            .eq('discord_id', discordId)

        if (updateError) {
            console.error('[IGN Update] DB error:', updateError)
            return NextResponse.json({ error: 'Erreur mise à jour' }, { status: 500 })
        }

        // Audit log
        const { logAudit } = await import('@/lib/audit')
        const { auth } = await import('@/lib/auth')
        const session = await auth()
        await logAudit({
            actorDiscordId: session?.user?.discord_id || 'admin',
            actorName: session?.user?.name || undefined,
            action: 'update',
            tableName: 'users',
            newData: { target_discord_id: discordId, ign: ign || null, source: 'admin_update_effectif' }
        })

        return NextResponse.json({
            success: true,
            discordId,
            ign: ign || null
        })
    } catch (error) {
        console.error('[IGN Update] Error:', error)
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
}
