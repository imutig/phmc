import { createClient } from "@/lib/supabase/server"
import { requireEmployeeAccess, requireEditorAccess } from "@/lib/auth-utils"
import { NextResponse } from "next/server"

// GET - Récupérer tous les types de soins
export async function GET() {
    const authResult = await requireEmployeeAccess()
    if (!authResult.authorized) {
        return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const supabase = await createClient()

    const { data, error } = await supabase
        .from('care_types')
        .select(`
            *,
            care_categories (name)
        `)
        .order('name', { ascending: true })

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
}

// POST - Créer un nouveau type de soin
export async function POST(request: Request) {
    const authResult = await requireEditorAccess()
    if (!authResult.authorized) {
        return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const body = await request.json()
    const { category_id, name, price, description } = body

    if (!category_id || !name || price === undefined) {
        return NextResponse.json({ error: "category_id, name et price sont requis" }, { status: 400 })
    }

    const supabase = await createClient()

    const { data, error } = await supabase
        .from('care_types')
        .insert({ category_id, name, price, description })
        .select()
        .single()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
}
