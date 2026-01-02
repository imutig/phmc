import { createClient } from "@/lib/supabase/server"
import { requireEmployeeAccess } from "@/lib/auth-utils"
import { NextResponse } from "next/server"
import { getISOWeekAndYear } from "@/lib/date-utils"

/**
 * API Analytics pour le Dashboard
 * Retourne des statistiques agrégées sur les RDV, services et revenus
 */

export async function GET() {
    const authResult = await requireEmployeeAccess()
    if (!authResult.authorized) {
        return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const supabase = await createClient()
    const now = new Date()
    const { week, year } = getISOWeekAndYear(now)

    // Date de début de semaine (lundi)
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1))
    startOfWeek.setHours(0, 0, 0, 0)

    // Les 7 derniers jours
    const last7Days = new Date(now)
    last7Days.setDate(now.getDate() - 7)

    try {
        // Statistiques RDV
        const [
            { data: appointmentsTotal },
            { data: appointmentsWeek },
            { data: appointmentsByDay },
            { data: servicesWeek },
            { data: liveServices },
            { data: recentActivities }
        ] = await Promise.all([
            // Total RDV
            supabase
                .from('appointments')
                .select('id', { count: 'exact', head: true }),

            // RDV cette semaine
            supabase
                .from('appointments')
                .select('id, status, created_at')
                .gte('created_at', startOfWeek.toISOString()),

            // RDV par jour (7 derniers jours)
            supabase
                .from('appointments')
                .select('id, created_at, status')
                .gte('created_at', last7Days.toISOString())
                .order('created_at', { ascending: true }),

            // Services cette semaine
            supabase
                .from('services')
                .select('id, duration_minutes, salary_earned, grade_name, user_name, end_time')
                .eq('week_number', week)
                .eq('year', year)
                .not('end_time', 'is', null),

            // Services en cours
            supabase
                .from('services')
                .select('id, user_name, grade_name, start_time, user_avatar_url')
                .is('end_time', null),

            // Dernières activités (mix RDV + Services)
            supabase
                .from('appointments')
                .select(`
                    id,
                    status,
                    created_at,
                    discord_username,
                    assigned_to_name,
                    reason_category
                `)
                .order('created_at', { ascending: false })
                .limit(10)
        ])

        // Calculer les métriques
        const totalRevenue = servicesWeek?.reduce((sum, s) => sum + (s.salary_earned || 0), 0) || 0
        const totalMinutes = servicesWeek?.reduce((sum, s) => sum + (s.duration_minutes || 0), 0) || 0
        const avgServiceTime = servicesWeek?.length ? Math.round(totalMinutes / servicesWeek.length) : 0

        // Grouper RDV par jour pour le graphique
        const appointmentsByDayMap: Record<string, { total: number; completed: number; cancelled: number }> = {}
        const days = []
        for (let i = 6; i >= 0; i--) {
            const date = new Date(now)
            date.setDate(now.getDate() - i)
            const key = date.toISOString().split('T')[0]
            appointmentsByDayMap[key] = { total: 0, completed: 0, cancelled: 0 }
            days.push({
                date: key,
                label: date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })
            })
        }

        appointmentsByDay?.forEach(app => {
            const key = app.created_at.split('T')[0]
            if (appointmentsByDayMap[key]) {
                appointmentsByDayMap[key].total++
                if (app.status === 'completed') appointmentsByDayMap[key].completed++
                if (app.status === 'cancelled') appointmentsByDayMap[key].cancelled++
            }
        })

        const chartData = days.map(day => ({
            name: day.label,
            total: appointmentsByDayMap[day.date].total,
            completed: appointmentsByDayMap[day.date].completed,
            cancelled: appointmentsByDayMap[day.date].cancelled
        }))

        // Grouper par statut
        const statusCounts = {
            pending: 0,
            scheduled: 0,
            completed: 0,
            cancelled: 0
        }
        appointmentsWeek?.forEach(app => {
            if (statusCounts[app.status as keyof typeof statusCounts] !== undefined) {
                statusCounts[app.status as keyof typeof statusCounts]++
            }
        })

        return NextResponse.json({
            summary: {
                appointmentsThisWeek: appointmentsWeek?.length || 0,
                appointmentsTotal: appointmentsTotal,
                servicesThisWeek: servicesWeek?.length || 0,
                liveServicesCount: liveServices?.length || 0,
                totalRevenue,
                totalMinutes,
                avgServiceTime
            },
            statusCounts,
            chartData,
            liveServices: liveServices || [],
            recentActivities: recentActivities?.map(a => ({
                id: a.id,
                type: 'appointment',
                action: a.status === 'pending' ? 'created' : a.status,
                user: a.assigned_to_name || a.discord_username,
                category: a.reason_category,
                timestamp: a.created_at
            })) || []
        })

    } catch (error) {
        console.error('Analytics error:', error)
        return NextResponse.json({ error: 'Erreur lors du calcul des analytics' }, { status: 500 })
    }
}
