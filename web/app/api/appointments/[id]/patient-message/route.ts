import { createClient } from "@/lib/supabase/server"
import { auth } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const session = await auth()
        if (!session?.user?.discord_id) {
            return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
        }

        const body = await request.json()
        const { content } = body

        if (!content?.trim()) {
            return NextResponse.json({ error: "Contenu requis" }, { status: 400 })
        }

        const supabase = await createClient()

        // Vérifier que l'utilisateur est le propriétaire du RDV
        const { data: appointment, error: appError } = await supabase
            .from('appointments')
            .select('id, discord_id, discord_channel_id, status')
            .eq('id', id)
            .single()

        if (appError || !appointment) {
            return NextResponse.json({ error: "Rendez-vous introuvable" }, { status: 404 })
        }

        if (appointment.discord_id !== session.user.discord_id) {
            return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
        }

        if (appointment.status === 'completed' || appointment.status === 'cancelled') {
            return NextResponse.json({ error: "Ce rendez-vous est clôturé" }, { status: 400 })
        }

        const senderName = session.user.discord_username || session.user.name || 'Patient'

        // Insérer le message en BDD
        const { data: message, error: msgError } = await supabase
            .from('appointment_messages')
            .insert({
                appointment_id: id,
                sender_discord_id: session.user.discord_id,
                sender_name: senderName,
                content: content.trim(),
                is_from_staff: false
            })
            .select()
            .single()

        if (msgError) {
            return NextResponse.json({ error: "Erreur lors de l'enregistrement du message" }, { status: 500 })
        }

        // Notifier le bot Discord (poster dans le salon du RDV)
        const BOT_API_URL = process.env.BOT_API_URL || 'http://localhost:3001'
        const BOT_API_SECRET = process.env.BOT_API_SECRET

        if (BOT_API_SECRET && appointment.discord_channel_id) {
            try {
                await fetch(`${BOT_API_URL}/api/appointment/patient-message`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${BOT_API_SECRET}`
                    },
                    body: JSON.stringify({
                        appointmentId: id,
                        channelId: appointment.discord_channel_id,
                        senderName,
                        content: content.trim()
                    })
                })
            } catch (botError) {
                console.error('Erreur appel Bot API:', botError)
                // Non-blocking
            }
        }

        return NextResponse.json({ success: true, message })

    } catch (error) {
        console.error('Error sending patient message:', error)
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
    }
}
