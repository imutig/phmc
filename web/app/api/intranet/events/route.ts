import { createClient } from "@/lib/supabase/server"
import { requireEmployeeAccess, requireEditorAccess } from "@/lib/auth-utils"
import { NextResponse } from "next/server"
import { z } from "zod"

const EventSchema = z.object({
    title: z.string().min(1, "Titre requis").max(200),
    description: z.string().max(2000).optional(),
    event_date: z.string().datetime(),
    end_date: z.string().datetime().optional(),
    location: z.string().max(200).optional(),
    event_type: z.enum(['general', 'ceremonie', 'formation', 'reunion', 'fete']).default('general'),
    color: z.string().max(20).default('#ef4444'),
    is_published: z.boolean().default(true),
})

// GET - Récupérer les événements
export async function GET(request: Request) {
    const authResult = await requireEmployeeAccess()
    if (!authResult.authorized) {
        return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const { searchParams } = new URL(request.url)
    const upcoming = searchParams.get('upcoming') === 'true'
    const limit = parseInt(searchParams.get('limit') || '50')

    const supabase = await createClient()

    let query = supabase
        .from('events')
        .select('*')
        .eq('is_published', true)
        .order('event_date', { ascending: true })

    if (upcoming) {
        query = query.gte('event_date', new Date().toISOString())
    }

    if (limit) {
        query = query.limit(limit)
    }

    const { data, error } = await query

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ events: data || [] })
}

// POST - Créer un événement (direction uniquement)
export async function POST(request: Request) {
    const authResult = await requireEditorAccess()
    if (!authResult.authorized) {
        return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const body = await request.json()
    const result = EventSchema.safeParse(body)
    if (!result.success) {
        return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 })
    }

    const supabase = await createClient()

    const { data, error } = await supabase
        .from('events')
        .insert({
            ...result.data,
            created_by: authResult.session?.user?.discord_id
        })
        .select()
        .single()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
}

// PUT - Mettre à jour un événement (direction uniquement)
export async function PUT(request: Request) {
    const authResult = await requireEditorAccess()
    if (!authResult.authorized) {
        return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
        return NextResponse.json({ error: "ID requis" }, { status: 400 })
    }

    const body = await request.json()
    const result = EventSchema.partial().safeParse(body)
    if (!result.success) {
        return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 })
    }

    const supabase = await createClient()

    const { data, error } = await supabase
        .from('events')
        .update({
            ...result.data,
            updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
}

// DELETE - Supprimer un événement (direction uniquement)
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
        .from('events')
        .delete()
        .eq('id', id)

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
}
