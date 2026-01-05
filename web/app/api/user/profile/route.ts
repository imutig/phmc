import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getPrimaryGrade, RoleType } from "@/lib/auth-utils"
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

export async function GET() {
    const session = await auth()

    if (!session?.user?.discord_id) {
        return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }

    // Récupérer les données utilisateur depuis Supabase (PAS Discord)
    const { data: user } = await supabase
        .from('users')
        .select('discord_username, avatar_url, ign')
        .eq('discord_id', session.user.discord_id)
        .maybeSingle()

    // Les rôles sont stockés dans la session (définis à la connexion)
    const roles = (session.user.roles || []) as RoleType[]
    const grade = getPrimaryGrade(roles)

    // Construire l'avatar URL si on a seulement le hash Discord
    const getAvatarUrl = () => {
        if (user?.avatar_url) return user.avatar_url
        if (session.user.image) return session.user.image
        if (session.user.discord_avatar && session.user.discord_id) {
            return `https://cdn.discordapp.com/avatars/${session.user.discord_id}/${session.user.discord_avatar}.png`
        }
        return null
    }

    return NextResponse.json({
        discordId: session.user.discord_id,
        displayName: user?.discord_username || session.user.displayName || session.user.name || 'Utilisateur',
        avatarUrl: getAvatarUrl(),
        roles,
        grade,
        gradeName: grade || null,
        gradeDisplay: grade ? GRADE_DISPLAY[grade] : null,
        ign: user?.ign || null
    })
}

