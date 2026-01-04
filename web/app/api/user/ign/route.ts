import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
)

export const dynamic = 'force-dynamic'

/**
 * GET /api/user/ign - Récupère l'IGN de l'utilisateur connecté
 */
export async function GET() {
    try {
        const session = await auth()
        if (!session?.user?.discord_id) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
        }

        const { data: user, error } = await supabase
            .from('users')
            .select('ign')
            .eq('discord_id', session.user.discord_id)
            .maybeSingle()

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ ign: user?.ign || null })
    } catch (error) {
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
}

/**
 * PUT /api/user/ign - Met à jour l'IGN de l'utilisateur connecté
 */
export async function PUT(request: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user?.discord_id) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
        }

        const body = await request.json()
        const { ign } = body

        // Validation
        if (!ign || typeof ign !== 'string') {
            return NextResponse.json({ error: 'IGN invalide' }, { status: 400 })
        }

        const trimmedIgn = ign.trim()
        if (trimmedIgn.length < 3 || trimmedIgn.length > 50) {
            return NextResponse.json({ error: 'L\'IGN doit contenir entre 3 et 50 caractères' }, { status: 400 })
        }

        // Vérifier l'unicité (insensible à la casse)
        const { data: existing } = await supabase
            .from('users')
            .select('discord_id')
            .ilike('ign', trimmedIgn)
            .neq('discord_id', session.user.discord_id)
            .maybeSingle()

        if (existing) {
            return NextResponse.json({ error: 'Ce nom RP est déjà utilisé par un autre utilisateur' }, { status: 409 })
        }

        // Vérifier si l'utilisateur existe déjà
        const { data: currentUser } = await supabase
            .from('users')
            .select('discord_id')
            .eq('discord_id', session.user.discord_id)
            .maybeSingle()

        let error

        if (currentUser) {
            // L'utilisateur existe, faire un UPDATE
            const result = await supabase
                .from('users')
                .update({
                    ign: trimmedIgn,
                    updated_at: new Date().toISOString()
                })
                .eq('discord_id', session.user.discord_id)
            error = result.error
        } else {
            // L'utilisateur n'existe pas, faire un INSERT avec toutes les infos
            const result = await supabase
                .from('users')
                .insert({
                    discord_id: session.user.discord_id,
                    discord_username: session.user.name || 'Unknown',
                    ign: trimmedIgn,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
            error = result.error
        }

        if (error) {
            // Gérer l'erreur d'unicité
            if (error.code === '23505') {
                return NextResponse.json({ error: 'Ce nom RP est déjà utilisé' }, { status: 409 })
            }
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ success: true, ign: trimmedIgn })
    } catch (error) {
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
}
