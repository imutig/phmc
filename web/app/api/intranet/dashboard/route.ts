import { createClient } from "@/lib/supabase/server"
import { requireEditorAccess } from "@/lib/auth-utils"
import { NextResponse } from "next/server"

// GET - Récupérer les statistiques pour le dashboard
export async function GET(request: Request) {
    const authResult = await requireEditorAccess()
    if (!authResult.authorized) {
        return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const { searchParams } = new URL(request.url)
    const weeksBack = parseInt(searchParams.get('weeks') || '4')

    const supabase = await createClient()
    const now = new Date()
    const currentWeek = getISOWeek(now)
    const currentYear = now.getFullYear()

    // Récupérer les services des X dernières semaines
    const startDate = new Date(now)
    startDate.setDate(startDate.getDate() - (weeksBack * 7))

    const { data: services, error } = await supabase
        .from('services')
        .select('*')
        .gte('service_date', startDate.toISOString().split('T')[0])
        .order('service_date', { ascending: true })

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Stats par semaine
    const weeklyStats: Record<string, { week: number, year: number, totalMinutes: number, totalSalary: number, serviceCount: number }> = {}

    // Stats par grade
    const gradeStats: Record<string, { totalMinutes: number, totalSalary: number, employeeCount: Set<string> }> = {}

    // Stats par employé
    const employeeStats: Record<string, {
        name: string,
        grade: string,
        totalMinutes: number,
        totalSalary: number,
        weeklyData: Record<string, { minutes: number, salary: number }>
    }> = {}

    for (const service of services || []) {
        const weekKey = `${service.year}-${service.week_number}`

        // Weekly aggregation
        if (!weeklyStats[weekKey]) {
            weeklyStats[weekKey] = {
                week: service.week_number,
                year: service.year,
                totalMinutes: 0,
                totalSalary: 0,
                serviceCount: 0
            }
        }
        weeklyStats[weekKey].totalMinutes += service.duration_minutes
        weeklyStats[weekKey].totalSalary += service.salary_earned
        weeklyStats[weekKey].serviceCount += 1

        // Grade aggregation
        if (!gradeStats[service.grade_name]) {
            gradeStats[service.grade_name] = {
                totalMinutes: 0,
                totalSalary: 0,
                employeeCount: new Set()
            }
        }
        gradeStats[service.grade_name].totalMinutes += service.duration_minutes
        gradeStats[service.grade_name].totalSalary += service.salary_earned
        gradeStats[service.grade_name].employeeCount.add(service.user_discord_id)

        // Employee aggregation
        if (!employeeStats[service.user_discord_id]) {
            employeeStats[service.user_discord_id] = {
                name: service.user_name,
                grade: service.grade_name,
                totalMinutes: 0,
                totalSalary: 0,
                weeklyData: {}
            }
        }
        employeeStats[service.user_discord_id].totalMinutes += service.duration_minutes
        employeeStats[service.user_discord_id].totalSalary += service.salary_earned

        if (!employeeStats[service.user_discord_id].weeklyData[weekKey]) {
            employeeStats[service.user_discord_id].weeklyData[weekKey] = { minutes: 0, salary: 0 }
        }
        employeeStats[service.user_discord_id].weeklyData[weekKey].minutes += service.duration_minutes
        employeeStats[service.user_discord_id].weeklyData[weekKey].salary += service.salary_earned
    }

    // Convertir les Sets en nombres
    const gradeStatsArray = Object.entries(gradeStats).map(([grade, stats]) => ({
        grade,
        totalMinutes: stats.totalMinutes,
        totalSalary: stats.totalSalary,
        employeeCount: stats.employeeCount.size
    }))

    // Top 5 employés par heures
    const topEmployees = Object.values(employeeStats)
        .sort((a, b) => b.totalMinutes - a.totalMinutes)
        .slice(0, 5)

    // Totaux généraux
    const totalMinutes = Object.values(weeklyStats).reduce((sum, w) => sum + w.totalMinutes, 0)
    const totalSalary = Object.values(weeklyStats).reduce((sum, w) => sum + w.totalSalary, 0)
    const totalServices = Object.values(weeklyStats).reduce((sum, w) => sum + w.serviceCount, 0)
    const uniqueEmployees = new Set((services || []).map(s => s.user_discord_id)).size

    return NextResponse.json({
        period: {
            weeksBack,
            currentWeek,
            currentYear
        },
        totals: {
            totalMinutes,
            totalHours: Math.round(totalMinutes / 60),
            totalSalary,
            totalServices,
            uniqueEmployees,
            avgHoursPerEmployee: uniqueEmployees > 0 ? Math.round(totalMinutes / 60 / uniqueEmployees) : 0
        },
        weeklyStats: Object.values(weeklyStats).sort((a, b) => {
            if (a.year !== b.year) return a.year - b.year
            return a.week - b.week
        }),
        gradeStats: gradeStatsArray.sort((a, b) => b.totalSalary - a.totalSalary),
        topEmployees
    })
}

function getISOWeek(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    const dayNum = d.getUTCDay() || 7
    d.setUTCDate(d.getUTCDate() + 4 - dayNum)
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}
