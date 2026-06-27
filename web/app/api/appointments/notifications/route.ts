import { createClient } from "@/lib/supabase/server"
import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"
import { requireEmployeeAccess } from "@/lib/auth-utils"

/**
 * GET /api/appointments/notifications
 * Retourne :
 * - pending_count : nombre de RDV en attente (tous les médecins)
 * - my_appointments : pour mes RDV pris en charge (assigned_to = moi),
 *   la date du dernier message patient non-staff (pour détecter les non-lus côté client)
 */
export async function GET() {
    try {
        const session = await auth()
        if (!session?.user?.discord_id) {
            return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
        }

        const { authorized } = await requireEmployeeAccess()
        if (!authorized) {
            return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
        }

        const supabase = await createClient()

        // 1. Compter les RDV en attente (tous)
        const { count: pendingCount } = await supabase
            .from('appointments')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending')

        // 2. Mes RDV pris en charge (scheduled, assigned à moi)
        const { data: myAssigned } = await supabase
            .from('appointments')
            .select('id')
            .eq('assigned_to', session.user.discord_id)
            .eq('status', 'scheduled')

        const myIds = (myAssigned || []).map(a => a.id)

        // 3. Dernier message PATIENT (non-staff) pour chacun de mes RDV
        const myAppointments: Array<{ id: string; last_patient_message_at: string | null }> = []

        if (myIds.length > 0) {
            const { data: msgs } = await supabase
                .from('appointment_messages')
                .select('appointment_id, created_at')
                .in('appointment_id', myIds)
                .eq('is_from_staff', false)
                .order('created_at', { ascending: false })

            // On garde seulement le message le plus récent par appointment
            const seen = new Set<string>()
            for (const msg of msgs || []) {
                if (!seen.has(msg.appointment_id)) {
                    seen.add(msg.appointment_id)
                    myAppointments.push({
                        id: msg.appointment_id,
                        last_patient_message_at: msg.created_at
                    })
                }
            }

            // Ajouter les RDV assignés sans message patient (last_patient_message_at = null)
            for (const id of myIds) {
                if (!seen.has(id)) {
                    myAppointments.push({ id, last_patient_message_at: null })
                }
            }
        }

        return NextResponse.json({
            pending_count: pendingCount ?? 0,
            my_appointments: myAppointments
        })

    } catch (error) {
        console.error('Error fetching notifications:', error)
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
    }
}
