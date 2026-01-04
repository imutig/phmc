import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { checkDiscordRoles } from "@/lib/auth-utils"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
)

export const dynamic = 'force-dynamic'

// Salaires par grade
const GRADE_SALARIES: Record<string, { perSlot: number; maxWeekly: number }> = {
    direction: { perSlot: 1100, maxWeekly: 150000 },
    chirurgien: { perSlot: 1000, maxWeekly: 120000 },
    medecin: { perSlot: 900, maxWeekly: 100000 },
    infirmier: { perSlot: 700, maxWeekly: 85000 },
    ambulancier: { perSlot: 625, maxWeekly: 80000 }
}

const GRADE_DISPLAY: Record<string, string> = {
    direction: 'Direction',
    chirurgien: 'Chirurgien',
    medecin: 'Médecin',
    infirmier: 'Infirmier',
    ambulancier: 'Ambulancier'
}

// Calcule la semaine ISO
function getWeekInfo(date: Date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    const dayNum = d.getUTCDay() || 7
    d.setUTCDate(d.getUTCDate() + 4 - dayNum)
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
    return { week, year: date.getFullYear() }
}

export async function GET(request: Request) {
    try {
        const session = await auth()
        if (!session?.accessToken) {
            return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
        }

        // Vérifier les permissions (direction uniquement)
        const { roles } = await checkDiscordRoles(session.accessToken)
        if (!roles.includes('direction')) {
            return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
        }

        // Paramètres de la semaine
        const url = new URL(request.url)
        const weekParam = url.searchParams.get('week')
        const yearParam = url.searchParams.get('year')

        let targetWeek: number
        let targetYear: number

        if (weekParam && yearParam) {
            targetWeek = parseInt(weekParam)
            targetYear = parseInt(yearParam)
        } else {
            const now = new Date()
            const info = getWeekInfo(now)
            targetWeek = info.week
            targetYear = info.year
        }

        // Récupérer tous les services de la semaine
        const { data: services, error } = await supabase
            .from('services')
            .select('*')
            .eq('week_number', targetWeek)
            .eq('year', targetYear)
            .not('end_time', 'is', null)
            .order('start_time', { ascending: true })

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        // Agréger par utilisateur
        const employeesMap = new Map<string, {
            discordId: string
            name: string
            grade: string
            gradeDisplay: string
            totalMinutes: number
            totalSlots: number
            totalSalary: number
            maxWeekly: number
            services: number
        }>()

        for (const service of services || []) {
            const key = service.user_discord_id
            const existing = employeesMap.get(key)
            const gradeInfo = GRADE_SALARIES[service.grade_name] || { perSlot: 625, maxWeekly: 80000 }

            if (existing) {
                existing.totalMinutes += service.duration_minutes || 0
                existing.totalSlots += service.slots_count || 0
                existing.totalSalary += service.salary_earned || 0
                existing.services += 1
            } else {
                employeesMap.set(key, {
                    discordId: service.user_discord_id,
                    name: service.user_name,
                    grade: service.grade_name,
                    gradeDisplay: GRADE_DISPLAY[service.grade_name] || service.grade_name,
                    totalMinutes: service.duration_minutes || 0,
                    totalSlots: service.slots_count || 0,
                    totalSalary: service.salary_earned || 0,
                    maxWeekly: gradeInfo.maxWeekly,
                    services: 1
                })
            }
        }

        // Convertir en tableau et calculer le reste à verser
        const employees = Array.from(employeesMap.values()).map(emp => ({
            ...emp,
            remainingSalary: Math.max(0, emp.maxWeekly - emp.totalSalary),
            // Formater les heures
            hoursFormatted: `${Math.floor(emp.totalMinutes / 60)}h${(emp.totalMinutes % 60).toString().padStart(2, '0')}`
        }))

        // Trier par salaire décroissant
        employees.sort((a, b) => b.totalSalary - a.totalSalary)

        // Totaux
        const totals = {
            totalMinutes: employees.reduce((sum, e) => sum + e.totalMinutes, 0),
            totalSlots: employees.reduce((sum, e) => sum + e.totalSlots, 0),
            totalSalary: employees.reduce((sum, e) => sum + e.totalSalary, 0),
            totalRemaining: employees.reduce((sum, e) => sum + e.remainingSalary, 0),
            employeeCount: employees.length,
            hoursFormatted: ''
        }
        totals.hoursFormatted = `${Math.floor(totals.totalMinutes / 60)}h${(totals.totalMinutes % 60).toString().padStart(2, '0')}`

        return NextResponse.json({
            week: targetWeek,
            year: targetYear,
            employees,
            totals
        })
    } catch (error) {
        console.error('Erreur API salaires:', error)
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
    }
}
