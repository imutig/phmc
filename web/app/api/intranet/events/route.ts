import { createClient } from "@/lib/supabase/server"
import { requireEmployeeAccess } from "@/lib/auth-utils"
import { NextResponse } from "next/server"
import { z } from "zod"

const EventSchema = z.object({
    title: z.string().min(1, "Titre requis").max(200),
    description: z.string().max(2000).optional().nullable(),
    event_date: z.string(), // Date au format YYYY-MM-DD
    start_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/, "Format heure invalide"),
    end_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/, "Format heure invalide"),
    location: z.string().max(200).optional().nullable(),
    event_type: z.enum(['general', 'ceremonie', 'formation', 'reunion', 'fete', 'rdv', 'autre']).default('general'),
    event_size: z.enum(['major', 'minor']).default('minor'),
    color: z.string().max(20).default('#ef4444'),
    is_published: z.boolean().default(true),
    participants_all: z.boolean().default(false),
    participants: z.array(z.string()).optional(), // Discord IDs des participants spécifiques
})

// GET - Récupérer les événements
export async function GET(request: Request) {
    const authResult = await requireEmployeeAccess()
    if (!authResult.authorized) {
        return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const { searchParams } = new URL(request.url)
    const upcoming = searchParams.get('upcoming') === 'true'
    const today = searchParams.get('today') === 'true'
    const week = searchParams.get('week')
    const year = searchParams.get('year')
    const limit = parseInt(searchParams.get('limit') || '100')

    const supabase = await createClient()

    let query = supabase
        .from('events')
        .select(`
            *,
            event_participants (
                user_discord_id,
                user_name
            )
        `)
        .eq('is_published', true)
        .order('event_date', { ascending: true })
        .order('start_time', { ascending: true })

    // Filtrer par date
    if (today) {
        const todayDate = new Date().toISOString().split('T')[0]
        query = query
            .gte('event_date', `${todayDate}T00:00:00`)
            .lt('event_date', `${todayDate}T23:59:59`)
    } else if (upcoming) {
        query = query.gte('event_date', new Date().toISOString().split('T')[0])
    } else if (week && year) {
        // Calculer les dates de début et fin de semaine
        const startOfWeek = getStartOfWeek(parseInt(week), parseInt(year))
        const endOfWeek = new Date(startOfWeek)
        endOfWeek.setDate(endOfWeek.getDate() + 6)

        const startStr = startOfWeek.toISOString().split('T')[0]
        const endStr = endOfWeek.toISOString().split('T')[0]

        query = query
            .gte('event_date', `${startStr}T00:00:00`)
            .lte('event_date', `${endStr}T23:59:59`)
    }

    if (limit) {
        query = query.limit(limit)
    }

    const { data, error } = await query

    if (error) {
        console.error('Events fetch error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Récupérer les noms des créateurs
    const creatorIds = [...new Set((data || []).map(e => e.created_by).filter(Boolean))]
    let creatorNames: Record<string, string> = {}

    if (creatorIds.length > 0) {
        const { data: users } = await supabase
            .from('users')
            .select('discord_id, discord_username')
            .in('discord_id', creatorIds)

        if (users) {
            creatorNames = Object.fromEntries(users.map(u => [u.discord_id, u.discord_username]))
        }
    }

    // Ajouter le nom du créateur
    const eventsWithCreatorName = (data || []).map((event: any) => ({
        ...event,
        created_by_name: creatorNames[event.created_by] || null
    }))

    return NextResponse.json({ events: eventsWithCreatorName })
}

// POST - Créer un événement (tous les employés)
export async function POST(request: Request) {
    const authResult = await requireEmployeeAccess()
    if (!authResult.authorized) {
        return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const body = await request.json()
    const result = EventSchema.safeParse(body)
    if (!result.success) {
        return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 })
    }

    const { participants, ...eventData } = result.data
    const supabase = await createClient()

    // Construire event_date avec l'heure pour compatibilité
    const eventDateTime = `${eventData.event_date}T${eventData.start_time}:00`

    const { data: event, error } = await supabase
        .from('events')
        .insert({
            ...eventData,
            event_date: eventDateTime,
            created_by: authResult.session?.user?.discord_id
        })
        .select()
        .single()

    if (error) {
        console.error('Event create error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Ajouter les participants spécifiques si fournis
    if (participants && participants.length > 0 && !eventData.participants_all) {
        const participantsData = participants.map(discordId => ({
            event_id: event.id,
            user_discord_id: discordId
        }))

        await supabase.from('event_participants').insert(participantsData)
    }

    return NextResponse.json(event, { status: 201 })
}

// PUT - Mettre à jour un événement (créateur ou direction)
export async function PUT(request: Request) {
    const authResult = await requireEmployeeAccess()
    if (!authResult.authorized) {
        return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
        return NextResponse.json({ error: "ID requis" }, { status: 400 })
    }

    const supabase = await createClient()

    // Vérifier que l'utilisateur est le créateur ou direction
    const { data: existingEvent } = await supabase
        .from('events')
        .select('created_by')
        .eq('id', id)
        .single()

    const isCreator = existingEvent?.created_by === authResult.session?.user?.discord_id
    const isDirection = authResult.session?.user?.roles?.includes('direction')

    if (!isCreator && !isDirection) {
        return NextResponse.json({ error: "Vous ne pouvez modifier que vos propres événements" }, { status: 403 })
    }

    const body = await request.json()
    const result = EventSchema.partial().safeParse(body)
    if (!result.success) {
        return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 })
    }

    const { participants, ...eventData } = result.data

    // Préparer les données de mise à jour
    const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString()
    }

    // Copier les champs fournis (sauf event_date qu'on traite séparément)
    if (eventData.title !== undefined) updateData.title = eventData.title
    if (eventData.description !== undefined) updateData.description = eventData.description
    if (eventData.location !== undefined) updateData.location = eventData.location
    if (eventData.event_type !== undefined) updateData.event_type = eventData.event_type
    if (eventData.event_size !== undefined) updateData.event_size = eventData.event_size
    if (eventData.color !== undefined) updateData.color = eventData.color
    if (eventData.is_published !== undefined) updateData.is_published = eventData.is_published
    if (eventData.participants_all !== undefined) updateData.participants_all = eventData.participants_all

    // Mettre à jour start_time et end_time (format HH:MM seulement)
    if (eventData.start_time !== undefined) {
        updateData.start_time = eventData.start_time.slice(0, 5) // Garder seulement HH:MM
    }
    if (eventData.end_time !== undefined) {
        updateData.end_time = eventData.end_time.slice(0, 5) // Garder seulement HH:MM
    }

    // Mettre à jour event_date si fourni (reconstruire avec l'heure)
    if (eventData.event_date !== undefined) {
        const dateOnly = eventData.event_date.split('T')[0] // Extraire YYYY-MM-DD
        const timeToUse = eventData.start_time?.slice(0, 5) || '00:00'
        updateData.event_date = `${dateOnly}T${timeToUse}:00`
    }

    const { data, error } = await supabase
        .from('events')
        .update(updateData)
        .eq('id', id)
        .select()
        .maybeSingle()

    if (error) {
        console.error('Event update error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
        return NextResponse.json({ error: "Événement non trouvé ou non autorisé" }, { status: 404 })
    }

    // Mettre à jour les participants si fournis
    if (participants !== undefined) {
        // Supprimer les anciens participants
        await supabase.from('event_participants').delete().eq('event_id', id)

        // Ajouter les nouveaux
        if (participants.length > 0 && !eventData.participants_all) {
            const participantsData = participants.map(discordId => ({
                event_id: id,
                user_discord_id: discordId
            }))
            await supabase.from('event_participants').insert(participantsData)
        }
    }

    return NextResponse.json(data)
}

// DELETE - Supprimer un événement (créateur ou direction)
export async function DELETE(request: Request) {
    const authResult = await requireEmployeeAccess()
    if (!authResult.authorized) {
        return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
        return NextResponse.json({ error: "ID requis" }, { status: 400 })
    }

    const supabase = await createClient()

    // Vérifier que l'utilisateur est le créateur ou direction
    const { data: existingEvent } = await supabase
        .from('events')
        .select('created_by')
        .eq('id', id)
        .single()

    const isCreator = existingEvent?.created_by === authResult.session?.user?.discord_id
    const isDirection = authResult.session?.user?.roles?.includes('direction')

    if (!isCreator && !isDirection) {
        return NextResponse.json({ error: "Vous ne pouvez supprimer que vos propres événements" }, { status: 403 })
    }

    const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', id)

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
}

// Helper: Calculer le début de semaine ISO
function getStartOfWeek(week: number, year: number): Date {
    const simple = new Date(year, 0, 1 + (week - 1) * 7)
    const dow = simple.getDay()
    const ISOweekStart = simple
    if (dow <= 4)
        ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1)
    else
        ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay())
    return ISOweekStart
}
