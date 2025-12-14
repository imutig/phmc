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
    const { name, dosage, duration, effects, side_effects } = body

    const supabase = await createClient()

    const { data, error } = await supabase
        .from('medications')
        .update({ name, dosage, duration, effects, side_effects, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
}

// DELETE - Supprimer un médicament
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
        .from('medications')
        .delete()
        .eq('id', id)

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
}
