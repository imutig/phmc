import { createClient } from "@/lib/supabase/server"
import { auth } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"
import { requireEmployeeAccess } from "@/lib/auth-utils"

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
        }

        const { authorized } = await requireEmployeeAccess()
        if (!authorized) {
            return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
        }

        const body = await request.json()
        const { content } = body

        if (!content) {
            return NextResponse.json({ error: "Contenu requis" }, { status: 400 })
        }

        const supabase = await createClient()

        // 1. Récupérer les infos du RDV
        const { data: appointment, error: appError } = await supabase
            .from('appointments')
            .select('*')
            .eq('id', id)
            .single()

        if (appError || !appointment) {
            return NextResponse.json({ error: "Rendez-vous introuvable" }, { status: 404 })
        }

        // 2. Récupérer le displayName et le rôle via l'API du bot
        const BOT_API_URL = process.env.BOT_API_URL || 'http://localhost:3001'
        const BOT_API_SECRET = process.env.BOT_API_SECRET

        let senderDisplayName = session.user.name || session.user.discord_username || "Staff"
        let senderRole = "Staff"

        if (BOT_API_SECRET && session.user.discord_id) {
            try {
                const memberResponse = await fetch(`${BOT_API_URL}/api/member/${session.user.discord_id}`, {
                    headers: { 'Authorization': `Bearer ${BOT_API_SECRET}` }
                })
                if (memberResponse.ok) {
                    const memberData = await memberResponse.json()
                    senderDisplayName = memberData.displayName || senderDisplayName
                    senderRole = memberData.role || senderRole
                }
            } catch {
                // Fallback au nom de session
            }
        }

        const senderFullName = `${senderDisplayName} (${senderRole})`

        // 3. Insérer le message en BDD
        const { data: message, error: msgError } = await supabase
            .from('appointment_messages')
            .insert({
                appointment_id: id,
                sender_discord_id: session.user.discord_id,
                sender_name: senderFullName,
                content: content,
                is_from_staff: true
            })
            .select()
            .single()

        if (msgError) {
            return NextResponse.json({ error: "Erreur lors de l'enregistrement du message" }, { status: 500 })
        }

        // 4. Envoyer via l'API du Bot pour DM + salon Discord
        if (BOT_API_SECRET) {
            try {
                await fetch(`${BOT_API_URL}/api/appointment/message`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${BOT_API_SECRET}`
                    },
                    body: JSON.stringify({
                        appointmentId: id,
                        channelId: appointment.discord_channel_id,
                        discordId: appointment.discord_id,
                        senderName: senderDisplayName,
                        senderRole: senderRole,
                        content: content
                    })
                })
            } catch (botError) {
                console.error('Erreur appel Bot API:', botError)
                // On ne bloque pas, le message est en BDD
            }
        }

        return NextResponse.json({ success: true, message })

    } catch (error) {
        console.error('Error sending message:', error)
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
    }
}
