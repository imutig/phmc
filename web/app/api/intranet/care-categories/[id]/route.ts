import { createClient } from "@/lib/supabase/server"
import { requireEditorAccess } from "@/lib/auth-utils"
import { NextResponse } from "next/server"

// PUT - Modifier une catégorie
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
    const { name, description, sort_order } = body

    const supabase = await createClient()

    const { data, error } = await supabase
        .from('care_categories')
        .update({ name, description, sort_order, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
}

// DELETE - Supprimer une catégorie
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

    const { error } = await supabase
        .from('care_categories')
        .delete()
        .eq('id', id)

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
}
