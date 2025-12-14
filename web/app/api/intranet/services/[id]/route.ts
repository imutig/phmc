import { createClient } from "@/lib/supabase/server"
import { requireEmployeeAccess } from "@/lib/auth-utils"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"

// DELETE - Supprimer un service (propriétaire ou direction)
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
        .select('user_discord_id')
        .eq('id', id)
        .single()

    if (!service) {
        return NextResponse.json({ error: "Service non trouvé" }, { status: 404 })
    }

    const isOwner = service.user_discord_id === session.user.discord_id
    const isDirection = authResult.roles.includes('direction')

    if (!isOwner && !isDirection) {
        return NextResponse.json({ error: "Non autorisé" }, { status: 403 })
    }

    const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', id)

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
}
