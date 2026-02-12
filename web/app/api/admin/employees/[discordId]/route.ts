import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/auth-utils"
import { createClient } from "@supabase/supabase-js"

export const dynamic = 'force-dynamic'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
)

/**
 * DELETE /api/admin/employees/[discordId]
 * Supprime un employé de la table users
 * Nécessite la permission manage_employees
 */
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ discordId: string }> }
) {
    const { discordId } = await params

    const { authorized, error: permError } = await requirePermission('manage_employees')
    if (!authorized) {
        return NextResponse.json({ error: permError || 'Accès refusé' }, { status: 403 })
    }

    try {
        const { data: existingUser, error: fetchError } = await supabase
            .from('users')
            .select('id, discord_id, discord_username')
            .eq('discord_id', discordId)
            .single()

        if (fetchError || !existingUser) {
            return NextResponse.json({ error: 'Employé introuvable' }, { status: 404 })
        }

        const { error: deleteError } = await supabase
            .from('users')
            .delete()
            .eq('discord_id', discordId)

        if (deleteError) {
            console.error('[Employee Delete] DB error:', deleteError)
            return NextResponse.json({ error: 'Erreur lors de la suppression' }, { status: 500 })
        }

        const { logAudit } = await import('@/lib/audit')
        const { auth } = await import('@/lib/auth')
        const session = await auth()

        await logAudit({
            actorDiscordId: session?.user?.discord_id || 'admin',
            actorName: session?.user?.name || undefined,
            action: 'delete',
            tableName: 'users',
            recordId: existingUser.id,
            oldData: {
                discord_id: existingUser.discord_id,
                discord_username: existingUser.discord_username,
                source: 'admin_delete_effectif'
            }
        })

        return NextResponse.json({
            success: true,
            discordId,
            displayName: existingUser.discord_username || discordId
        })
    } catch (error) {
        console.error('[Employee Delete] Error:', error)
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
}
