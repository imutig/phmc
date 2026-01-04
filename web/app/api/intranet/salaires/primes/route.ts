import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { checkDiscordRoles } from "@/lib/auth-utils"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
)

export const dynamic = 'force-dynamic'

/**
 * GET /api/intranet/salaires/primes - Récupère les primes d'une semaine
 */
export async function GET(request: Request) {
    try {
        const session = await auth()
        if (!session?.accessToken) {
            return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
        }

        const { roles } = await checkDiscordRoles(session.accessToken)
        if (!roles.includes('direction')) {
            return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
        }

        const url = new URL(request.url)
        const week = parseInt(url.searchParams.get('week') || '0')
        const year = parseInt(url.searchParams.get('year') || '0')

        if (!week || !year) {
            return NextResponse.json({ error: "Paramètres week et year requis" }, { status: 400 })
        }

        const { data: primes, error } = await supabase
            .from('salary_primes')
            .select('discord_id, prime_amount')
            .eq('week_number', week)
            .eq('year', year)

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        // Convertir en map
        const primesMap: Record<string, number> = {}
        for (const p of primes || []) {
            primesMap[p.discord_id] = p.prime_amount
        }

        return NextResponse.json({ primes: primesMap })
    } catch (error) {
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
    }
}

/**
 * PUT /api/intranet/salaires/primes - Met à jour une prime
 */
export async function PUT(request: NextRequest) {
    try {
        const session = await auth()
        if (!session?.accessToken) {
            return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
        }

        const { roles } = await checkDiscordRoles(session.accessToken)
        if (!roles.includes('direction')) {
            return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
        }

        const body = await request.json()
        const { discordId, week, year, prime } = body

        if (!discordId || !week || !year || prime === undefined) {
            return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 })
        }

        const primeAmount = parseInt(prime) || 0

        if (primeAmount === 0) {
            // Supprimer la prime si elle est à 0
            await supabase
                .from('salary_primes')
                .delete()
                .eq('discord_id', discordId)
                .eq('week_number', week)
                .eq('year', year)
        } else {
            // Upsert la prime
            const { error } = await supabase
                .from('salary_primes')
                .upsert({
                    discord_id: discordId,
                    week_number: week,
                    year: year,
                    prime_amount: primeAmount,
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'discord_id,week_number,year'
                })

            if (error) {
                return NextResponse.json({ error: error.message }, { status: 500 })
            }
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
    }
}
