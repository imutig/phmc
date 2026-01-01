import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { checkDiscordRoles, getPrimaryGrade } from "@/lib/auth-utils"

export const dynamic = 'force-dynamic'

// Noms d'affichage des grades
const GRADE_DISPLAY: Record<string, string> = {
    direction: 'Direction',
    chirurgien: 'Chirurgien',
    medecin: 'Médecin',
    infirmier: 'Infirmier',
    ambulancier: 'Ambulancier',
    recruiter: 'Recruteur',
    candidate: 'Candidat'
}

export async function GET() {
    const session = await auth()

    if (!session?.accessToken || !session?.user?.discord_id) {
        return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }

    // Utiliser le cache centralisé - pas d'appel Discord supplémentaire
    const { roles, displayName, avatarUrl, error } = await checkDiscordRoles(session.accessToken)
    const grade = getPrimaryGrade(roles)

    return NextResponse.json({
        discordId: session.user.discord_id,
        displayName: displayName || session.user.name || 'Utilisateur',
        avatarUrl: avatarUrl || session.user.image || null,
        roles,
        grade,
        gradeName: grade || null,
        gradeDisplay: grade ? GRADE_DISPLAY[grade] : null
    })
}
