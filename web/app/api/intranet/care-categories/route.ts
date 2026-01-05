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
        .is('deleted_at', null)
        .order('sort_order', { ascending: true })

    // Filtrer les care_types supprimés dans chaque catégorie
    const filteredCategories = categories?.map(cat => ({
        ...cat,
        care_types: (cat.care_types || []).filter((t: { deleted_at: string | null }) => t.deleted_at === null)
    }))

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(filteredCategories)
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

    // Audit log
    const { logAudit, getDisplayName } = await import('@/lib/audit')
    await logAudit({
        actorDiscordId: authResult.session?.user?.discord_id || 'unknown',
        actorName: authResult.session?.user ? getDisplayName(authResult.session.user) : undefined,
        action: 'create',
        tableName: 'care_categories',
        recordId: data.id,
        newData: data
    })

    return NextResponse.json(data, { status: 201 })
}
