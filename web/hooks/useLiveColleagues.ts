'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRealtime } from './useRealtime'

interface LiveService {
    id: string
    user_discord_id: string
    user_name: string
    user_avatar_url?: string
    grade_name: string
    start_time: string
}

interface UseLiveColleaguesReturn {
    colleagues: LiveService[]
    loading: boolean
    error: string | null
    refetch: () => Promise<void>
}

/**
 * Hook pour charger les collègues en service avec synchronisation realtime
 * 
 * @example
 * const { colleagues, loading } = useLiveColleagues()
 */
export function useLiveColleagues(): UseLiveColleaguesReturn {
    const [colleagues, setColleagues] = useState<LiveService[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchColleagues = useCallback(async () => {
        try {
            setLoading(true)
            const res = await fetch('/api/intranet/services/admin?live=true')
            if (!res.ok) throw new Error('Erreur chargement')
            const data = await res.json()
            setColleagues(data || [])
            setError(null)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erreur')
        } finally {
            setLoading(false)
        }
    }, [])

    // Chargement initial
    useEffect(() => {
        fetchColleagues()
    }, [fetchColleagues])

    // Realtime sync - écoute les changements sur la table services
    useRealtime<LiveService>({
        table: 'services',
        onInsert: (service) => {
            // Ajouter seulement si le service est en cours (pas de end_time)
            if (!('end_time' in service) || service.end_time === null) {
                setColleagues(prev => {
                    if (prev.some(s => s.id === service.id)) return prev
                    return [...prev, service]
                })
            }
        },
        onUpdate: (service) => {
            // Si le service a maintenant un end_time, le retirer de la liste
            if ('end_time' in service && service.end_time !== null) {
                setColleagues(prev => prev.filter(s => s.id !== service.id))
            } else {
                setColleagues(prev => prev.map(s => s.id === service.id ? service : s))
            }
        },
        onDelete: (old) => {
            setColleagues(prev => prev.filter(s => s.id !== old.id))
        }
    })

    return { colleagues, loading, error, refetch: fetchColleagues }
}
