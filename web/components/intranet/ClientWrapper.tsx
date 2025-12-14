"use client"

import { ReactNode, createContext, useContext } from "react"
import { RoleType } from "@/lib/auth-utils"

interface UserData {
    roles: RoleType[]
}

interface PermissionsContextType {
    roles: RoleType[]
    hasRole: (role: RoleType) => boolean
    isDirection: boolean
    canEdit: boolean
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined)

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

    return (
        <PermissionsContext.Provider value={{
            roles: userData.roles,
            hasRole,
            isDirection,
            canEdit
        }}>
            {children}
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
