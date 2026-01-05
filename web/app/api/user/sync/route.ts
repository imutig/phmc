import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { checkDiscordRoles, getPrimaryGrade, invalidateRoleConfigCache } from "@/lib/auth-utils"
import { createClient } from "@supabase/supabase-js"

export const dynamic = 'force-dynamic'

// Supabase client pour DB
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
)

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

export async function POST() {
    const session = await auth()

    if (!session?.accessToken || !session?.user?.discord_id) {
        return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }

    try {
        // Invalider le cache pour forcer un vrai appel Discord
        invalidateRoleConfigCache()

        // Appeler Discord pour récupérer les données fraîches
        const { roles, displayName, avatarUrl } = await checkDiscordRoles(session.accessToken)
        const grade = getPrimaryGrade(roles)

        // SAUVEGARDER les données en DB pour les futures requêtes
        const { error: dbError } = await supabase
            .from('users')
            .upsert({
                discord_id: session.user.discord_id,
                discord_username: displayName || session.user.name,
                avatar_url: avatarUrl || session.user.image,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'discord_id'
            })

        if (dbError) {
            console.error('Erreur sauvegarde DB:', dbError)
        }

        return NextResponse.json({
            success: true,
            profile: {
                discordId: session.user.discord_id,
                displayName: displayName || session.user.name || 'Utilisateur',
                avatarUrl: avatarUrl || session.user.image || null,
                roles,
                grade,
                gradeName: grade || null,
                gradeDisplay: grade ? GRADE_DISPLAY[grade] : null
            }
        })
    } catch (error) {
        console.error('Erreur sync Discord:', error)
        return NextResponse.json({ error: "Erreur lors de la synchronisation" }, { status: 500 })
    }
}
