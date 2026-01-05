'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { getCurrentISOWeekAndYear } from '@/lib/date-utils'

interface WeekStats {
    totalMinutes: number
    totalSalary: number
    serviceCount: number
}

interface UseServicesStatsReturn {
    stats: WeekStats
    loading: boolean
    error: string | null
    refetch: () => Promise<void>
    // Helpers formatés
    formattedTime: string
    formattedSalary: string
}

/**
 * Hook pour charger les statistiques de services d'un utilisateur
 * 
 * @param userDiscordId - ID Discord de l'utilisateur
 * @example
 * const { stats, formattedTime } = useServicesStats('123456789')
 */
export function useServicesStats(userDiscordId?: string): UseServicesStatsReturn {
    const [stats, setStats] = useState<WeekStats>({
        totalMinutes: 0,
        totalSalary: 0,
        serviceCount: 0
    })
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchStats = useCallback(async () => {
        if (!userDiscordId) {
            setLoading(false)
            return
        }

        try {
            setLoading(true)
            const { week, year } = getCurrentISOWeekAndYear()
            const res = await fetch(`/api/intranet/services?week=${week}&year=${year}`)

            if (!res.ok) throw new Error('Erreur chargement stats')

            const services = await res.json()

            // Calculer les totaux
            const totals = (services || []).reduce(
                (acc: WeekStats, service: { duration_minutes?: number; salary_earned?: number }) => ({
                    totalMinutes: acc.totalMinutes + (service.duration_minutes || 0),
                    totalSalary: acc.totalSalary + (service.salary_earned || 0),
                    serviceCount: acc.serviceCount + 1
                }),
                { totalMinutes: 0, totalSalary: 0, serviceCount: 0 }
            )

            setStats(totals)
            setError(null)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erreur')
        } finally {
            setLoading(false)
        }
    }, [userDiscordId])

    useEffect(() => {
        fetchStats()
    }, [fetchStats])

    // Valeurs formatées
    const formattedTime = useMemo(() => {
        const hours = Math.floor(stats.totalMinutes / 60)
        const mins = stats.totalMinutes % 60
        return `${hours}h${mins.toString().padStart(2, '0')}`
    }, [stats.totalMinutes])

    const formattedSalary = useMemo(() => {
        return new Intl.NumberFormat('fr-FR').format(stats.totalSalary) + '$'
    }, [stats.totalSalary])

    return {
        stats,
        loading,
        error,
        refetch: fetchStats,
        formattedTime,
        formattedSalary
    }
}
