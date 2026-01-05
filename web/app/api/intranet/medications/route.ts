import { createClient } from "@/lib/supabase/server"
import { requireEmployeeAccess, requireEditorAccess } from "@/lib/auth-utils"
import { NextResponse } from "next/server"
import { validateBody, MedicationSchema } from "@/lib/validations"

// GET - Récupérer tous les médicaments avec leurs catégories
export async function GET() {
    const authResult = await requireEmployeeAccess()
    if (!authResult.authorized) {
        return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const supabase = await createClient()

    const { data, error } = await supabase
        .from('medications')
        .select(`
            *,
            category:medication_categories(id, name, color, icon)
        `)
        .is('deleted_at', null)
        .order('name', { ascending: true })

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Récupérer aussi les catégories pour le frontend
    const { data: categories } = await supabase
        .from('medication_categories')
        .select('*')
        .order('sort_order', { ascending: true })

    return NextResponse.json({ medications: data || [], categories: categories || [] })
}

// POST - Créer un nouveau médicament
export async function POST(request: Request) {
    const authResult = await requireEditorAccess()
    if (!authResult.authorized) {
        return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const body = await request.json()

    // Validation Zod
    const validation = validateBody(MedicationSchema, body)
    if (!validation.success) {
        return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const { name, dosage, duration, effects, side_effects } = validation.data
    const { category_id, contraindications } = body // Champs optionnels non dans le schéma

    const supabase = await createClient()

    const { data, error } = await supabase
        .from('medications')
        .insert({ name, dosage, duration, effects, side_effects, category_id, contraindications })
        .select(`
            *,
            category:medication_categories(id, name, color, icon)
        `)
        .single()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Audit log
    const { logAudit, getDisplayName } = await import('@/lib/audit')
    await logAudit({
        actorDiscordId: authResult.session?.user?.discord_id || 'unknown',
        actorName: authResult.session?.user ? getDisplayName(authResult.session.user) : undefined,
        action: 'create',
        tableName: 'medications',
        recordId: data.id,
        newData: data
    })

    return NextResponse.json(data, { status: 201 })
}
