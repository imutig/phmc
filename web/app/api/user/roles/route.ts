import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { checkDiscordRoles } from "@/lib/auth-utils"

export const dynamic = 'force-dynamic'

export async function GET() {
    const session = await auth()

    if (!session?.accessToken) {
        return NextResponse.json({ roles: [], error: "Non authentifié" }, { status: 401 })
    }

    const { roles, discordRoles, error } = await checkDiscordRoles(session.accessToken)

    // Déterminer le rôle principal (grade le plus élevé)
    let primaryRole = "Visiteur"
    if (roles.includes('direction')) {
        primaryRole = "Direction"
    } else if (roles.includes('chirurgien')) {
        primaryRole = "Chirurgien"
    } else if (roles.includes('medecin')) {
        primaryRole = "Médecin"
    } else if (roles.includes('infirmier')) {
        primaryRole = "Infirmier"
    } else if (roles.includes('ambulancier')) {
        primaryRole = "Ambulancier"
    } else if (roles.includes('recruiter')) {
        primaryRole = "Recruteur"
    } else if (roles.includes('candidate')) {
        primaryRole = "Candidat"
    }

    return NextResponse.json({
        roles,
        discordRoles,
        primaryRole,
        error,
        debug: {
            discordRolesCount: discordRoles.length,
            rolesFound: roles
        }
    })
}
