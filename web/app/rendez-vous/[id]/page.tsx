"use client";

import { motion } from "framer-motion";
import {
    ArrowLeft, Loader2, AlertCircle, CheckCircle, Clock,
    Calendar, MessageSquare, Send, XCircle, User
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { useSession, signIn } from "next-auth/react";
import { createClient } from "@/lib/supabase/client";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
    id: string
    appointment_id: string
    sender_discord_id: string
    sender_name: string
    content: string
    is_from_staff: boolean
    created_at: string
}

interface Appointment {
    id: string
    status: 'pending' | 'scheduled' | 'completed' | 'cancelled'
    reason_category: string
    reason: string | null
    scheduled_date: string | null
    assigned_to_name: string | null
    cancel_reason: string | null
    created_at: string
    discord_username: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
    pending: { label: 'En attente', color: 'text-yellow-400', bg: 'bg-yellow-500/20', border: 'border-yellow-500/30', icon: Clock },
    scheduled: { label: 'Programmé', color: 'text-blue-400', bg: 'bg-blue-500/20', border: 'border-blue-500/30', icon: Calendar },
    completed: { label: 'Terminé', color: 'text-emerald-400', bg: 'bg-emerald-500/20', border: 'border-emerald-500/30', icon: CheckCircle },
    cancelled: { label: 'Annulé', color: 'text-red-400', bg: 'bg-red-500/20', border: 'border-red-500/30', icon: XCircle },
}

function formatDate(iso: string) {
    return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SuiviRdvPage() {
    const params = useParams<{ id: string }>()
    const id = params.id
    const { data: session, status: authStatus } = useSession()

    const [appointment, setAppointment] = useState<Appointment | null>(null)
    const [messages, setMessages] = useState<Message[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [newMessage, setNewMessage] = useState("")
    const [sending, setSending] = useState(false)

    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)

    // Scroll au dernier message
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    // Chargement initial
    useEffect(() => {
        if (authStatus !== 'authenticated') return

        async function fetchData() {
            try {
                const res = await fetch(`/api/appointments/${id}`)
                if (!res.ok) {
                    const data = await res.json()
                    setError(data.error || 'Rendez-vous introuvable')
                    return
                }
                const data = await res.json()
                setAppointment(data.appointment)
                setMessages(data.messages || [])
            } catch {
                setError('Erreur lors du chargement')
            } finally {
                setLoading(false)
            }
        }

        fetchData()
    }, [id, authStatus])

    // Supabase Realtime — écoute les nouveaux messages
    useEffect(() => {
        if (!id || authStatus !== 'authenticated') return

        const supabase = createClient()
        const channel = supabase
            .channel(`rdv_messages_${id}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'appointment_messages',
                    filter: `appointment_id=eq.${id}`
                },
                (payload) => {
                    const newMsg = payload.new as Message
                    setMessages(prev => {
                        // Éviter les doublons (le sender voit déjà son message via l'API)
                        if (prev.find(m => m.id === newMsg.id)) return prev
                        return [...prev, newMsg]
                    })
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [id, authStatus])

    const handleSend = async () => {
        if (!newMessage.trim() || sending) return
        setSending(true)

        const content = newMessage.trim()
        setNewMessage("")

        // Optimistic update
        const optimisticMsg: Message = {
            id: `temp_${Date.now()}`,
            appointment_id: id,
            sender_discord_id: session?.user?.discord_id || '',
            sender_name: session?.user?.discord_username || session?.user?.name || 'Moi',
            content,
            is_from_staff: false,
            created_at: new Date().toISOString()
        }
        setMessages(prev => [...prev, optimisticMsg])

        try {
            const res = await fetch(`/api/appointments/${id}/patient-message`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content })
            })

            if (!res.ok) {
                // Annuler l'optimistic update
                setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id))
                const data = await res.json()
                setError(data.error || 'Erreur lors de l\'envoi')
            }
        } catch {
            setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id))
            setError('Erreur réseau')
        } finally {
            setSending(false)
            inputRef.current?.focus()
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    // ─── Auth gate ────────────────────────────────────────────────────────────

    if (authStatus === 'loading') {
        return (
            <main className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-white" />
            </main>
        )
    }

    if (authStatus === 'unauthenticated') {
        return (
            <>
                <div className="scan-overlay" />
                <div className="siren-bar"><div className="siren-blue" /><div className="siren-red" /></div>
                <main className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="max-w-md w-full text-center p-8 border border-white/10 bg-white/[0.02]"
                    >
                        <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                        <h2 className="font-display text-2xl font-bold mb-2 uppercase">Connexion requise</h2>
                        <p className="font-sans text-gray-400 mb-6">Connectez-vous avec Discord pour accéder à votre rendez-vous.</p>
                        <button
                            onClick={() => signIn("discord", { callbackUrl: `/rendez-vous/${id}` })}
                            className="w-full flex items-center justify-center gap-3 bg-[#5865F2] hover:bg-[#4752C4] text-white py-4 px-6 font-display font-bold tracking-widest uppercase transition-all"
                        >
                            Se connecter avec Discord
                        </button>
                    </motion.div>
                </main>
            </>
        )
    }

    // ─── Loading / Error ──────────────────────────────────────────────────────

    if (loading) {
        return (
            <main className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-white" />
            </main>
        )
    }

    if (error || !appointment) {
        return (
            <>
                <div className="scan-overlay" />
                <div className="siren-bar"><div className="siren-blue" /><div className="siren-red" /></div>
                <main className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-4">
                    <div className="max-w-md w-full text-center p-8 border border-white/10 bg-white/[0.02]">
                        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                        <h2 className="font-display text-2xl font-bold mb-2 uppercase">Erreur</h2>
                        <p className="text-gray-400 font-sans mb-6">{error || 'Rendez-vous introuvable'}</p>
                        <Link href="/" className="text-gray-400 hover:text-white font-display text-sm uppercase tracking-widest flex items-center justify-center gap-2">
                            <ArrowLeft className="w-4 h-4" /> Retour
                        </Link>
                    </div>
                </main>
            </>
        )
    }

    const statusCfg = STATUS_CONFIG[appointment.status]
    const StatusIcon = statusCfg.icon
    const isClosed = appointment.status === 'completed' || appointment.status === 'cancelled'
    const myDiscordId = session?.user?.discord_id

    return (
        <>
            <div className="scan-overlay" />
            <div className="siren-bar"><div className="siren-blue" /><div className="siren-red" /></div>

            <nav className="fixed w-full z-40 py-4 px-8 border-b border-white/10 backdrop-blur-sm bg-black/50">
                <div className="max-w-5xl mx-auto flex justify-between items-center">
                    <Link href="/" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                        <span className="font-sans text-sm">Accueil</span>
                    </Link>
                    <span className="text-emerald-400 font-display font-bold tracking-widest text-sm">
                        MON RENDEZ-VOUS
                    </span>
                    <span className="text-xs text-gray-500 font-mono hidden sm:block">
                        {id.slice(0, 8).toUpperCase()}
                    </span>
                </div>
            </nav>

            <main className="min-h-screen bg-[#0a0a0a] text-white pt-24 pb-6 px-4">
                <div className="max-w-5xl mx-auto h-[calc(100vh-7rem)] flex flex-col gap-4">

                    {/* Statut */}
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`border ${statusCfg.border} ${statusCfg.bg} p-4 flex flex-col sm:flex-row sm:items-center gap-3`}
                    >
                        <div className="flex items-center gap-3 flex-1">
                            <StatusIcon className={`w-5 h-5 ${statusCfg.color}`} />
                            <div>
                                <p className={`font-display font-bold uppercase text-sm ${statusCfg.color}`}>
                                    {statusCfg.label}
                                </p>
                                <p className="text-xs text-gray-400 font-sans">{appointment.reason_category}</p>
                            </div>
                        </div>

                        {appointment.status === 'scheduled' && appointment.scheduled_date && (
                            <div className="flex items-center gap-2 text-sm">
                                <Calendar className="w-4 h-4 text-blue-400" />
                                <span className="text-blue-300 font-display font-bold">
                                    {formatDate(appointment.scheduled_date)}
                                </span>
                                {appointment.assigned_to_name && (
                                    <span className="text-gray-500 text-xs">· {appointment.assigned_to_name}</span>
                                )}
                            </div>
                        )}

                        {appointment.status === 'cancelled' && appointment.cancel_reason && (
                            <p className="text-xs text-red-300">Raison : {appointment.cancel_reason}</p>
                        )}

                        {appointment.status === 'pending' && (
                            <p className="text-xs text-gray-400 font-sans">
                                Un médecin prendra en charge votre demande prochainement.
                            </p>
                        )}
                    </motion.div>

                    {/* Zone chat */}
                    <div className="flex-1 flex flex-col border border-white/10 bg-white/[0.02] min-h-0">
                        {/* Header */}
                        <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
                            <MessageSquare className="w-4 h-4 text-emerald-400" />
                            <span className="font-display font-bold text-sm uppercase tracking-widest">
                                Discussion
                            </span>
                            <span className="ml-auto text-xs text-gray-500 font-sans">
                                Les médecins voient également ce chat
                            </span>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {messages.length === 0 && (
                                <div className="flex flex-col items-center justify-center h-full text-center py-8">
                                    <MessageSquare className="w-8 h-8 text-gray-600 mb-3" />
                                    <p className="text-gray-500 font-sans text-sm">
                                        Pas encore de message. Vous pouvez contacter l'équipe médicale ici.
                                    </p>
                                </div>
                            )}

                            {messages.map(msg => {
                                const isMe = msg.sender_discord_id === myDiscordId && !msg.is_from_staff
                                const isStaff = msg.is_from_staff

                                return (
                                    <div
                                        key={msg.id}
                                        className={`flex gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}
                                    >
                                        {!isMe && (
                                            <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${isStaff ? 'bg-emerald-500/20' : 'bg-white/10'}`}>
                                                <User className={`w-4 h-4 ${isStaff ? 'text-emerald-400' : 'text-gray-400'}`} />
                                            </div>
                                        )}

                                        <div className={`max-w-[70%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                                            {!isMe && (
                                                <span className={`text-xs font-display font-bold ${isStaff ? 'text-emerald-400' : 'text-gray-400'}`}>
                                                    {msg.sender_name}
                                                </span>
                                            )}
                                            <div className={`px-3 py-2 text-sm font-sans break-words ${
                                                isMe
                                                    ? 'bg-emerald-600/30 border border-emerald-500/30 text-white'
                                                    : isStaff
                                                        ? 'bg-white/10 border border-white/10 text-white'
                                                        : 'bg-white/5 border border-white/5 text-gray-300'
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

                        {/* Input */}
                        {!isClosed ? (
                            <div className="border-t border-white/10 p-3 flex gap-2">
                                <textarea
                                    ref={inputRef}
                                    value={newMessage}
                                    onChange={e => setNewMessage(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Écrivez un message... (Entrée pour envoyer)"
                                    rows={1}
                                    className="flex-1 bg-white/5 border border-white/10 text-white px-3 py-2 text-sm font-sans focus:outline-none focus:border-white/30 resize-none"
                                />
                                <button
                                    onClick={handleSend}
                                    disabled={!newMessage.trim() || sending}
                                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                >
                                    {sending ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Send className="w-4 h-4" />
                                    )}
                                </button>
                            </div>
                        ) : (
                            <div className="border-t border-white/10 p-3 text-center text-xs text-gray-500 font-sans">
                                Ce rendez-vous est clôturé — le chat est désactivé.
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </>
    )
}
