import { createClient } from "@/lib/supabase/server"
import { requireEmployeeAccess, requireEditorAccess } from "@/lib/auth-utils"
import { NextResponse } from "next/server"

// GET - Récupérer toutes les catégories de médicaments
export async function GET() {
    const authResult = await requireEmployeeAccess()
    if (!authResult.authorized) {
        return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const supabase = await createClient()

    const { data, error } = await supabase
        .from('medication_categories')
        .select('*')
        .order('sort_order', { ascending: true })

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
}

// POST - Créer une nouvelle catégorie
export async function POST(request: Request) {
    const authResult = await requireEditorAccess()
    if (!authResult.authorized) {
        return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const body = await request.json()
    const { name, color, icon } = body

    if (!name) {
        return NextResponse.json({ error: "Le nom est requis" }, { status: 400 })
    }

    const supabase = await createClient()

    // Déterminer le prochain sort_order
    const { data: existing } = await supabase
        .from('medication_categories')
        .select('sort_order')
        .order('sort_order', { ascending: false })
        .limit(1)

    const nextOrder = (existing?.[0]?.sort_order || 0) + 1

    const { data, error } = await supabase
        .from('medication_categories')
        .insert({
            name,
            color: color || '#3b82f6',
            icon: icon || 'pill',
            sort_order: nextOrder
        })
        .select()
        .single()

    if (error) {
        if (error.code === '23505') {
            return NextResponse.json({ error: "Une catégorie avec ce nom existe déjà" }, { status: 400 })
        }
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
}

// DELETE - Supprimer une catégorie
export async function DELETE(request: Request) {
    const authResult = await requireEditorAccess()
    if (!authResult.authorized) {
        return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
        return NextResponse.json({ error: "ID requis" }, { status: 400 })
    }

    const supabase = await createClient()

    const { error } = await supabase
        .from('medication_categories')
        .delete()
        .eq('id', id)

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
}
