"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { RoleType } from '@/lib/auth-utils'

interface UserProfile {
    discordId: string
    displayName: string
    avatarUrl: string | null
    roles: RoleType[]
    grade: RoleType | null
    gradeDisplay: string | null
}

interface PermissionsContextType {
    profile: UserProfile | null
    loading: boolean
    error: string | null
    hasRole: (role: RoleType) => boolean
    hasAnyRole: (roles: RoleType[]) => boolean
    isDirection: boolean
    canEdit: boolean
    refetch: () => Promise<void>
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined)

export function PermissionsProvider({ children }: { children: ReactNode }) {
    const [profile, setProfile] = useState<UserProfile | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchProfile = async () => {
        try {
            const res = await fetch('/api/user/profile')
            if (res.ok) {
                const data = await res.json()
                setProfile({
                    discordId: data.discordId,
                    displayName: data.displayName,
                    avatarUrl: data.avatarUrl,
                    roles: data.roles || [],
                    grade: data.grade,
                    gradeDisplay: data.gradeDisplay
                })
                setError(null)
            } else {
                setError("Erreur chargement profil")
            }
        } catch (e) {
            setError("Erreur réseau")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchProfile()
    }, [])

    const hasRole = (role: RoleType) => profile?.roles.includes(role) ?? false
    const hasAnyRole = (roles: RoleType[]) => roles.some(r => profile?.roles.includes(r))
    const isDirection = hasRole('direction')
    const canEdit = isDirection

    return (
        <PermissionsContext.Provider value={{
            profile,
            loading,
            error,
            hasRole,
            hasAnyRole,
            isDirection,
            canEdit,
            refetch: fetchProfile
        }}>
            {children}
        </PermissionsContext.Provider>
    )
}

export function usePermissions() {
    const context = useContext(PermissionsContext)
    if (context === undefined) {
        throw new Error('usePermissions must be used within a PermissionsProvider')
    }
    return context
}
