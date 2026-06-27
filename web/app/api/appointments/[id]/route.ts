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

        const supabase = await createClient()

        // Récupérer le RDV
        const { data: appointment, error: appError } = await supabase
            .from('appointments')
            .select('*, patient:patients(*)')
            .eq('id', id)
            .single()

        if (appError || !appointment) {
            return NextResponse.json({ error: "Rendez-vous introuvable" }, { status: 404 })
        }

        // Le patient peut accéder à son propre RDV, le staff à tous
        const isEmployee = (await requireEmployeeAccess()).authorized
        const isOwner = appointment.discord_id === session.user.discord_id

        if (!isEmployee && !isOwner) {
            return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
        }

        // Récupérer les messages
        const { data: messages } = await supabase
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
        const { status, scheduled_date, scheduled_end_date, cancel_reason } = body

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

        // 5. Sync planning : créer un événement quand le RDV est confirmé
        if (status === 'scheduled' && scheduled_date) {
            try {
                const { data: fullAppointment } = await supabase
                    .from('appointments')
                    .select('discord_id, discord_username, patient:patients(first_name, last_name)')
                    .eq('id', id)
                    .single()

                const patientRaw = fullAppointment?.patient as unknown as { first_name: string; last_name: string } | null
                const patientName = patientRaw?.first_name
                    ? `${patientRaw.first_name} ${patientRaw.last_name}`
                    : (fullAppointment?.discord_username || 'Patient')

                const eventStart = new Date(scheduled_date)
                const eventEnd = scheduled_end_date ? new Date(scheduled_end_date) : new Date(eventStart.getTime() + 60 * 60 * 1000)
                const eventDate = eventStart.toISOString().split('T')[0]
                const startTime = eventStart.toTimeString().slice(0, 5)
                const endTime = eventEnd.toTimeString().slice(0, 5)

                const { data: newEvent } = await supabase.from('events').insert({
                    title: `RDV - ${patientName}`,
                    event_type: 'rdv',
                    event_date: eventDate,
                    start_time: startTime,
                    end_time: endTime,
                    color: '#10b981',
                    is_published: true,
                    participants_all: false,
                    created_by: session.user.discord_id
                }).select('id').single()

                if (newEvent && fullAppointment?.discord_id && session.user.discord_id) {
                    await supabase.from('event_participants').insert([
                        { event_id: newEvent.id, user_discord_id: session.user.discord_id, user_name: staffDisplayName },
                        { event_id: newEvent.id, user_discord_id: fullAppointment.discord_id, user_name: patientName }
                    ])
                }
            } catch (planningError) {
                console.error('Planning sync error:', planningError)
                // Non-blocking
            }
        }

        // 6. Notifier le bot Discord (DM + salon si disponible)
        if (BOT_API_SECRET && appointment.discord_id) {
            try {
                await fetch(`${BOT_API_URL}/api/appointment/status`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${BOT_API_SECRET}`
                    },
                    body: JSON.stringify({
                        channelId: appointment.discord_channel_id || null,
                        discordId: appointment.discord_id,
                        newStatus: status,
                        actorName: staffDisplayName,
                        actorRole: staffRole,
                        scheduledDate: scheduled_date || null,
                        scheduledEndDate: scheduled_end_date || null,
                        cancelReason: cancel_reason || null
                    })
                })
            } catch (botError) {
                console.error('Error notifying bot:', botError)
            }
        }

        return NextResponse.json({ success: true })

    } catch (error) {
        console.error('Error updating appointment:', error)
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
    }
}
