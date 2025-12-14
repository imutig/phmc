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
        const { content } = body

        if (!content || typeof content !== 'string' || content.trim().length === 0) {
            return NextResponse.json({ error: "Contenu du message requis." }, { status: 400 })
        }

        let senderName = authResult.session?.user?.discord_username || authResult.session?.user?.name || 'Recruteur'
        const senderDiscordId = authResult.session?.user?.discord_id

        // Essayer de récupérer le displayName depuis Discord via le bot
        if (BOT_API_SECRET && senderDiscordId) {
            try {
                const displayNameRes = await fetch(`${BOT_API_URL}/api/member/${senderDiscordId}`, {
                    headers: { 'Authorization': `Bearer ${BOT_API_SECRET}` }
                })
                if (displayNameRes.ok) {
                    const memberData = await displayNameRes.json()
                    if (memberData.displayName) {
                        senderName = memberData.displayName
                    }
                }
            } catch {
                // Fallback sur le username
            }
        }

        // Récupérer les infos de la candidature
        const { data: application } = await supabase
            .from('applications')
            .select('discord_channel_id, users(discord_id)')
            .eq('id', applicationId)
            .single()

        if (!application) {
            return NextResponse.json({ error: "Candidature non trouvée." }, { status: 404 })
        }

        // Obtenir le prochain numéro de message
        const { data: lastMessage } = await supabase
            .from('application_messages')
            .select('message_number')
            .eq('application_id', applicationId)
            .eq('is_from_candidate', false)
            .order('message_number', { ascending: false })
            .limit(1)
            .single()

        const messageNumber = (lastMessage?.message_number || 0) + 1

        // Enregistrer le message dans la base
        const { error: msgError } = await supabase
            .from('application_messages')
            .insert({
                application_id: applicationId,
                sender_discord_id: senderDiscordId,
                sender_name: senderName,
                content: content.trim(),
                is_from_candidate: false,
                message_number: messageNumber
            })

        if (msgError) {
            console.error('[Message API] DB error:', msgError)
            return NextResponse.json({ error: "Erreur d'enregistrement." }, { status: 500 })
        }

        // Logger l'action
        await supabase.from('application_logs').insert({
            application_id: applicationId,
            actor_discord_id: senderDiscordId,
            actor_name: senderName,
            action: 'message_sent',
            details: { source: 'web', message_number: messageNumber }
        })

        // Appeler l'API du bot pour envoyer le DM au candidat
        const usersData = application.users as unknown as { discord_id: string } | null
        const candidateDiscordId = usersData?.discord_id

        if (BOT_API_SECRET && candidateDiscordId) {
            try {
                const response = await fetch(`${BOT_API_URL}/api/message`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${BOT_API_SECRET}`
                    },
                    body: JSON.stringify({
                        applicationId,
                        channelId: application.discord_channel_id,
                        candidateDiscordId,
                        senderName,
                        content: content.trim()
                    })
                })

                if (!response.ok) {
                    const errData = await response.json()
                    console.warn('[Message API] Bot error:', errData)
                }
            } catch (botError) {
                console.error('[Message API] Bot webhook error:', botError)
            }
        }

        return NextResponse.json({ success: true, messageNumber })

    } catch (error) {
        console.error('Message API error:', error)
        return NextResponse.json({ error: "Erreur serveur." }, { status: 500 })
    }
}
