"use client"

import { useState, useEffect } from "react"
import { Topbar } from "./Topbar"

interface TopbarWrapperProps {
    userRoles: string[]
    hasDefconBanner?: boolean
    onMenuClick?: () => void
}

interface UserProfile {
    displayName: string
    avatarUrl: string | null
    gradeDisplay: string | null
    gradeName: string | null
}

export function TopbarWrapper({ userRoles, hasDefconBanner = false, onMenuClick }: TopbarWrapperProps) {
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
    const [discordId, setDiscordId] = useState<string>("")

    useEffect(() => {
        async function fetchProfile() {
            try {
                const res = await fetch('/api/user/profile')
                if (res.ok) {
                    const data = await res.json()
                    setUserProfile({
                        displayName: data.displayName,
                        avatarUrl: data.avatarUrl,
                        gradeDisplay: data.gradeDisplay,
                        gradeName: data.gradeName
                    })
                    setDiscordId(data.discordId || "")
                }
            } catch (e) {
                console.error('Erreur fetch profile:', e)
            }
        }
        fetchProfile()
    }, [])

    // Déterminer le grade principal à partir des rôles
    const gradeFromRoles = () => {
        const gradeOrder = ['direction', 'chirurgien', 'medecin', 'infirmier', 'ambulancier']
        for (const grade of gradeOrder) {
            if (userRoles.includes(grade)) return grade
        }
        return 'ambulancier'
    }

    if (!userProfile) {
        return (
            <header className="fixed top-0 right-0 left-0 md:left-[280px] h-16 z-30 bg-[#0a0a0a]/80 backdrop-blur-md border-b border-[#2a2a2a]">
                <div className="h-full px-4 flex items-center justify-center">
                    <div className="w-32 h-8 bg-white/5 rounded-lg animate-pulse" />
                </div>
            </header>
        )
    }

    return (
        <Topbar
            userDiscordId={discordId}
            userName={userProfile.displayName}
            gradeName={userProfile.gradeName || gradeFromRoles()}
            avatarUrl={userProfile.avatarUrl}
            hasDefconBanner={hasDefconBanner}
            onMenuClick={onMenuClick}
        />
    )
}
