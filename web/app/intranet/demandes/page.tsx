"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Clock, Calendar, CheckCircle, XCircle, User, MessageSquare,
    Send, Loader2, AlertCircle, ChevronRight, X, CalendarCheck,
    RefreshCw
} from "lucide-react";
import { useSession } from "next-auth/react";
import { createClient } from "@/lib/supabase/client";
import { useRdvNotifications } from "@/hooks/useRdvNotifications";

// ─── Types ─────────────────────────────────────────────────────────────────────────────

interface AvailabilitySlot {
    date: string
    from: string
    to: string
}

interface Patient {
    id: string
    first_name: string
    last_name: string
    phone: string | null
    fingerprint: string | null
}

interface Appointment {
    id: string
    discord_id: string
    discord_username: string | null
    status: 'pending' | 'scheduled' | 'completed' | 'cancelled'
    reason_category: string
    reason: string | null
    availability_slots: AvailabilitySlot[]
    scheduled_date: string | null
    scheduled_end_date: string | null
    assigned_to: string | null
    assigned_to_name: string | null
    cancel_reason: string | null
    created_at: string
    patient: Patient | null
}

interface Message {
    id: string
    appointment_id: string
    sender_discord_id: string
    sender_name: string
    content: string
    is_from_staff: boolean
    created_at: string
}

interface ConfirmSlotState {
    date: string
    slotFrom: string
    slotTo: string
    selectedStart: string
    selectedEnd: string
}

// ─── Helpers ───────────────────────────────────────────────────────────────────────────

function timeToMins(t: string): number {
    if (!t || t === '00:00') return 1440
    const [h, m] = t.split(':').map(Number)
    const total = h * 60 + m
    return total === 0 ? 1440 : total
}

function minsToTime(mins: number): string {
    const clamped = Math.min(mins, 1439)
    return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`
}

function addMins(time: string, delta: number): string {
    const [h, m] = time.split(':').map(Number)
    return minsToTime(h * 60 + m + delta)
}

function generateTimeOptions(fromStr: string, toStr: string, step = 15): string[] {
    const from = fromStr === '00:00' ? 0 : (() => { const [h, m] = fromStr.split(':').map(Number); return h * 60 + m })()
    const to = timeToMins(toStr)
    const opts: string[] = []
    for (let m = from; m < to; m += step) {
        opts.push(minsToTime(m))
    }
    return opts
}

// ─── Constantes ─────────────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
    pending: { label: 'En attente', color: 'text-yellow-400', bg: 'bg-yellow-500/20', border: 'border-yellow-500/30', icon: Clock },
    scheduled: { label: 'Programmé', color: 'text-blue-400', bg: 'bg-blue-500/20', border: 'border-blue-500/30', icon: Calendar },
    completed: { label: 'Terminé', color: 'text-emerald-400', bg: 'bg-emerald-500/20', border: 'border-emerald-500/30', icon: CheckCircle },
    cancelled: { label: 'Annulé', color: 'text-red-400', bg: 'bg-red-500/20', border: 'border-red-500/30', icon: XCircle },
}

const FILTER_TABS = [
    { key: null, label: 'Toutes' },
    { key: 'pending', label: 'En attente' },
    { key: 'scheduled', label: 'Programmées' },
    { key: 'completed', label: 'Terminées' },
    { key: 'cancelled', label: 'Annulées' },
] as const

function formatShortDate(iso: string) {
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function formatDayLabel(dateStr: string) {
    const d = new Date(dateStr + 'T12:00:00')
    return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
}

function formatScheduledDate(iso: string): string {
    const d = new Date(iso)
    const date = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
    const h = String(d.getHours()).padStart(2, '0')
    const m = String(d.getMinutes()).padStart(2, '0')
    return `${date} · ${h}h${m}`
}

function patientDisplayName(appt: Appointment): string {
    if (appt.patient) {
        const name = `${appt.patient.first_name} ${appt.patient.last_name}`
        return appt.discord_username ? `${name} (${appt.discord_username})` : name
    }
    return appt.discord_username || 'Patient inconnu'
}

// ─── Sous-composants ──────────────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Appointment['status'] }) {
    const cfg = STATUS_CONFIG[status]
    const Icon = cfg.icon
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-display font-bold uppercase tracking-wide border ${cfg.bg} ${cfg.border} ${cfg.color}`}>
            <Icon className="w-3 h-3" />
            {cfg.label}
        </span>
    )
}

function AvailabilityGrid({ slots, onSelect, disabled }: {
    slots: AvailabilitySlot[]
    onSelect?: (date: string, slotFrom: string, slotTo: string) => void
    disabled?: boolean
}) {
    if (!slots || slots.length === 0) {
        return <p className="text-xs text-gray-500 italic">Aucune disponibilité renseignée</p>
    }
    return (
        <div className="space-y-2">
            {slots.sort((a, b) => a.date.localeCompare(b.date)).map(slot => (
                <button
                    key={slot.date}
                    type="button"
                    disabled={disabled}
                    onClick={() => onSelect?.(slot.date, slot.from, slot.to)}
                    className={`w-full text-left p-2.5 border transition-all ${
                        disabled
                            ? 'border-white/10 text-gray-500 cursor-default'
                            : 'border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 hover:border-emerald-500/60 cursor-pointer'
                    }`}
                >
                    <p className="text-xs text-gray-400 font-display font-bold uppercase mb-0.5">
                        {formatDayLabel(slot.date)}
                    </p>
                    <p className={`text-sm font-mono ${disabled ? 'text-gray-500' : 'text-emerald-300'}`}>
                        {slot.from} – {slot.to === '00:00' ? 'minuit' : slot.to}
                    </p>
                </button>
            ))}
        </div>
    )
}

// ─── Page principale ──────────────────────────────────────────────────────────────────────────

export default function DemandesPage() {
    const { data: session } = useSession()
    const [appointments, setAppointments] = useState<Appointment[]>([])
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [messages, setMessages] = useState<Message[]>([])
    const [filter, setFilter] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [newMessage, setNewMessage] = useState("")
    const [sending, setSending] = useState(false)
    const [confirmSlot, setConfirmSlot] = useState<ConfirmSlotState | null>(null)
    const [cancelModal, setCancelModal] = useState(false)
    const [cancelReason, setCancelReason] = useState("")
    const [actionLoading, setActionLoading] = useState(false)
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

    const { unreadIds, markAsRead } = useRdvNotifications()
    const myDiscordId = session?.user?.discord_id

    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)

    const selected = appointments.find(a => a.id === selectedId) || null

    useEffect(() => {
        if (!toast) return
        const t = setTimeout(() => setToast(null), 3500)
        return () => clearTimeout(t)
    }, [toast])

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    const fetchAppointments = useCallback(async (silent = false) => {
        if (!silent) setLoading(true); else setRefreshing(true)
        try {
            const url = filter ? `/api/appointments?status=${filter}` : '/api/appointments'
            const res = await fetch(url)
            if (res.ok) {
                const data = await res.json()
                setAppointments(data.appointments || [])
            }
        } finally {
            if (!silent) setLoading(false); else setRefreshing(false)
        }
    }, [filter])

    useEffect(() => {
        fetchAppointments()
    }, [fetchAppointments])

    const fetchMessages = useCallback(async (id: string) => {
        const res = await fetch(`/api/appointments/${id}`)
        if (res.ok) {
            const data = await res.json()
            setMessages(data.messages || [])
        }
    }, [])

    useEffect(() => {
        if (!selectedId) { setMessages([]); return }
        fetchMessages(selectedId)
    }, [selectedId, fetchMessages])

    // Note: pas de polling — le Realtime + fetchMessages au changement de sélection suffisent

    // Supabase Realtime
    useEffect(() => {
        if (!selectedId) return
        const supabase = createClient()
        const channel = supabase
            .channel(`staff_rdv_${selectedId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'appointment_messages',
                    filter: `appointment_id=eq.${selectedId}`
                },
                (payload) => {
                    const newMsg = payload.new as Message
                    setMessages(prev => {
                        if (prev.find(m => m.id === newMsg.id)) return prev
                        return [...prev, newMsg]
                    })
                }
            )
            .subscribe()
        return () => { supabase.removeChannel(channel) }
    }, [selectedId])

    // ─── Actions ────────────────────────────────────────────────────────────────────────────

    const sendMessage = async () => {
        if (!newMessage.trim() || !selectedId || sending) return
        setSending(true)
        const content = newMessage.trim()
        setNewMessage("")
        const optimistic: Message = {
            id: `temp_${Date.now()}`,
            appointment_id: selectedId,
            sender_discord_id: session?.user?.discord_id || '',
            sender_name: session?.user?.discord_username || session?.user?.name || 'Staff',
            content,
            is_from_staff: true,
            created_at: new Date().toISOString()
        }
        setMessages(prev => [...prev, optimistic])
        try {
            const res = await fetch(`/api/appointments/${selectedId}/message`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content })
            })
            if (!res.ok) {
                setMessages(prev => prev.filter(m => m.id !== optimistic.id))
                setToast({ msg: "Erreur lors de l'envoi", type: 'error' })
            } else {
                // Remplacer le message optimiste par le vrai message (avec le vrai ID)
                // Ainsi Realtime ne crée pas de doublon car l'ID réel est déjà présent
                const data = await res.json()
                if (data.message) {
                    setMessages(prev =>
                        prev.map(m => m.id === optimistic.id ? data.message : m)
                    )
                }
            }
        } catch {
            setMessages(prev => prev.filter(m => m.id !== optimistic.id))
        } finally {
            setSending(false)
            inputRef.current?.focus()
        }
    }

    const confirmSchedule = async () => {
        if (!confirmSlot || !selectedId) return
        setActionLoading(true)
        const scheduledDate = new Date(`${confirmSlot.date}T${confirmSlot.selectedStart}:00`)
        const scheduledEndDate = new Date(`${confirmSlot.date}T${confirmSlot.selectedEnd}:00`)
        if (confirmSlot.selectedEnd === '00:00') scheduledEndDate.setDate(scheduledEndDate.getDate() + 1)
        try {
            const res = await fetch(`/api/appointments/${selectedId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: 'scheduled',
                    scheduled_date: scheduledDate.toISOString(),
                    scheduled_end_date: scheduledEndDate.toISOString()
                })
            })
            if (res.ok) {
                setToast({ msg: 'Rendez-vous confirmé ! Le patient a été notifié.', type: 'success' })
                setConfirmSlot(null)
                await fetchAppointments(true)
            } else {
                const data = await res.json()
                setToast({ msg: data.error || 'Erreur', type: 'error' })
            }
        } finally {
            setActionLoading(false)
        }
    }

    const handleCancel = async () => {
        if (!selectedId) return
        setActionLoading(true)
        try {
            const res = await fetch(`/api/appointments/${selectedId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'cancelled', cancel_reason: cancelReason || null })
            })
            if (res.ok) {
                setToast({ msg: 'Rendez-vous annulé.', type: 'success' })
                setCancelModal(false)
                setCancelReason("")
                await fetchAppointments(true)
            } else {
                const data = await res.json()
                setToast({ msg: data.error || 'Erreur', type: 'error' })
            }
        } finally {
            setActionLoading(false)
        }
    }

    const handleComplete = async () => {
        if (!selectedId) return
        setActionLoading(true)
        try {
            const res = await fetch(`/api/appointments/${selectedId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'completed' })
            })
            if (res.ok) {
                setToast({ msg: 'Rendez-vous marqué comme terminé.', type: 'success' })
                await fetchAppointments(true)
            } else {
                const data = await res.json()
                setToast({ msg: data.error || 'Erreur', type: 'error' })
            }
        } finally {
            setActionLoading(false)
        }
    }

    const reopenToPending = async () => {
        if (!selectedId) return
        setActionLoading(true)
        try {
            const res = await fetch(`/api/appointments/${selectedId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'pending' })
            })
            if (res.ok) {
                setToast({ msg: 'RDV remis en attente.', type: 'success' })
                await fetchAppointments(true)
            } else {
                const data = await res.json()
                setToast({ msg: data.error || 'Erreur', type: 'error' })
            }
        } finally {
            setActionLoading(false)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
    }

    const openConfirmSlot = (date: string, slotFrom: string, slotTo: string) => {
        const fromMins = slotFrom === '00:00' ? 0 : (() => { const [h, m] = slotFrom.split(':').map(Number); return h * 60 + m })()
        const toMins = timeToMins(slotTo)
        const defaultEndMins = Math.min(fromMins + 60, toMins - 15)
        setConfirmSlot({
            date,
            slotFrom,
            slotTo,
            selectedStart: slotFrom === '00:00' ? '00:01' : slotFrom,
            selectedEnd: minsToTime(defaultEndMins)
        })
    }

    // ─── Render ────────────────────────────────────────────────────────────────────────────

    // ─── Tri + rendu ───────────────────────────────────────────────────────────────────────

    // Tri : pending d'abord, puis mes RDV avec messages non lus, puis le reste
    const sortedAppointments = [...appointments].sort((a, b) => {
        const scoreOf = (appt: Appointment) => {
            if (appt.status === 'pending') return 3
            if (appt.assigned_to === myDiscordId && unreadIds.has(appt.id)) return 2
            return 1
        }
        return scoreOf(b) - scoreOf(a)
    })

    return (
        <div className="flex h-full gap-0 relative">

            {/* Toast */}
            <AnimatePresence>
                {toast && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className={`fixed top-4 right-4 z-50 px-4 py-3 border font-sans text-sm flex items-center gap-2 ${
                            toast.type === 'success'
                                ? 'bg-emerald-900/80 border-emerald-500/40 text-emerald-300'
                                : 'bg-red-900/80 border-red-500/40 text-red-300'
                        }`}
                    >
                        {toast.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                        {toast.msg}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Panneau gauche — liste */}
            <div className={`${selectedId ? 'hidden lg:flex' : 'flex'} flex-col w-full lg:w-80 xl:w-96 border-r border-white/10 flex-shrink-0`}>
                <div className="p-4 border-b border-white/10">
                    <div className="flex items-center justify-between mb-3">
                        <h1 className="font-display text-lg font-bold uppercase tracking-widest">Demandes RDV</h1>
                        <button
                            onClick={() => fetchAppointments(true)}
                            className="text-gray-400 hover:text-white transition-colors"
                            title="Actualiser"
                        >
                            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                        {FILTER_TABS.map(tab => (
                            <button
                                key={String(tab.key)}
                                onClick={() => setFilter(tab.key)}
                                className={`px-2.5 py-1 text-xs font-display font-bold uppercase tracking-wide border transition-all ${
                                    filter === tab.key
                                        ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                                        : 'border-white/10 text-gray-400 hover:border-white/30 hover:text-white'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
                        </div>
                    ) : sortedAppointments.length === 0 ? (
                        <div className="text-center py-12">
                            <Calendar className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                            <p className="text-gray-500 font-sans text-sm">Aucune demande</p>
                        </div>
                    ) : (
                        sortedAppointments.map(appt => {
                            const hasUnread = appt.assigned_to === myDiscordId && unreadIds.has(appt.id)
                            return (
                                <button
                                    key={appt.id}
                                    onClick={() => {
                                        setSelectedId(appt.id)
                                        // Marquer comme lu dès qu'on ouvre le RDV
                                        if (hasUnread) markAsRead(appt.id)
                                    }}
                                    className={`w-full text-left p-3 border-b border-white/5 hover:bg-white/5 transition-all flex items-start gap-3 ${
                                        selectedId === appt.id ? 'bg-white/10 border-l-2 border-l-emerald-500' : ''
                                    }`}
                                >
                                    <div className="relative w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <User className="w-4 h-4 text-gray-400" />
                                        {/* Point de notification : message patient non lu (mon RDV) */}
                                        {hasUnread && (
                                            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-orange-400 rounded-full border border-[#0f1110] animate-pulse" />
                                        )}
                                        {/* Point de notification : RDV pending non pris en charge */}
                                        {appt.status === 'pending' && !hasUnread && (
                                            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-yellow-400 rounded-full border border-[#0f1110]" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className="font-display font-bold text-sm text-white truncate">
                                                {patientDisplayName(appt)}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-400 truncate mb-1">{appt.reason_category}</p>
                                        <div className="flex items-center gap-2">
                                            <StatusBadge status={appt.status} />
                                            <span className="text-xs text-gray-600 font-mono">{formatShortDate(appt.created_at)}</span>
                                        </div>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-gray-600 flex-shrink-0 mt-2" />
                                </button>
                            )
                        })
                    )}
                </div>
            </div>

            {/* Panneau droit — détail */}
            {selectedId && selected ? (
                <div className="flex-1 flex flex-col min-w-0">
                    <div className="p-4 border-b border-white/10 flex items-start gap-3">
                        <button
                            onClick={() => setSelectedId(null)}
                            className="lg:hidden text-gray-400 hover:text-white mt-0.5"
                        >
                            <ArrowLeftIcon className="w-5 h-5" />
                        </button>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 flex-wrap">
                                <h2 className="font-display font-bold text-lg">
                                    {patientDisplayName(selected)}
                                </h2>
                                <StatusBadge status={selected.status} />
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5">{selected.reason_category}{selected.reason ? ` — ${selected.reason}` : ''}</p>
                            {selected.patient?.phone && (
                                <p className="text-xs text-gray-500 mt-0.5">📞 {selected.patient.phone}</p>
                            )}
                        </div>
                    </div>

                    <div className="flex-1 overflow-hidden flex flex-col lg:flex-row min-h-0">

                        {/* Colonne gauche : infos + actions */}
                        <div className="w-full lg:w-64 xl:w-72 flex-shrink-0 border-b lg:border-b-0 lg:border-r border-white/10 p-4 space-y-4 overflow-y-auto">

                            {selected.status === 'scheduled' && selected.scheduled_date && (
                                <div className="border border-blue-500/30 bg-blue-500/10 p-3">
                                    <p className="text-xs text-blue-400 font-display font-bold uppercase mb-1 flex items-center gap-1">
                                        <Calendar className="w-3.5 h-3.5" /> Date confirmée
                                    </p>
                                    <p className="text-sm text-white font-sans">{formatScheduledDate(selected.scheduled_date)}</p>
                                    {selected.scheduled_end_date && (
                                        <p className="text-xs text-blue-300 font-mono mt-0.5">
                                            jusqu’à {new Date(selected.scheduled_end_date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    )}
                                    {selected.assigned_to_name && (
                                        <p className="text-xs text-gray-400 mt-1">Par {selected.assigned_to_name}</p>
                                    )}
                                </div>
                            )}

                            {selected.status === 'pending' && (
                                <div>
                                    <p className="text-xs text-gray-400 font-display font-bold uppercase mb-2">
                                        Disponibilités du patient
                                    </p>
                                    <AvailabilityGrid
                                        slots={selected.availability_slots || []}
                                        onSelect={openConfirmSlot}
                                    />
                                </div>
                            )}

                            <div className="space-y-2">
                                {selected.status === 'scheduled' && (
                                    <>
                                        <div>
                                            <p className="text-xs text-gray-400 font-display font-bold uppercase mb-2">
                                                Modifier le créneau
                                            </p>
                                            <AvailabilityGrid
                                                slots={selected.availability_slots || []}
                                                onSelect={openConfirmSlot}
                                            />
                                        </div>
                                        <button
                                            onClick={handleComplete}
                                            disabled={actionLoading}
                                            className="w-full py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-display font-bold uppercase transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                        >
                                            <CheckCircle className="w-3.5 h-3.5" />
                                            Marquer terminé
                                        </button>
                                        <button
                                            onClick={() => setCancelModal(true)}
                                            disabled={actionLoading}
                                            className="w-full py-2 border border-red-500/40 text-red-400 hover:bg-red-500/10 text-xs font-display uppercase transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                        >
                                            <XCircle className="w-3.5 h-3.5" />
                                            Annuler
                                        </button>
                                    </>
                                )}
                                {selected.status === 'pending' && (
                                    <button
                                        onClick={() => setCancelModal(true)}
                                        disabled={actionLoading}
                                        className="w-full py-2 border border-red-500/40 text-red-400 hover:bg-red-500/10 text-xs font-display uppercase transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        <XCircle className="w-3.5 h-3.5" />
                                        Refuser la demande
                                    </button>
                                )}
                                {(selected.status === 'cancelled' || selected.status === 'completed') && (
                                    <button
                                        onClick={reopenToPending}
                                        disabled={actionLoading}
                                        className="w-full py-2 border border-white/20 text-gray-400 hover:text-white text-xs font-display uppercase transition-all disabled:opacity-50"
                                    >
                                        Remettre en attente
                                    </button>
                                )}
                            </div>

                            {selected.status === 'cancelled' && selected.cancel_reason && (
                                <div className="border border-red-500/20 bg-red-500/5 p-3">
                                    <p className="text-xs text-red-400 font-display font-bold uppercase mb-1">Raison</p>
                                    <p className="text-xs text-gray-300 font-sans">{selected.cancel_reason}</p>
                                </div>
                            )}
                        </div>

                        {/* Chat */}
                        <div className="flex-1 flex flex-col min-h-0">
                            <div className="px-4 py-2 border-b border-white/10 flex items-center gap-2">
                                <MessageSquare className="w-4 h-4 text-emerald-400" />
                                <span className="font-display font-bold text-xs uppercase tracking-widest">Discussion</span>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                {messages.length === 0 && (
                                    <div className="flex flex-col items-center justify-center h-full text-center py-8">
                                        <MessageSquare className="w-8 h-8 text-gray-600 mb-2" />
                                        <p className="text-gray-500 text-sm font-sans">Pas encore de message</p>
                                    </div>
                                )}
                                {messages.map(msg => {
                                    const isStaff = msg.is_from_staff
                                    const isMe = msg.sender_discord_id === session?.user?.discord_id && isStaff
                                    return (
                                        <div key={msg.id} className={`flex gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
                                            {!isMe && (
                                                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${isStaff ? 'bg-emerald-500/20' : 'bg-blue-500/20'}`}>
                                                    <User className={`w-3.5 h-3.5 ${isStaff ? 'text-emerald-400' : 'text-blue-400'}`} />
                                                </div>
                                            )}
                                            <div className={`max-w-[75%] flex flex-col gap-0.5 ${isMe ? 'items-end' : 'items-start'}`}>
                                                {!isMe && (
                                                    <span className={`text-xs font-display font-bold ${isStaff ? 'text-emerald-400' : 'text-blue-400'}`}>
                                                        {msg.sender_name}{!isStaff ? ' (patient)' : ''}
                                                    </span>
                                                )}
                                                <div className={`px-3 py-2 text-sm font-sans break-words ${
                                                    isMe
                                                        ? 'bg-emerald-600/30 border border-emerald-500/30 text-white'
                                                        : isStaff
                                                            ? 'bg-white/10 border border-white/10 text-white'
                                                            : 'bg-blue-500/10 border border-blue-500/20 text-blue-100'
                                                }`}>
                                                    {msg.content}
                                                </div>
                                                <span className="text-xs text-gray-600 font-mono">
                                                    {new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        </div>
                                    )
                                })}
                                <div ref={messagesEndRef} />
                            </div>
                            {selected.status !== 'completed' && selected.status !== 'cancelled' ? (
                                <div className="border-t border-white/10 p-3 flex gap-2">
                                    <textarea
                                        ref={inputRef}
                                        value={newMessage}
                                        onChange={e => setNewMessage(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        placeholder="Répondre au patient... (Entrée pour envoyer)"
                                        rows={1}
                                        className="flex-1 bg-white/5 border border-white/10 text-white px-3 py-2 text-sm font-sans focus:outline-none focus:border-white/30 resize-none"
                                    />
                                    <button
                                        onClick={sendMessage}
                                        disabled={!newMessage.trim() || sending}
                                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 transition-all disabled:opacity-50 flex items-center"
                                    >
                                        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                    </button>
                                </div>
                            ) : (
                                <div className="border-t border-white/10 p-3 text-center text-xs text-gray-500 font-sans">
                                    Rendez-vous clôturé — chat désactivé
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="hidden lg:flex flex-1 items-center justify-center">
                    <div className="text-center">
                        <CalendarCheck className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                        <p className="text-gray-500 font-sans">Sélectionnez une demande pour voir les détails</p>
                    </div>
                </div>
            )}

            {/* Modal confirmation créneau */}
            <AnimatePresence>
                {confirmSlot && selected && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
                        onClick={() => setConfirmSlot(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            onClick={e => e.stopPropagation()}
                            className="bg-[#0f0f0f] border border-white/20 p-6 max-w-sm w-full"
                        >
                            <div className="flex items-center gap-2 mb-4">
                                <CalendarCheck className="w-5 h-5 text-emerald-400" />
                                <h3 className="font-display font-bold text-lg uppercase">Confirmer le créneau</h3>
                            </div>
                            <div className="border border-white/10 bg-white/5 p-3 mb-4">
                                <p className="text-xs text-gray-400 font-display uppercase mb-1">Journée</p>
                                <p className="text-sm text-white font-sans font-bold">
                                    {new Date(confirmSlot.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                    Dispo patient : {confirmSlot.slotFrom} – {confirmSlot.slotTo === '00:00' ? 'minuit' : confirmSlot.slotTo}
                                </p>
                            </div>
                            <div className="space-y-3 mb-4">
                                <div>
                                    <label className="text-xs text-gray-400 font-display uppercase block mb-1">Début du RDV</label>
                                    <select
                                        value={confirmSlot.selectedStart}
                                        onChange={e => {
                                            const newStart = e.target.value
                                            const startMins = (() => { const [h, m] = newStart.split(':').map(Number); return h * 60 + m })()
                                            const endMins = (() => { const [h, m] = confirmSlot.selectedEnd.split(':').map(Number); return h * 60 + m })()
                                            const newEnd = endMins <= startMins
                                                ? minsToTime(Math.min(startMins + 15, timeToMins(confirmSlot.slotTo) - 1))
                                                : confirmSlot.selectedEnd
                                            setConfirmSlot(prev => prev ? { ...prev, selectedStart: newStart, selectedEnd: newEnd } : prev)
                                        }}
                                        className="w-full bg-white/5 border border-white/20 text-white px-3 py-2 text-sm font-mono focus:outline-none focus:border-emerald-500/50"
                                    >
                                        {generateTimeOptions(confirmSlot.slotFrom === '00:00' ? '00:01' : confirmSlot.slotFrom, confirmSlot.slotTo).map(t => (
                                            <option key={t} value={t} className="bg-[#0f0f0f]">{t}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-400 font-display uppercase block mb-1">Fin du RDV</label>
                                    <select
                                        value={confirmSlot.selectedEnd}
                                        onChange={e => setConfirmSlot(prev => prev ? { ...prev, selectedEnd: e.target.value } : prev)}
                                        className="w-full bg-white/5 border border-white/20 text-white px-3 py-2 text-sm font-mono focus:outline-none focus:border-emerald-500/50"
                                    >
                                        {generateTimeOptions(addMins(confirmSlot.selectedStart, 15), confirmSlot.slotTo).map(t => (
                                            <option key={t} value={t} className="bg-[#0f0f0f]">{t}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <p className="text-xs text-gray-500 font-sans mb-4">
                                Patient : <span className="text-white">{patientDisplayName(selected)}</span>
                                <br />Le patient recevra une notification Discord.
                            </p>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setConfirmSlot(null)}
                                    className="flex-1 py-2 border border-white/20 text-gray-400 hover:text-white text-sm font-display uppercase transition-all"
                                >
                                    Annuler
                                </button>
                                <button
                                    onClick={confirmSchedule}
                                    disabled={actionLoading}
                                    className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-display font-bold uppercase transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                                    Confirmer
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Modal annulation */}
            <AnimatePresence>
                {cancelModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
                        onClick={() => setCancelModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            onClick={e => e.stopPropagation()}
                            className="bg-[#0f0f0f] border border-white/20 p-6 max-w-sm w-full"
                        >
                            <div className="flex items-center gap-2 mb-4">
                                <XCircle className="w-5 h-5 text-red-400" />
                                <h3 className="font-display font-bold text-lg uppercase">Annuler le RDV</h3>
                                <button onClick={() => setCancelModal(false)} className="ml-auto text-gray-500 hover:text-white">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="mb-4">
                                <label className="text-xs text-gray-400 font-display uppercase block mb-2">Raison (optionnel)</label>
                                <textarea
                                    value={cancelReason}
                                    onChange={e => setCancelReason(e.target.value)}
                                    rows={3}
                                    className="w-full bg-white/5 border border-white/10 text-white px-3 py-2 text-sm font-sans focus:outline-none focus:border-white/30 resize-none"
                                    placeholder="Raison de l'annulation..."
                                />
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setCancelModal(false)} className="flex-1 py-2 border border-white/20 text-gray-400 hover:text-white text-sm font-display uppercase transition-all">
                                    Retour
                                </button>
                                <button
                                    onClick={handleCancel}
                                    disabled={actionLoading}
                                    className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-display font-bold uppercase transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                                    Annuler le RDV
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

function ArrowLeftIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
    )
}
