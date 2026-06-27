"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Clock, Calendar, CheckCircle, XCircle, User, MessageSquare,
    Send, Loader2, AlertCircle, ChevronRight, X, CalendarCheck,
    RefreshCw
} from "lucide-react";
import { useSession } from "next-auth/react";
import { createClient } from "@/lib/supabase/client";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AvailabilitySlot {
    date: string
    hours: number[]
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

// ─── Constantes ───────────────────────────────────────────────────────────────

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

function formatDate(iso: string) {
    return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })
}

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
    const hour = d.getHours()
    const end = hour + 1
    return `${date} · ${hour}h00–${end}h00`
}

// ─── Sous-composants ──────────────────────────────────────────────────────────

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
    onSelect?: (date: string, hour: number) => void
    disabled?: boolean
}) {
    if (!slots || slots.length === 0) {
        return <p className="text-xs text-gray-500 italic">Aucune disponibilité renseignée</p>
    }

    return (
        <div className="space-y-2">
            {slots.sort((a, b) => a.date.localeCompare(b.date)).map(slot => (
                <div key={slot.date}>
                    <p className="text-xs text-gray-400 font-display font-bold uppercase mb-1">
                        {formatDayLabel(slot.date)}
                    </p>
                    <div className="flex flex-wrap gap-1">
                        {slot.hours.sort((a, b) => a - b).map(hour => (
                            <button
                                key={hour}
                                type="button"
                                disabled={disabled}
                                onClick={() => onSelect?.(slot.date, hour)}
                                className={`px-2.5 py-1 text-xs font-mono border transition-all ${
                                    disabled
                                        ? 'border-white/10 text-gray-500 cursor-default'
                                        : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/30 hover:border-emerald-500/60 cursor-pointer'
                                }`}
                            >
                                {hour}h
                            </button>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    )
}

// ─── Page principale ──────────────────────────────────────────────────────────

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
    const [confirmSlot, setConfirmSlot] = useState<{ date: string; hour: number } | null>(null)
    const [cancelModal, setCancelModal] = useState(false)
    const [cancelReason, setCancelReason] = useState("")
    const [actionLoading, setActionLoading] = useState(false)
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)

    const selected = appointments.find(a => a.id === selectedId) || null

    // Toast auto-dismiss
    useEffect(() => {
        if (!toast) return
        const t = setTimeout(() => setToast(null), 3000)
        return () => clearTimeout(t)
    }, [toast])

    // Scroll bas sur nouveaux messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    // Chargement
    const fetchAppointments = async (silent = false) => {
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
    }

    useEffect(() => {
        fetchAppointments()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filter])

    // Charger messages du RDV sélectionné
    useEffect(() => {
        if (!selectedId) { setMessages([]); return }

        async function fetchMessages() {
            const res = await fetch(`/api/appointments/${selectedId}`)
            if (res.ok) {
                const data = await res.json()
                setMessages(data.messages || [])
            }
        }
        fetchMessages()
    }, [selectedId])

    // Supabase Realtime pour le RDV sélectionné
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

    // ─── Actions ─────────────────────────────────────────────────────────────

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
                setToast({ msg: 'Erreur lors de l\'envoi', type: 'error' })
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

        // Construire la date ISO à partir du créneau choisi
        const scheduledDate = new Date(`${confirmSlot.date}T${String(confirmSlot.hour).padStart(2, '0')}:00:00`)

        try {
            const res = await fetch(`/api/appointments/${selectedId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: 'scheduled',
                    scheduled_date: scheduledDate.toISOString()
                })
            })

            if (res.ok) {
                setToast({ msg: 'Rendez-vous confirmé ! Le patient a été notifié.', type: 'success' })
                setConfirmSlot(null)
                await fetchAppointments(true)
                // Mettre à jour le RDV sélectionné
                const appts = await fetch('/api/appointments').then(r => r.json())
                setAppointments(appts.appointments || [])
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

    // ─── Render ───────────────────────────────────────────────────────────────

    const filteredAppointments = appointments

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
                {/* Header */}
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

                    {/* Filtres */}
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

                {/* Liste */}
                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
                        </div>
                    ) : filteredAppointments.length === 0 ? (
                        <div className="text-center py-12">
                            <Calendar className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                            <p className="text-gray-500 font-sans text-sm">Aucune demande</p>
                        </div>
                    ) : (
                        filteredAppointments.map(appt => (
                            <button
                                key={appt.id}
                                onClick={() => setSelectedId(appt.id)}
                                className={`w-full text-left p-3 border-b border-white/5 hover:bg-white/5 transition-all flex items-start gap-3 ${
                                    selectedId === appt.id ? 'bg-white/10 border-l-2 border-l-emerald-500' : ''
                                }`}
                            >
                                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <User className="w-4 h-4 text-gray-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <span className="font-display font-bold text-sm text-white truncate">
                                            {appt.patient
                                                ? `${appt.patient.first_name} ${appt.patient.last_name}`
                                                : appt.discord_username || 'Patient'
                                            }
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
                        ))
                    )}
                </div>
            </div>

            {/* Panneau droit — détail */}
            {selectedId && selected ? (
                <div className="flex-1 flex flex-col min-w-0">
                    {/* Header détail */}
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
                                    {selected.patient
                                        ? `${selected.patient.first_name} ${selected.patient.last_name}`
                                        : selected.discord_username || 'Patient inconnu'
                                    }
                                </h2>
                                <StatusBadge status={selected.status} />
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5">{selected.reason_category}{selected.reason ? ` — ${selected.reason}` : ''}</p>
                            {selected.patient?.phone && (
                                <p className="text-xs text-gray-500 mt-0.5">📞 {selected.patient.phone}</p>
                            )}
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto flex flex-col lg:flex-row min-h-0">

                        {/* Colonne gauche : infos + actions */}
                        <div className="w-full lg:w-64 xl:w-72 flex-shrink-0 border-b lg:border-b-0 lg:border-r border-white/10 p-4 space-y-4 overflow-y-auto">

                            {/* Date confirmée */}
                            {selected.status === 'scheduled' && selected.scheduled_date && (
                                <div className="border border-blue-500/30 bg-blue-500/10 p-3">
                                    <p className="text-xs text-blue-400 font-display font-bold uppercase mb-1 flex items-center gap-1">
                                        <Calendar className="w-3.5 h-3.5" /> Date confirmée
                                    </p>
                                    <p className="text-sm text-white font-sans">{formatScheduledDate(selected.scheduled_date)}</p>
                                    {selected.assigned_to_name && (
                                        <p className="text-xs text-gray-400 mt-1">Par {selected.assigned_to_name}</p>
                                    )}
                                </div>
                            )}

                            {/* Disponibilités */}
                            {selected.status === 'pending' && (
                                <div>
                                    <p className="text-xs text-gray-400 font-display font-bold uppercase mb-2">
                                        Disponibilités patient
                                    </p>
                                    <AvailabilityGrid
                                        slots={selected.availability_slots || []}
                                        onSelect={(date, hour) => setConfirmSlot({ date, hour })}
                                    />
                                    <p className="text-xs text-gray-600 mt-2">Cliquez sur un créneau pour le confirmer</p>
                                </div>
                            )}

                            {selected.status === 'scheduled' && (
                                <div>
                                    <p className="text-xs text-gray-400 font-display font-bold uppercase mb-2">
                                        Disponibilités initiales
                                    </p>
                                    <AvailabilityGrid
                                        slots={selected.availability_slots || []}
                                        onSelect={(date, hour) => setConfirmSlot({ date, hour })}
                                    />
                                    <p className="text-xs text-gray-600 mt-2">Cliquez pour modifier le créneau</p>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="space-y-2 pt-2">
                                {selected.status === 'scheduled' && (
                                    <button
                                        onClick={handleComplete}
                                        disabled={actionLoading}
                                        className="w-full flex items-center justify-center gap-2 py-2 px-3 border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 text-xs font-display font-bold uppercase tracking-wide transition-all disabled:opacity-50"
                                    >
                                        <CheckCircle className="w-3.5 h-3.5" /> Marquer terminé
                                    </button>
                                )}

                                {(selected.status === 'pending' || selected.status === 'scheduled') && (
                                    <button
                                        onClick={() => setCancelModal(true)}
                                        disabled={actionLoading}
                                        className="w-full flex items-center justify-center gap-2 py-2 px-3 border border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20 text-xs font-display font-bold uppercase tracking-wide transition-all disabled:opacity-50"
                                    >
                                        <XCircle className="w-3.5 h-3.5" /> Annuler le RDV
                                    </button>
                                )}

                                {(selected.status === 'cancelled') && (
                                    <button
                                        onClick={reopenToPending}
                                        disabled={actionLoading}
                                        className="w-full flex items-center justify-center gap-2 py-2 px-3 border border-yellow-500/40 bg-yellow-500/10 text-yellow-300 hover:bg-yellow-500/20 text-xs font-display font-bold uppercase tracking-wide transition-all disabled:opacity-50"
                                    >
                                        <RefreshCw className="w-3.5 h-3.5" /> Remettre en attente
                                    </button>
                                )}
                            </div>

                            {/* Infos */}
                            <div className="text-xs text-gray-600 font-mono space-y-1 pt-2 border-t border-white/10">
                                <p>Créé le {formatShortDate(selected.created_at)}</p>
                                <p className="truncate">Discord: {selected.discord_username}</p>
                            </div>
                        </div>

                        {/* Colonne droite : chat */}
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

                            <div className="border border-emerald-500/30 bg-emerald-500/10 p-4 mb-4">
                                <p className="text-sm text-white font-sans">
                                    <span className="font-bold">
                                        {new Date(confirmSlot.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                                    </span>
                                    <br />
                                    <span className="text-emerald-300">{confirmSlot.hour}h00 — {confirmSlot.hour + 1}h00</span>
                                </p>
                                <p className="text-xs text-gray-400 mt-2">
                                    Patient : {selected.patient ? `${selected.patient.first_name} ${selected.patient.last_name}` : selected.discord_username}
                                </p>
                            </div>

                            <p className="text-xs text-gray-400 font-sans mb-4">
                                Le patient recevra une notification Discord avec la date et l'heure confirmées.
                                Un événement sera créé dans le planning.
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

// Icône inline pour éviter un import supplémentaire
function ArrowLeftIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
    )
}
