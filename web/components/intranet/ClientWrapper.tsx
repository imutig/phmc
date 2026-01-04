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
    permissions: Record<string, boolean>
    hasRole: (role: RoleType) => boolean
    checkPermission: (key: string) => boolean
    isDirection: boolean
    canEdit: boolean // @deprecated use checkPermission
}

interface OnboardingContextType {
    resetOnboarding: () => void
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined)
const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined)

export function IntranetClientWrapper({
    children,
    userData,
    userPermissions = {}
}: {
    children: ReactNode
    userData: UserData
    userPermissions?: Record<string, boolean>
}) {
    const hasRole = (role: RoleType) => userData.roles.includes(role)
    const checkPermission = (key: string) => !!userPermissions[key]

    const isDirection = hasRole('direction')
    // Legacy support, but allows overriding via specific 'edit' permission if we had one generic
    // Pour l'instant on garde isDirection par défaut mais on pourra migrer page par page
    const canEdit = isDirection

    const { shouldShowOnboarding, completeOnboarding, resetOnboarding, isLoading } = useOnboarding()

    return (
        <PermissionsContext.Provider value={{
            roles: userData.roles,
            permissions: userPermissions,
            hasRole,
            checkPermission,
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
