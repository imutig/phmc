import { createClient } from "@/lib/supabase/server"
import { requireEmployeeAccess, getPrimaryGrade, checkDiscordRoles } from "@/lib/auth-utils"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"

// Salaires par grade (fallback)
const GRADE_SALARIES: Record<string, number> = {
    direction: 1100,
    chirurgien: 1000,
    medecin: 900,
    infirmier: 700,
    ambulancier: 625
}

const GRADE_MAX_WEEKLY: Record<string, number> = {
    direction: 150000,
    chirurgien: 120000,
    medecin: 100000,
    infirmier: 85000,
    ambulancier: 80000
}

// GET - Récupérer les services de l'utilisateur connecté (semaine courante par défaut)
export async function GET(request: Request) {
    const authResult = await requireEmployeeAccess()
    if (!authResult.authorized) {
        return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const session = await auth()
    if (!session?.user?.discord_id) {
        return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const weekParam = searchParams.get('week')
    const yearParam = searchParams.get('year')

    // Semaine ISO courante par défaut
    const now = new Date()
    const week = weekParam ? parseInt(weekParam) : getISOWeek(now)
    const year = yearParam ? parseInt(yearParam) : now.getFullYear()

    const supabase = await createClient()

    const { data: services, error } = await supabase
        .from('services')
        .select('*')
        .eq('user_discord_id', session.user.discord_id)
        .eq('week_number', week)
        .eq('year', year)
        .order('start_time', { ascending: true })

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Calculer les totaux
    const totalMinutes = services?.reduce((sum, s) => sum + s.duration_minutes, 0) || 0
    const totalSalary = services?.reduce((sum, s) => sum + s.salary_earned, 0) || 0

    // Obtenir le grade et le plafond
    const grade = getPrimaryGrade(authResult.roles)
    const maxWeekly = grade ? GRADE_MAX_WEEKLY[grade] : 0

    return NextResponse.json({
        services: services || [],
        week,
        year,
        stats: {
            totalMinutes,
            totalHours: Math.floor(totalMinutes / 60),
            totalSalary,
            maxWeekly,
            remainingSalary: Math.max(0, maxWeekly - totalSalary)
        }
    })
}

// POST - Créer un nouveau service
export async function POST(request: Request) {
    const authResult = await requireEmployeeAccess()
    if (!authResult.authorized) {
        return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const session = await auth()
    if (!session?.user?.discord_id || !session?.accessToken) {
        return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }

    // Utiliser le cache centralisé pour récupérer displayName
    const roleResult = await checkDiscordRoles(session.accessToken)
    const displayName = roleResult.displayName || session.user.name || 'Inconnu'

    const body = await request.json()
    const { start_time, end_time } = body

    if (!start_time || !end_time) {
        return NextResponse.json({ error: "Heures de début et fin requises" }, { status: 400 })
    }

    const startDate = new Date(start_time)
    const endDate = new Date(end_time)

    // Validation : heures doivent être sur des quarts d'heure
    if (startDate.getMinutes() % 15 !== 0 || endDate.getMinutes() % 15 !== 0) {
        return NextResponse.json({ error: "Les heures doivent être sur des tranches de 15 minutes (:00, :15, :30, :45)" }, { status: 400 })
    }

    // Validation : fin après début
    if (endDate <= startDate) {
        return NextResponse.json({ error: "L'heure de fin doit être après l'heure de début" }, { status: 400 })
    }

    // Calcul durée
    const durationMs = endDate.getTime() - startDate.getTime()
    const durationMinutes = Math.floor(durationMs / (1000 * 60))

    if (durationMinutes < 15) {
        return NextResponse.json({ error: "Service minimum de 15 minutes" }, { status: 400 })
    }

    // Nombre de tranches de 15 min
    const slotsCount = Math.floor(durationMinutes / 15)

    // Obtenir le grade et salaire
    const grade = getPrimaryGrade(authResult.roles)
    if (!grade) {
        return NextResponse.json({ error: "Aucun grade EMS trouvé" }, { status: 400 })
    }

    const salaryPer15min = GRADE_SALARIES[grade] || 625
    const salaryEarned = slotsCount * salaryPer15min

    // Semaine ISO et date du service
    const week = getISOWeek(startDate)
    const year = startDate.getFullYear()
    const serviceDate = startDate.toISOString().split('T')[0]

    const supabase = await createClient()

    const { data, error } = await supabase
        .from('services')
        .insert({
            user_discord_id: session.user.discord_id,
            user_name: displayName,
            user_avatar_url: roleResult.avatarUrl || null,
            grade_name: grade,
            start_time: startDate.toISOString(),
            end_time: endDate.toISOString(),
            duration_minutes: durationMinutes,
            slots_count: slotsCount,
            salary_earned: salaryEarned,
            week_number: week,
            year: year,
            service_date: serviceDate
        })
        .select()
        .single()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
}

// Helper : Calcul semaine ISO
function getISOWeek(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    const dayNum = d.getUTCDay() || 7
    d.setUTCDate(d.getUTCDate() + 4 - dayNum)
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}
