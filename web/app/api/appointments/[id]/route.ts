import { createClient } from "@/lib/supabase/server"
import { auth } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"
import { requireEmployeeAccess } from "@/lib/auth-utils"

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
        }

        // Vérifier l'accès employé
        const { authorized } = await requireEmployeeAccess()
        if (!authorized) {
            return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
        }

        const supabase = await createClient()

        // Récupérer le RDV
        const { data: appointment, error: appError } = await supabase
            .from('appointments')
            .select('*')
            .eq('id', id)
            .single()

        if (appError || !appointment) {
            return NextResponse.json({ error: "Rendez-vous introuvable" }, { status: 404 })
        }

        // Récupérer les messages
        const { data: messages, error: msgError } = await supabase
            .from('appointment_messages')
            .select('*')
            .eq('appointment_id', id)
            .order('created_at', { ascending: true })

        return NextResponse.json({
            appointment,
            messages: messages || []
        })

    } catch (error) {
        console.error('Error fetching appointment:', error)
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
    }
}

export async function PATCH(
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
        const { status, scheduled_date, cancel_reason } = body

        if (!status) {
            return NextResponse.json({ error: "Statut requis" }, { status: 400 })
        }

        const supabase = await createClient()

        // 1. Récupérer le RDV pour avoir le channel_id et discord_id
        const { data: appointment, error: fetchError } = await supabase
            .from('appointments')
            .select('discord_channel_id, discord_id')
            .eq('id', id)
            .single()

        if (fetchError || !appointment) {
            return NextResponse.json({ error: "Rendez-vous introuvable" }, { status: 404 })
        }

        // 2. Récupérer le displayName et le rôle du staff
        const BOT_API_URL = process.env.BOT_API_URL || 'http://localhost:3001'
        const BOT_API_SECRET = process.env.BOT_API_SECRET

        let staffDisplayName = session.user.name || session.user.discord_username || "Staff"
        let staffRole = "Staff"

        if (BOT_API_SECRET && session.user.discord_id) {
            try {
                const memberResponse = await fetch(`${BOT_API_URL}/api/member/${session.user.discord_id}`, {
                    headers: { 'Authorization': `Bearer ${BOT_API_SECRET}` }
                })
                if (memberResponse.ok) {
                    const memberData = await memberResponse.json()
                    staffDisplayName = memberData.displayName || staffDisplayName
                    staffRole = memberData.role || staffRole
                }
            } catch {
                // Fallback
            }
        }

        // 3. Préparer les données de mise à jour
        const updateData: Record<string, unknown> = { status }

        if (status === 'scheduled' && scheduled_date) {
            updateData.scheduled_date = scheduled_date
            updateData.assigned_to = session.user.discord_id
            updateData.assigned_to_name = `${staffDisplayName} (${staffRole})`
        }

        if (status === 'completed') {
            updateData.completed_at = new Date().toISOString()
            updateData.completed_by = `${staffDisplayName} (${staffRole})`
        }

        if (status === 'cancelled' && cancel_reason !== undefined) {
            updateData.cancel_reason = cancel_reason
        }

        // 4. Mettre à jour le statut
        const { error: updateError } = await supabase
            .from('appointments')
            .update(updateData)
            .eq('id', id)

        if (updateError) {
            return NextResponse.json({ error: "Erreur lors de la mise à jour" }, { status: 500 })
        }

        // 5. Notifier le bot Discord si un canal existe
        if (appointment.discord_channel_id && BOT_API_SECRET) {
            try {
                await fetch(`${BOT_API_URL}/api/appointment/status`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${BOT_API_SECRET}`
                    },
                    body: JSON.stringify({
                        channelId: appointment.discord_channel_id,
                        discordId: appointment.discord_id,
                        newStatus: status,
                        actorName: staffDisplayName,
                        actorRole: staffRole,
                        scheduledDate: scheduled_date || null,
                        cancelReason: cancel_reason || null
                    })
                })
            } catch (botError) {
                console.error('Error notifying bot:', botError)
                // On ne bloque pas la réponse si le bot échoue
            }
        }

        return NextResponse.json({ success: true })

    } catch (error) {
        console.error('Error updating appointment:', error)
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
    }
}
