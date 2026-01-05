import { createClient } from "@/lib/supabase/server"
import { requireEmployeeAccess } from "@/lib/auth-utils"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"

// DELETE - Supprimer un service (propriétaire ou direction) - Soft Delete
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const authResult = await requireEmployeeAccess()
    if (!authResult.authorized) {
        return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const session = await auth()
    if (!session?.user?.discord_id) {
        return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }

    const { id } = await params
    const supabase = await createClient()

    // Vérifier que le service appartient à l'utilisateur (sauf direction)
    const { data: service } = await supabase
        .from('services')
        .select('*')
        .eq('id', id)
        .is('deleted_at', null)
        .single()

    if (!service) {
        return NextResponse.json({ error: "Service non trouvé" }, { status: 404 })
    }

    const isOwner = service.user_discord_id === session.user.discord_id
    const isDirection = authResult.roles.includes('direction')

    if (!isOwner && !isDirection) {
        return NextResponse.json({ error: "Non autorisé" }, { status: 403 })
    }

    // Soft delete au lieu de hard delete
    const { error } = await supabase
        .from('services')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Audit log
    const { logAudit, getDisplayName } = await import('@/lib/audit')
    await logAudit({
        actorDiscordId: session.user.discord_id,
        actorName: getDisplayName(session.user),
        action: 'delete',
        tableName: 'services',
        recordId: id,
        oldData: service
    })

    return NextResponse.json({ success: true })
}
