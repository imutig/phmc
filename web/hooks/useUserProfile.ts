'use client'

import { useState, useEffect, useCallback } from 'react'

interface UserProfile {
    discordId: string
    displayName: string
    avatarUrl?: string
    gradeName: string
    roles: string[]
    ign?: string
}

interface UseUserProfileReturn {
    profile: UserProfile | null
    loading: boolean
    error: string | null
    refetch: () => Promise<void>
}

/**
 * Hook pour charger le profil utilisateur courant
 * 
 * @example
 * const { profile, loading } = useUserProfile()
 * if (profile) console.log(profile.displayName)
 */
export function useUserProfile(): UseUserProfileReturn {
    const [profile, setProfile] = useState<UserProfile | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchProfile = useCallback(async () => {
        try {
            setLoading(true)
            const res = await fetch('/api/user/profile')
            if (!res.ok) throw new Error('Erreur chargement profil')
            const data = await res.json()
            setProfile({
                discordId: data.discord_id,
                displayName: data.displayName || data.name,
                avatarUrl: data.avatarUrl,
                gradeName: data.gradeName,
                roles: data.roles || [],
                ign: data.ign
            })
            setError(null)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erreur')
            setProfile(null)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchProfile()
    }, [fetchProfile])

    return { profile, loading, error, refetch: fetchProfile }
}
