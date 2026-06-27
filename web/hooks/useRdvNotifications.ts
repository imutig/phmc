import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"

const LS_PREFIX = "rdv_read_"

interface MyAppointment {
    id: string
    last_patient_message_at: string | null
}

interface RdvNotifications {
    /** Nombre total de notifications (pending + non-lus sur mes RDV) */
    totalCount: number
    /** Nombre de RDV en attente non pris en charge */
    pendingCount: number
    /** IDs des RDV (assignés à moi) avec messages patient non lus */
    unreadIds: Set<string>
    /** Marquer un RDV comme lu */
    markAsRead: (appointmentId: string) => void
    /** Rafraîchir manuellement */
    refresh: () => void
}

function computeUnreadIds(myAppointments: MyAppointment[]): Set<string> {
    const unread = new Set<string>()
    for (const appt of myAppointments) {
        if (!appt.last_patient_message_at) continue
        const lastRead = localStorage.getItem(`${LS_PREFIX}${appt.id}`)
        if (!lastRead || new Date(appt.last_patient_message_at) > new Date(lastRead)) {
            unread.add(appt.id)
        }
    }
    return unread
}

export function useRdvNotifications(): RdvNotifications {
    const [pendingCount, setPendingCount] = useState(0)
    const [unreadIds, setUnreadIds] = useState<Set<string>>(new Set())
    const [myAppointments, setMyAppointments] = useState<MyAppointment[]>([])

    const fetchNotifications = useCallback(async () => {
        try {
            const res = await fetch("/api/appointments/notifications")
            if (!res.ok) return
            const data = await res.json()
            setPendingCount(data.pending_count ?? 0)
            const appts: MyAppointment[] = data.my_appointments ?? []
            setMyAppointments(appts)
            setUnreadIds(computeUnreadIds(appts))
        } catch {
            // Silencieux — ne pas casser la sidebar
        }
    }, [])

    const markAsRead = useCallback((appointmentId: string) => {
        localStorage.setItem(`${LS_PREFIX}${appointmentId}`, new Date().toISOString())
        setUnreadIds(prev => {
            const next = new Set(prev)
            next.delete(appointmentId)
            return next
        })
    }, [])

    useEffect(() => {
        fetchNotifications()

        // Rafraîchir toutes les 60s
        const interval = setInterval(fetchNotifications, 60_000)

        // Realtime : nouveau message patient → recalcul immédiat
        const supabase = createClient()
        const channel = supabase
            .channel("rdv-notif-messages")
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "appointment_messages",
                    filter: "is_from_staff=eq.false"
                },
                () => { fetchNotifications() }
            )
            .subscribe()

        // Realtime : nouveau RDV pending → mise à jour du badge pending
        const rdvChannel = supabase
            .channel("rdv-notif-appointments")
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "appointments"
                },
                () => { fetchNotifications() }
            )
            .subscribe()

        return () => {
            clearInterval(interval)
            supabase.removeChannel(channel)
            supabase.removeChannel(rdvChannel)
        }
    }, [fetchNotifications])

    // Recalcul si localStorage change (ex : depuis demandes/page)
    const recomputeFromStorage = useCallback(() => {
        setUnreadIds(computeUnreadIds(myAppointments))
    }, [myAppointments])

    const totalCount = pendingCount + unreadIds.size

    return {
        totalCount,
        pendingCount,
        unreadIds,
        markAsRead,
        refresh: fetchNotifications
    }
}
