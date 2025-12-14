import { createClient } from "@/lib/supabase/server"
import { requireEmployeeAccess, requireEditorAccess } from "@/lib/auth-utils"
import { NextResponse } from "next/server"

// GET - Récupérer toutes les catégories avec leurs soins
export async function GET() {
    const authResult = await requireEmployeeAccess()
    if (!authResult.authorized) {
        return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const supabase = await createClient()

    const { data: categories, error } = await supabase
        .from('care_categories')
        .select(`
            *,
            care_types (*)
        `)
        .order('sort_order', { ascending: true })

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(categories)
}

// POST - Créer une nouvelle catégorie
export async function POST(request: Request) {
    const authResult = await requireEditorAccess()
    if (!authResult.authorized) {
        return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const body = await request.json()
    const { name, description, sort_order } = body

    if (!name) {
        return NextResponse.json({ error: "Le nom est requis" }, { status: 400 })
    }

    const supabase = await createClient()

    const { data, error } = await supabase
        .from('care_categories')
        .insert({ name, description, sort_order: sort_order || 0 })
        .select()
        .single()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
}
