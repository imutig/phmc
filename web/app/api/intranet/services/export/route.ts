import { createClient } from "@/lib/supabase/server"
import { requireEditorAccess } from "@/lib/auth-utils"
import { NextResponse } from "next/server"

// GET - Export CSV des services
export async function GET(request: Request) {
    const authResult = await requireEditorAccess()
    if (!authResult.authorized) {
        return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const { searchParams } = new URL(request.url)
    const weekParam = searchParams.get('week')
    const yearParam = searchParams.get('year')
    const format = searchParams.get('format') || 'csv'

    const now = new Date()
    const week = weekParam ? parseInt(weekParam) : getISOWeek(now)
    const year = yearParam ? parseInt(yearParam) : now.getFullYear()

    const supabase = await createClient()

    const { data: services, error } = await supabase
        .from('services')
        .select('*')
        .is('deleted_at', null)
        .eq('week_number', week)
        .eq('year', year)
        .order('user_name', { ascending: true })
        .order('start_time', { ascending: true })

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (format === 'json') {
        return NextResponse.json({ services, week, year })
    }

    // Format CSV
    const headers = ['Employé', 'Grade', 'Date', 'Début', 'Fin', 'Durée (min)', 'Salaire ($)']
    const rows = (services || []).map(s => [
        s.user_name,
        s.grade_name,
        s.service_date,
        new Date(s.start_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        new Date(s.end_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        s.duration_minutes,
        s.salary_earned
    ])

    // Ajouter les totaux par employé (groupé par user_discord_id pour la persistance)
    const byEmployee: Record<string, { name: string, minutes: number, salary: number }> = {}
    for (const s of services || []) {
        if (!byEmployee[s.user_discord_id]) {
            byEmployee[s.user_discord_id] = { name: s.user_name, minutes: 0, salary: 0 }
        }
        // Toujours mettre à jour le nom (au cas où il a changé)
        byEmployee[s.user_discord_id].name = s.user_name
        byEmployee[s.user_discord_id].minutes += s.duration_minutes
        byEmployee[s.user_discord_id].salary += s.salary_earned
    }

    rows.push([]) // Ligne vide
    rows.push(['--- RÉCAPITULATIF ---'])
    for (const [, totals] of Object.entries(byEmployee)) {
        rows.push([totals.name, '', '', '', '', totals.minutes, totals.salary])
    }

    // Total général
    const totalMinutes = Object.values(byEmployee).reduce((sum, e) => sum + e.minutes, 0)
    const totalSalary = Object.values(byEmployee).reduce((sum, e) => sum + e.salary, 0)
    rows.push([])
    rows.push(['TOTAL GÉNÉRAL', '', '', '', '', totalMinutes, totalSalary])

    const csv = [
        headers.join(';'),
        ...rows.map(r => r.join(';'))
    ].join('\n')

    return new NextResponse(csv, {
        status: 200,
        headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="services_semaine${week}_${year}.csv"`
        }
    })
}

function getISOWeek(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    const dayNum = d.getUTCDay() || 7
    d.setUTCDate(d.getUTCDate() + 4 - dayNum)
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}
