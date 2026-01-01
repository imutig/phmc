import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Sidebar } from "@/components/intranet/Sidebar"
import { TopbarWrapper } from "@/components/intranet/TopbarWrapper"
import { IntranetClientWrapper } from "@/components/intranet/ClientWrapper"
import { EMS_GRADES } from "@/lib/auth-utils"
import { SnowEffect } from "@/components/ui/SnowEffect"
import { GlobalSearch } from "@/components/intranet/GlobalSearch"

// Grades EMS valides pour accéder à l'intranet
const VALID_INTRANET_ROLES = [...EMS_GRADES, 'recruiter']

export default async function IntranetLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const session = await auth()

    if (!session) {
        redirect("/auth/signin")
    }

    // Utiliser les rôles stockés dans la session (plus d'appel Discord ici!)
    const userRoles = session.user?.roles || []

    // Vérifier si l'utilisateur a au moins un grade EMS valide
    const hasValidRole = userRoles.some(role => VALID_INTRANET_ROLES.includes(role as any))

    if (!hasValidRole) {
        redirect("/?error=no_access")
    }

    return (
        <div className="min-h-screen bg-[#0f1110] text-gray-200">
            <SnowEffect />
            <GlobalSearch />
            <Sidebar userRoles={userRoles} />
            <TopbarWrapper userRoles={userRoles} />

            <main className="ml-0 md:ml-[280px] min-h-screen pt-[calc(3.5rem+1rem)] md:pt-20">
                <div className="max-w-7xl mx-auto px-4 md:px-6">
                    <IntranetClientWrapper userData={{ roles: userRoles }}>
                        {children}
                    </IntranetClientWrapper>
                </div>
            </main>
        </div>
    )
}
