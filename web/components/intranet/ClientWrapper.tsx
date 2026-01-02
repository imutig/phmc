"use client"

import { ReactNode, createContext, useContext } from "react"
import { AnimatePresence } from "framer-motion"
import { RoleType } from "@/lib/auth-utils"
import { useOnboarding } from "@/hooks/useOnboarding"
import { SpotlightOnboarding } from "./SpotlightOnboarding"

interface UserData {
    roles: RoleType[]
}

interface PermissionsContextType {
    roles: RoleType[]
    hasRole: (role: RoleType) => boolean
    isDirection: boolean
    canEdit: boolean
}

interface OnboardingContextType {
    resetOnboarding: () => void
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined)
const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined)

export function IntranetClientWrapper({
    children,
    userData
}: {
    children: ReactNode
    userData: UserData
}) {
    const hasRole = (role: RoleType) => userData.roles.includes(role)
    const isDirection = hasRole('direction')
    const canEdit = isDirection

    const { shouldShowOnboarding, completeOnboarding, resetOnboarding, isLoading } = useOnboarding()

    return (
        <PermissionsContext.Provider value={{
            roles: userData.roles,
            hasRole,
            isDirection,
            canEdit
        }}>
            <OnboardingContext.Provider value={{ resetOnboarding }}>
                {children}

                {/* Spotlight Onboarding */}
                <AnimatePresence>
                    {!isLoading && shouldShowOnboarding && (
                        <SpotlightOnboarding onComplete={completeOnboarding} />
                    )}
                </AnimatePresence>
            </OnboardingContext.Provider>
        </PermissionsContext.Provider>
    )
}

export function usePermissions() {
    const context = useContext(PermissionsContext)
    if (context === undefined) {
        throw new Error('usePermissions must be used within IntranetClientWrapper')
    }
    return context
}

export function useOnboardingActions() {
    const context = useContext(OnboardingContext)
    if (context === undefined) {
        throw new Error('useOnboardingActions must be used within IntranetClientWrapper')
    }
    return context
}
