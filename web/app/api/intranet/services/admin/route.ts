import { createClient } from "@/lib/supabase/server"
import { requireEditorAccess } from "@/lib/auth-utils"
import { NextResponse } from "next/server"

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
    const weekParam = searchParams.get('week')
    const yearParam = searchParams.get('year')

    const now = new Date()
    const week = weekParam ? parseInt(weekParam) : getISOWeek(now)
    const year = yearParam ? parseInt(yearParam) : now.getFullYear()

    const supabase = await createClient()

    const { data: services, error } = await supabase
        .from('services')
        .select('*')
        .eq('week_number', week)
        .eq('year', year)
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

    // Validation horaires
    if (startDate.getMinutes() % 15 !== 0 || endDate.getMinutes() % 15 !== 0) {
        return NextResponse.json({ error: "Heures sur tranches de 15 min uniquement" }, { status: 400 })
    }

    if (endDate <= startDate) {
        return NextResponse.json({ error: "Fin doit être après début" }, { status: 400 })
    }

    const durationMinutes = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60))
    const slotsCount = Math.floor(durationMinutes / 15)
    const salaryPer15min = GRADE_SALARIES[grade_name] || 625
    const salaryEarned = slotsCount * salaryPer15min

    const week = getISOWeek(startDate)
    const year = startDate.getFullYear()
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

function getISOWeek(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    const dayNum = d.getUTCDay() || 7
    d.setUTCDate(d.getUTCDate() + 4 - dayNum)
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}
