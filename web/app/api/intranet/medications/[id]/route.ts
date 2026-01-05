import { createClient } from "@/lib/supabase/server"
import { requireEditorAccess } from "@/lib/auth-utils"
import { NextResponse } from "next/server"

// PUT - Modifier un médicament
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const authResult = await requireEditorAccess()
    if (!authResult.authorized) {
        return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const { id } = await params
    const body = await request.json()
    const { name, dosage, duration, effects, side_effects, category_id, contraindications } = body

    const supabase = await createClient()

    // Récupérer l'ancienne valeur pour l'audit
    const { data: oldData } = await supabase
        .from('medications')
        .select('*')
        .eq('id', id)
        .is('deleted_at', null)
        .single()

    const { data, error } = await supabase
        .from('medications')
        .update({ name, dosage, duration, effects, side_effects, category_id, contraindications, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Audit log
    const { logAudit, getDisplayName } = await import('@/lib/audit')
    await logAudit({
        actorDiscordId: authResult.session?.user?.discord_id || 'unknown',
        actorName: authResult.session?.user ? getDisplayName(authResult.session.user) : undefined,
        action: 'update',
        tableName: 'medications',
        recordId: id,
        oldData: oldData || undefined,
        newData: data
    })

    return NextResponse.json(data)
}

// DELETE - Supprimer un médicament - Soft Delete
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const authResult = await requireEditorAccess()
    if (!authResult.authorized) {
        return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const { id } = await params
    const supabase = await createClient()

    // Récupérer les données pour l'audit
    const { data: medication } = await supabase
        .from('medications')
        .select('*')
        .eq('id', id)
        .is('deleted_at', null)
        .single()

    if (!medication) {
        return NextResponse.json({ error: "Médicament non trouvé" }, { status: 404 })
    }

    // Soft delete
    const { error } = await supabase
        .from('medications')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Audit log
    const { logAudit, getDisplayName } = await import('@/lib/audit')
    await logAudit({
        actorDiscordId: authResult.session?.user?.discord_id || 'unknown',
        actorName: authResult.session?.user ? getDisplayName(authResult.session.user) : undefined,
        action: 'delete',
        tableName: 'medications',
        recordId: id,
        oldData: medication
    })

    return NextResponse.json({ success: true })
}
