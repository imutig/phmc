import { createClient } from "@/lib/supabase/server"
import { requireEditorAccess } from "@/lib/auth-utils"
import { NextResponse } from "next/server"

// PUT - Modifier un type de soin
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
    const { category_id, name, price, description } = body

    const supabase = await createClient()

    // Récupérer l'ancienne valeur pour l'audit
    const { data: oldData } = await supabase
        .from('care_types')
        .select('*')
        .eq('id', id)
        .is('deleted_at', null)
        .single()

    const { data, error } = await supabase
        .from('care_types')
        .update({ category_id, name, price, description, updated_at: new Date().toISOString() })
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
        tableName: 'care_types',
        recordId: id,
        oldData: oldData || undefined,
        newData: data
    })

    return NextResponse.json(data)
}

// DELETE - Supprimer un type de soin - Soft Delete
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
    const { data: careType } = await supabase
        .from('care_types')
        .select('*')
        .eq('id', id)
        .is('deleted_at', null)
        .single()

    if (!careType) {
        return NextResponse.json({ error: "Type de soin non trouvé" }, { status: 404 })
    }

    // Soft delete
    const { error } = await supabase
        .from('care_types')
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
        tableName: 'care_types',
        recordId: id,
        oldData: careType
    })

    return NextResponse.json({ success: true })
}
