import { createClient } from "@/lib/supabase/server"
import { requireEmployeeAccess, requireEditorAccess } from "@/lib/auth-utils"
import { NextResponse } from "next/server"

// GET - Récupérer tous les médicaments
export async function GET() {
    const authResult = await requireEmployeeAccess()
    if (!authResult.authorized) {
        return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const supabase = await createClient()

    const { data, error } = await supabase
        .from('medications')
        .select('*')
        .order('name', { ascending: true })

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
}

// POST - Créer un nouveau médicament
export async function POST(request: Request) {
    const authResult = await requireEditorAccess()
    if (!authResult.authorized) {
        return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const body = await request.json()
    const { name, dosage, duration, effects, side_effects } = body

    if (!name) {
        return NextResponse.json({ error: "Le nom est requis" }, { status: 400 })
    }

    const supabase = await createClient()

    const { data, error } = await supabase
        .from('medications')
        .insert({ name, dosage, duration, effects, side_effects })
        .select()
        .single()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
}
