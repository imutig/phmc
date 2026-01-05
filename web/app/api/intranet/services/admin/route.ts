import { createClient } from "@/lib/supabase/server"
import { requireEditorAccess } from "@/lib/auth-utils"
import { NextResponse } from "next/server"
import { getISOWeekAndYear } from "@/lib/date-utils"

// Salaires par grade
const GRADE_SALARIES: Record<string, number> = {
    direction: 1100,
    chirurgien: 1000,
    medecin: 900,
    infirmier: 700,
    ambulancier: 625
}

// GET - Récupérer tous les services de tous les employés (direction uniquement)
export async function GET(request: Request) {
    const authResult = await requireEditorAccess()
    if (!authResult.authorized) {
        return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const { searchParams } = new URL(request.url)
    const liveParam = searchParams.get('live')

    const supabase = await createClient()

    // Si on demande les services en cours
    if (liveParam === 'true') {
        const { data: services, error } = await supabase
            .from('services')
            .select('id, user_discord_id, user_name, user_avatar_url, grade_name, start_time')
            .is('deleted_at', null)
            .is('end_time', null)
            .order('start_time', { ascending: true })

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ services: services || [] })
    }

    // Sinon, récupérer les services terminés de la semaine
    const weekParam = searchParams.get('week')
    const yearParam = searchParams.get('year')

    const now = new Date()
    const { week: currentWeek, year: currentYear } = getISOWeekAndYear(now)
    const week = weekParam ? parseInt(weekParam) : currentWeek
    const year = yearParam ? parseInt(yearParam) : currentYear

    const { data: services, error } = await supabase
        .from('services')
        .select('*')
        .is('deleted_at', null)
        .eq('week_number', week)
        .eq('year', year)
        .not('end_time', 'is', null)
        .order('user_name', { ascending: true })
        .order('start_time', { ascending: true })

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Grouper par utilisateur
    const byUser: Record<string, {
        user_discord_id: string
        user_name: string
        user_avatar_url: string | null
        grade_name: string
        services: typeof services
        totalMinutes: number
        totalSalary: number
    }> = {}

    for (const service of services || []) {
        if (!byUser[service.user_discord_id]) {
            byUser[service.user_discord_id] = {
                user_discord_id: service.user_discord_id,
                user_name: service.user_name,
                user_avatar_url: service.user_avatar_url || null,
                grade_name: service.grade_name,
                services: [],
                totalMinutes: 0,
                totalSalary: 0
            }
        }
        byUser[service.user_discord_id].services.push(service)
        byUser[service.user_discord_id].totalMinutes += service.duration_minutes
        byUser[service.user_discord_id].totalSalary += service.salary_earned
    }

    return NextResponse.json({
        week,
        year,
        services: services || [], // Pour compatibilité avec le dashboard
        employees: Object.values(byUser),
        totals: {
            totalServices: services?.length || 0,
            totalMinutes: services?.reduce((sum, s) => sum + s.duration_minutes, 0) || 0,
            totalSalary: services?.reduce((sum, s) => sum + s.salary_earned, 0) || 0
        }
    })
}

// POST - Créer un service pour n'importe quel utilisateur (direction uniquement)
export async function POST(request: Request) {
    const authResult = await requireEditorAccess()
    if (!authResult.authorized) {
        return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const body = await request.json()
    const { user_discord_id, user_name, grade_name, start_time, end_time } = body

    if (!user_discord_id || !user_name || !grade_name || !start_time || !end_time) {
        return NextResponse.json({ error: "Tous les champs sont requis" }, { status: 400 })
    }

    const startDate = new Date(start_time)
    const endDate = new Date(end_time)

    if (endDate <= startDate) {
        return NextResponse.json({ error: "Fin doit être après début" }, { status: 400 })
    }

    const durationMinutes = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60))
    const slotsCount = Math.floor(durationMinutes / 15)
    const salaryPer15min = GRADE_SALARIES[grade_name] || 625
    const salaryEarned = slotsCount * salaryPer15min

    const { week, year } = getISOWeekAndYear(startDate)
    const serviceDate = startDate.toISOString().split('T')[0]

    const supabase = await createClient()

    const { data, error } = await supabase
        .from('services')
        .insert({
            user_discord_id,
            user_name,
            grade_name,
            start_time: startDate.toISOString(),
            end_time: endDate.toISOString(),
            duration_minutes: durationMinutes,
            slots_count: slotsCount,
            salary_earned: salaryEarned,
            week_number: week,
            year,
            service_date: serviceDate
        })
        .select()
        .single()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
}

// DELETE - Supprimer un service par ID (direction uniquement)
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
        .from('services')
        .delete()
        .eq('id', id)

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
}

// PUT - Modifier un service existant (direction uniquement)
export async function PUT(request: Request) {
    const authResult = await requireEditorAccess()
    if (!authResult.authorized) {
        return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const body = await request.json()
    const { service_id, start_time, end_time } = body

    if (!service_id || !start_time || !end_time) {
        return NextResponse.json({ error: "service_id, start_time et end_time requis" }, { status: 400 })
    }

    const supabase = await createClient()

    // Récupérer le service existant
    const { data: service, error: fetchError } = await supabase
        .from('services')
        .select('*')
        .eq('id', service_id)
        .single()

    if (fetchError || !service) {
        return NextResponse.json({ error: "Service non trouvé" }, { status: 404 })
    }

    const startDate = new Date(start_time)
    const endDate = new Date(end_time)

    if (endDate <= startDate) {
        return NextResponse.json({ error: "Fin doit être après début" }, { status: 400 })
    }

    const durationMinutes = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60))
    const slotsCount = Math.floor(durationMinutes / 15)
    const salaryPer15min = GRADE_SALARIES[service.grade_name] || 625
    const salaryEarned = slotsCount * salaryPer15min

    const { data: updated, error: updateError } = await supabase
        .from('services')
        .update({
            start_time: startDate.toISOString(),
            end_time: endDate.toISOString(),
            duration_minutes: durationMinutes,
            slots_count: slotsCount,
            salary_earned: salaryEarned,
            updated_at: new Date().toISOString()
        })
        .eq('id', service_id)
        .select()
        .single()

    if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ service: updated })
}
