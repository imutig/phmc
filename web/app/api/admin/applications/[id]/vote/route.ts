import { createClient } from "@/lib/supabase/server"
import { requireAdminAccess } from "@/lib/auth-utils"
import { NextRequest, NextResponse } from "next/server"

const BOT_API_URL = process.env.BOT_API_URL || 'http://localhost:3001'
const BOT_API_SECRET = process.env.BOT_API_SECRET

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const authResult = await requireAdminAccess()
    if (!authResult.authorized) {
        return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    try {
        const { id: applicationId } = await params
        const supabase = await createClient()
        const body = await request.json()
        const { vote, comment } = body

        if (vote === undefined || typeof vote !== 'boolean') {
            return NextResponse.json({ error: "Vote requis (true/false)." }, { status: 400 })
        }

        const voterName = authResult.session?.user?.discord_username || authResult.session?.user?.name || 'Recruteur'
        const voterDiscordId = authResult.session?.user?.discord_id

        // Vérifier si un vote existe déjà
        const { data: existingVote } = await supabase
            .from('application_votes')
            .select('id')
            .eq('application_id', applicationId)
            .eq('voter_discord_id', voterDiscordId)
            .single()

        if (existingVote) {
            // Mettre à jour le vote existant
            await supabase
                .from('application_votes')
                .update({ vote, comment, updated_at: new Date().toISOString() })
                .eq('id', existingVote.id)
        } else {
            // Créer un nouveau vote
            await supabase
                .from('application_votes')
                .insert({
                    application_id: applicationId,
                    voter_discord_id: voterDiscordId,
                    voter_name: voterName,
                    vote,
                    comment
                })
        }

        // Logger le vote
        await supabase.from('application_logs').insert({
            application_id: applicationId,
            actor_discord_id: voterDiscordId,
            actor_name: voterName,
            action: 'vote_cast',
            details: { vote, comment, source: 'web' }
        })

        // Récupérer le channel Discord pour envoyer l'embed
        const { data: application } = await supabase
            .from('applications')
            .select('discord_channel_id')
            .eq('id', applicationId)
            .single()

        // Appeler l'API du bot pour envoyer l'embed sur Discord
        if (BOT_API_SECRET && application?.discord_channel_id) {
            try {
                await fetch(`${BOT_API_URL}/api/vote`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${BOT_API_SECRET}`
                    },
                    body: JSON.stringify({
                        applicationId,
                        channelId: application.discord_channel_id,
                        voterName,
                        vote,
                        comment
                    })
                })
            } catch (botError) {
                console.error('[Vote API] Bot webhook error:', botError)
                // On continue quand même, le vote est enregistré
            }
        }

        return NextResponse.json({ success: true })

    } catch (error) {
        console.error('Vote API error:', error)
        return NextResponse.json({ error: "Erreur serveur." }, { status: 500 })
    }
}
