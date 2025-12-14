import { createClient } from "@/lib/supabase/server"
import { requireAdminAccess } from "@/lib/auth-utils"
import { NextResponse } from "next/server"

export async function GET() {
    const authResult = await requireAdminAccess()
    if (!authResult.authorized) {
        return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    try {
        const supabase = await createClient()

        // 1. Candidatures par jour (30 derniers jours)
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

        const { data: dailyApps } = await supabase
            .from('applications')
            .select('created_at, service')
            .gte('created_at', thirtyDaysAgo.toISOString())
            .order('created_at', { ascending: true })

        // 2. Temps moyen de traitement (création -> clôture)
        const { data: processedApps } = await supabase
            .from('applications')
            .select('created_at, closed_at')
            .in('status', ['recruited', 'rejected'])
            .not('closed_at', 'is', null)

        // 3. Répartition globale
        const { data: totalStats } = await supabase
            .from('applications')
            .select('service, status')

        // Traitement des données pour les graphiques

        // --- Graphique Ligne : Candidatures par jour ---
        const dailyMap = new Map()
        // Initialiser les 30 derniers jours
        for (let i = 0; i < 30; i++) {
            const d = new Date()
            d.setDate(d.getDate() - i)
            const key = d.toISOString().split('T')[0]
            dailyMap.set(key, { date: key, ems: 0 })
        }

        dailyApps?.forEach(app => {
            const key = new Date(app.created_at).toISOString().split('T')[0]
            if (dailyMap.has(key)) {
                const entry = dailyMap.get(key)
                entry.ems++
            }
        })

        const dailyChartData = Array.from(dailyMap.values())
            .sort((a, b) => a.date.localeCompare(b.date))
            .map(item => ({
                ...item,
                date: new Date(item.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
            }))

        // --- Temps moyen traitement (création -> clôture) ---
        let totalHours = 0
        let count = 0
        processedApps?.forEach(app => {
            const start = new Date(app.created_at).getTime()
            const end = new Date(app.closed_at).getTime()
            const diffHours = (end - start) / (1000 * 60 * 60)
            // Filtrer les aberrants (> 1 mois ou < 0)
            if (diffHours > 0 && diffHours < 730) {
                totalHours += diffHours
                count++
            }
        })
        const avgProcessingTimeHours = count > 0 ? Math.round(totalHours / count) : 0
        const avgProcessingTimeDays = (avgProcessingTimeHours / 24).toFixed(1)

        // --- Répartition Camembert ---
        const pieData = [
            { name: 'EMS', value: totalStats?.filter(a => a.service === 'EMS').length || 0, color: '#10B981' }
        ]

        // --- Taux d'acceptation ---
        const recruited = totalStats?.filter(a => a.status === 'recruited').length || 0
        const rejected = totalStats?.filter(a => a.status === 'rejected').length || 0
        const totalProcessed = recruited + rejected
        const acceptanceRate = totalProcessed > 0 ? Math.round((recruited / totalProcessed) * 100) : 0

        return NextResponse.json({
            charts: {
                daily: dailyChartData,
                distribution: pieData,
            },
            metrics: {
                avgProcessingTimeHours,
                avgProcessingTimeDays,
                acceptanceRate,
                totalProcessed
            }
        })

    } catch (error) {
        console.error('Stats API error:', error)
        return NextResponse.json({ error: "Erreur serveur." }, { status: 500 })
    }
}
