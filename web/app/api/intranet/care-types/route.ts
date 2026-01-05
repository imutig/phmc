import { createClient } from "@/lib/supabase/server"
import { requireEmployeeAccess, requireEditorAccess } from "@/lib/auth-utils"
import { NextResponse } from "next/server"
import { validateBody, CareTypeSchema } from "@/lib/validations"

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
        .is('deleted_at', null)
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

    // Validation Zod
    const validation = validateBody(CareTypeSchema, body)
    if (!validation.success) {
        return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const { category_id, name, price, description } = validation.data

    const supabase = await createClient()

    const { data, error } = await supabase
        .from('care_types')
        .insert({ category_id, name, price, description })
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
        action: 'create',
        tableName: 'care_types',
        recordId: data.id,
        newData: data
    })

    return NextResponse.json(data, { status: 201 })
}
