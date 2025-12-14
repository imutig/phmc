import { createClient } from "@/lib/supabase/server"
import { requireEmployeeAccess } from "@/lib/auth-utils"
import { auth } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"

// GET - Récupérer les favoris de l'utilisateur
export async function GET() {
    const session = await auth()
    if (!session?.user?.discord_id) {
        return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }

    const supabase = await createClient()

    const { data, error } = await supabase
        .from('care_favorites')
        .select('care_type_id')
        .eq('user_discord_id', session.user.discord_id)

    if (error) {
        console.error('Favorites fetch error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
        favorites: data?.map(f => f.care_type_id) || []
    })
}

// POST - Ajouter/Retirer un favori (toggle)
export async function POST(request: NextRequest) {
    const session = await auth()
    if (!session?.user?.discord_id) {
        return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }

    const body = await request.json()
    const { care_type_id } = body

    if (!care_type_id) {
        return NextResponse.json({ error: "care_type_id requis" }, { status: 400 })
    }

    const supabase = await createClient()
    const userId = session.user.discord_id

    // Vérifier si déjà favori
    const { data: existing } = await supabase
        .from('care_favorites')
        .select('id')
        .eq('user_discord_id', userId)
        .eq('care_type_id', care_type_id)
        .single()

    if (existing) {
        // Supprimer le favori
        const { error } = await supabase
            .from('care_favorites')
            .delete()
            .eq('id', existing.id)

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }
        return NextResponse.json({ action: 'removed', care_type_id })
    } else {
        // Ajouter le favori
        const { error } = await supabase
            .from('care_favorites')
            .insert({ user_discord_id: userId, care_type_id })

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }
        return NextResponse.json({ action: 'added', care_type_id })
    }
}
