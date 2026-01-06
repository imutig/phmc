"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
    HeartPulse, Users, DollarSign, FileText, TrendingUp, Shield,
    Calendar, MapPin, Clock, Play, Square, ChevronRight, Activity, Timer, Wallet,
    BookOpen, ClipboardList, Stethoscope, Loader2, X
} from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { getCurrentISOWeekAndYear } from "@/lib/date-utils"
import { useToast } from "@/contexts/ToastContext"

import { MiniLoader } from "@/components/ui/BouncingLoader"
import { createClient } from "@/lib/supabase/client"
import { RealtimePostgresChangesPayload } from "@supabase/supabase-js"

// Types
interface UserProfile {
    discordId: string
    displayName: string
    avatarUrl?: string
    gradeName: string
    roles: string[]
}

interface LiveService {
    id: string
    user_discord_id: string
    user_name: string
    user_avatar_url?: string
    grade_name: string
    start_time: string
}

interface WeekStats {
    totalMinutes: number
    totalSalary: number
    serviceCount: number
}

// Composant Widget Collègues en Service
function ColleaguesWidget() {
    const [colleagues, setColleagues] = useState<LiveService[]>([])
    const [loading, setLoading] = useState(true)

    // Chargement initial + Realtime
    useEffect(() => {
        fetchColleagues()

        const supabase = createClient()
        const channel = supabase
            .channel('home-colleagues')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'services'
                },
                (payload: RealtimePostgresChangesPayload<any>) => {
                    const { eventType, new: newRecord, old: oldRecord } = payload

                    if (eventType === 'INSERT') {
                        // Si nouveau service en cours, ajouter
                        if (newRecord && !newRecord.end_time) {
                            setColleagues(prev => {
                                if (prev.some(s => s.id === newRecord.id)) return prev
                                return [...prev, newRecord]
                            })
                        }
                    } else if (eventType === 'UPDATE') {
                        if (newRecord) {
                            if (newRecord.end_time) {
                                // Service terminé -> retirer
                                setColleagues(prev => prev.filter(s => s.id !== newRecord.id))
                            } else {
                                // Mise à jour (ex: changement grade)
                                setColleagues(prev => prev.map(s => s.id === newRecord.id ? newRecord : s))
                            }
                        }
                    } else if (eventType === 'DELETE') {
                        if (oldRecord) {
                            setColleagues(prev => prev.filter(s => s.id !== oldRecord.id))
                        }
                    }
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [])

    async function fetchColleagues() {
        try {
            const res = await fetch('/api/intranet/services/admin?live=true')
            if (res.ok) {
                const data = await res.json()
                setColleagues(data.services || [])
            }
        } catch (e) { }
        setLoading(false)
    }

    const formatDuration = (startTime: string) => {
        const start = new Date(startTime).getTime()
        const now = Date.now()
        const diffMs = now - start
        const hours = Math.floor(diffMs / (1000 * 60 * 60))
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
        return hours > 0 ? `${hours}h${minutes.toString().padStart(2, '0')}` : `${minutes}min`
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="p-6 rounded-lg bg-[#141414] border border-[#2a2a2a]"
        >
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center w-2 h-2">
                        {colleagues.length > 0 && <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />}
                    </div>
                    <h3 className="font-display font-bold text-lg text-white">Collègues en service</h3>
                </div>
                <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
                    {loading ? '...' : colleagues.length} actif{colleagues.length !== 1 ? 's' : ''}
                </span>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-8">
                    <MiniLoader />
                </div>
            ) : colleagues.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Personne en service actuellement</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {colleagues.slice(0, 5).map((colleague) => (
                        <div
                            key={colleague.id}
                            className="flex items-center gap-3 p-2 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a]"
                        >
                            {colleague.user_avatar_url ? (
                                <img
                                    src={colleague.user_avatar_url}
                                    alt=""
                                    className="w-8 h-8 rounded-full"
                                />
                            ) : (
                                <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                                    <Users className="w-4 h-4 text-gray-500" />
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white truncate">{colleague.user_name}</p>
                                <p className="text-xs text-gray-500">{colleague.grade_name}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-green-400 font-mono">{formatDuration(colleague.start_time)}</p>
                            </div>
                        </div>
                    ))}
                    {colleagues.length > 5 && (
                        <p className="text-xs text-gray-500 text-center">
                            +{colleagues.length - 5} autres en service
                        </p>
                    )}
                </div>
            )}
        </motion.div>
    )
}

// Composant Stats Rapides Utilisateur
function UserStatsWidget({ userDiscordId }: { userDiscordId: string }) {
    const [stats, setStats] = useState<WeekStats | null>(null)
    const [liveService, setLiveService] = useState<LiveService | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchStats()

        const supabase = createClient()
        const channel = supabase
            .channel('home-user-stats')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'services',
                    filter: `user_discord_id=eq.${userDiscordId}`
                },
                (payload: RealtimePostgresChangesPayload<any>) => {
                    const { eventType, new: newRecord, old: oldRecord } = payload

                    if (eventType === 'INSERT') {
                        if (newRecord && !newRecord.end_time) {
                            setLiveService(newRecord)
                        }
                    } else if (eventType === 'UPDATE') {
                        if (newRecord) {
                            if (newRecord.end_time) {
                                setLiveService(null)
                                // Optionnel: rafraîchir les stats complètes
                                // fetchStats() 
                            } else {
                                setLiveService(newRecord)
                            }
                        }
                    } else if (eventType === 'DELETE') {
                        setLiveService(null)
                    }
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [userDiscordId])

    async function fetchStats() {
        try {
            const { week, year } = getCurrentISOWeekAndYear()
            const [servicesRes, liveRes] = await Promise.all([
                fetch(`/api/intranet/services?week=${week}&year=${year}`),
                fetch('/api/intranet/services/live')
            ])

            if (servicesRes.ok) {
                const data = await servicesRes.json()
                const services = data.services || []
                const completedServices = services.filter((s: any) => s.end_time)
                setStats({
                    totalMinutes: completedServices.reduce((acc: number, s: any) => acc + (s.duration_minutes || 0), 0),
                    totalSalary: completedServices.reduce((acc: number, s: any) => acc + (s.salary_earned || 0), 0),
                    serviceCount: completedServices.length
                })
            }

            if (liveRes.ok) {
                const liveData = await liveRes.json()
                setLiveService(liveData.service || null)
            }
        } catch (e) { }
        setLoading(false)
    }

    const formatTime = (minutes: number) => {
        const h = Math.floor(minutes / 60)
        const m = minutes % 60
        return h > 0 ? `${h}h${m > 0 ? m.toString().padStart(2, '0') : ''}` : `${m}min`
    }

    const formatMoney = (amount: number) => {
        return new Intl.NumberFormat('fr-FR').format(amount) + ' $'
    }

    if (loading) {
        return (
            <div className="grid grid-cols-3 gap-4">
                {[1, 2, 3].map(i => (
                    <div key={i} className="p-4 rounded-lg bg-[#141414] border border-[#2a2a2a] animate-pulse">
                        <div className="h-8 bg-gray-800 rounded mb-2" />
                        <div className="h-4 bg-gray-800 rounded w-2/3" />
                    </div>
                ))}
            </div>
        )
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" data-onboarding="user-stats">
            {/* Status Service */}
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`p-4 rounded-lg border ${liveService
                    ? 'bg-green-500/10 border-green-500/30'
                    : 'bg-[#141414] border-[#2a2a2a]'
                    }`}
            >
                <div className="flex items-center gap-2 mb-2">
                    {liveService ? (
                        <>
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            <span className="text-xs text-green-400 uppercase font-bold">En service</span>
                        </>
                    ) : (
                        <>
                            <Square className="w-4 h-4 text-gray-500" />
                            <span className="text-xs text-gray-500 uppercase">Hors service</span>
                        </>
                    )}
                </div>
                {liveService ? (
                    <LiveTimer startTime={liveService.start_time} />
                ) : (
                    <p className="text-2xl font-display font-bold text-gray-400">--:--</p>
                )}
            </motion.div>

            {/* Heures cette semaine */}
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 }}
                className="p-4 rounded-lg bg-[#141414] border border-[#2a2a2a]"
            >
                <div className="flex items-center gap-2 mb-2">
                    <Timer className="w-4 h-4 text-blue-400" />
                    <span className="text-xs text-gray-500 uppercase">Cette semaine</span>
                </div>
                <p className="text-2xl font-display font-bold text-white">
                    {stats ? formatTime(stats.totalMinutes) : '0h'}
                </p>
                <p className="text-xs text-gray-500">{stats?.serviceCount || 0} services</p>
            </motion.div>

            {/* Gains cette semaine */}
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                className="p-4 rounded-lg bg-[#141414] border border-[#2a2a2a]"
            >
                <div className="flex items-center gap-2 mb-2">
                    <Wallet className="w-4 h-4 text-green-400" />
                    <span className="text-xs text-gray-500 uppercase">Gains semaine</span>
                </div>
                <p className="text-2xl font-display font-bold text-green-400">
                    {stats ? formatMoney(stats.totalSalary) : '0 $'}
                </p>
            </motion.div>
        </div>
    )
}

// Timer en direct
function LiveTimer({ startTime }: { startTime: string }) {
    const [elapsed, setElapsed] = useState('')

    useEffect(() => {
        const update = () => {
            const start = new Date(startTime).getTime()
            const now = Date.now()
            const diffMs = now - start
            const hours = Math.floor(diffMs / (1000 * 60 * 60))
            const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
            const seconds = Math.floor((diffMs % (1000 * 60)) / 1000)
            setElapsed(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`)
        }
        update()
        const interval = setInterval(update, 1000)
        return () => clearInterval(interval)
    }, [startTime])

    return <p className="text-2xl font-display font-bold text-green-400 font-mono">{elapsed}</p>
}

// Composant Countdown pour le prochain événement
function NextEventWidget() {
    const [event, setEvent] = useState<any>(null)
    const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 })
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetchNextEvent() {
            try {
                const res = await fetch('/api/intranet/events?upcoming=true&limit=1')
                if (res.ok) {
                    const data = await res.json()
                    if (data.events?.length > 0) {
                        setEvent(data.events[0])
                    }
                }
            } catch (e) { }
            setLoading(false)
        }
        fetchNextEvent()
    }, [])

    useEffect(() => {
        if (!event) return
        const updateCountdown = () => {
            const now = new Date().getTime()
            const eventTime = new Date(event.event_date).getTime()
            const diff = eventTime - now

            if (diff <= 0) {
                setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 })
                return
            }

            setCountdown({
                days: Math.floor(diff / (1000 * 60 * 60 * 24)),
                hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
                minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
                seconds: Math.floor((diff % (1000 * 60)) / 1000)
            })
        }
        updateCountdown()
        const interval = setInterval(updateCountdown, 1000)
        return () => clearInterval(interval)
    }, [event])

    if (loading || !event) return null

    const eventDate = new Date(event.event_date)

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="p-6 rounded-lg border overflow-hidden relative"
            style={{
                backgroundColor: '#141414',
                borderColor: event.color + '40'
            }}
        >
            <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: event.color }} />

            <div className="flex flex-col md:flex-row items-start justify-between gap-4">
                <div className="pl-4">
                    <div className="text-xs text-gray-500 uppercase tracking-widest mb-1">Prochain événement</div>
                    <h3 className="font-display text-lg md:text-xl font-bold text-white mb-2">{event.title}</h3>
                    <div className="flex flex-wrap items-center gap-2 md:gap-4 text-sm text-gray-400">
                        <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" style={{ color: event.color }} />
                            {eventDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </span>
                        <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" style={{ color: event.color }} />
                            {eventDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {event.location && (
                            <span className="flex items-center gap-1">
                                <MapPin className="w-4 h-4" style={{ color: event.color }} />
                                {event.location}
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2 md:gap-3 mt-4 md:mt-0">
                    {[
                        { value: countdown.days, label: 'j' },
                        { value: countdown.hours, label: 'h' },
                        { value: countdown.minutes, label: 'm' },
                        { value: countdown.seconds, label: 's' },
                    ].map((unit, i) => (
                        <div key={i} className="text-center">
                            <div
                                className="w-10 h-10 md:w-12 md:h-12 rounded-lg flex items-center justify-center font-display text-lg md:text-xl font-bold"
                                style={{ backgroundColor: event.color + '20', color: event.color }}
                            >
                                {unit.value.toString().padStart(2, '0')}
                            </div>
                            <div className="text-[10px] text-gray-500 mt-1">{unit.label}</div>
                        </div>
                    ))}
                </div>
            </div>
        </motion.div>
    )
}

// Widget Événements du jour
function TodayEventsWidget() {
    const [events, setEvents] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetchTodayEvents() {
            try {
                const res = await fetch('/api/intranet/events?today=true')
                if (res.ok) {
                    const data = await res.json()
                    setEvents(data.events || [])
                }
            } catch (e) {
                console.error('Error fetching today events:', e)
            }
            setLoading(false)
        }
        fetchTodayEvents()
    }, [])

    const eventTypeColors: Record<string, { color: string; bg: string }> = {
        rdv: { color: 'text-green-400', bg: 'bg-green-500/10' },
        reunion: { color: 'text-blue-400', bg: 'bg-blue-500/10' },
        formation: { color: 'text-purple-400', bg: 'bg-purple-500/10' },
        ceremonie: { color: 'text-amber-400', bg: 'bg-amber-500/10' },
        fete: { color: 'text-red-400', bg: 'bg-red-500/10' },
        autre: { color: 'text-gray-400', bg: 'bg-gray-500/10' },
        general: { color: 'text-gray-400', bg: 'bg-gray-500/10' },
    }

    if (loading) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="p-6 rounded-lg bg-[#141414] border border-[#2a2a2a]"
            >
                <div className="flex items-center justify-center py-4">
                    <MiniLoader />
                </div>
            </motion.div>
        )
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="p-6 rounded-lg bg-[#141414] border border-[#2a2a2a]"
        >
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-blue-400" />
                    <h3 className="font-display font-bold text-white">Aujourd'hui</h3>
                </div>
                <Link href="/intranet/planning" className="text-xs text-blue-400 hover:underline">
                    Voir le planning
                </Link>
            </div>

            {events.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">Aucun événement aujourd'hui</p>
            ) : (
                <div className="space-y-2">
                    {events.slice(0, 5).map(event => {
                        const colors = eventTypeColors[event.event_type] || eventTypeColors.autre
                        return (
                            <div
                                key={event.id}
                                className={`flex items-center gap-3 p-3 rounded-lg ${colors.bg} border border-transparent`}
                            >
                                <div className="flex-shrink-0 text-center min-w-[50px]">
                                    <p className={`text-xs font-mono ${colors.color}`}>
                                        {event.start_time?.slice(0, 5) || '--:--'}
                                    </p>
                                    <p className="text-xs text-gray-600">-</p>
                                    <p className={`text-xs font-mono ${colors.color}`}>
                                        {event.end_time?.slice(0, 5) || '--:--'}
                                    </p>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-white truncate">{event.title}</p>
                                    {event.location && (
                                        <p className="text-xs text-gray-500 flex items-center gap-1">
                                            <MapPin className="w-3 h-3" />
                                            {event.location}
                                        </p>
                                    )}
                                    {event.created_by_name && (
                                        <p className="text-xs text-gray-600">
                                            Par {event.created_by_name}
                                        </p>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                    {events.length > 5 && (
                        <p className="text-xs text-gray-500 text-center">
                            +{events.length - 5} autres événements
                        </p>
                    )}
                </div>
            )}
        </motion.div>
    )
}

// Actions rapides - liens statiques
const staticQuickActions = [
    { href: "/intranet/tarifs", label: "Consulter les tarifs", icon: DollarSign, color: "text-green-400", bg: "bg-green-500/10" },
    { href: "/intranet/wiki", label: "Wiki", icon: BookOpen, color: "text-amber-400", bg: "bg-amber-500/10" },
]

// Couleurs des rôles
const roleColors: Record<string, string> = {
    "Direction": "text-red-400 bg-red-500/10 border-red-500/30",
    "Chirurgien": "text-purple-400 bg-purple-500/10 border-purple-500/30",
    "Médecin": "text-blue-400 bg-blue-500/10 border-blue-500/30",
    "Infirmier": "text-green-400 bg-green-500/10 border-green-500/30",
    "Ambulancier": "text-orange-400 bg-orange-500/10 border-orange-500/30",
    "Recruteur": "text-pink-400 bg-pink-500/10 border-pink-500/30",
    "Visiteur": "text-gray-400 bg-gray-500/10 border-gray-500/30",
}

export default function IntranetPage() {
    const router = useRouter()
    const toast = useToast()
    const [profile, setProfile] = useState<UserProfile | null>(null)
    const [loading, setLoading] = useState(true)

    // Modal states
    const [showUSIModal, setShowUSIModal] = useState(false)
    const [showVisitModal, setShowVisitModal] = useState(false)
    const [modalData, setModalData] = useState({ firstName: "", lastName: "" })
    const [isProcessing, setIsProcessing] = useState(false)

    // Handler pour créer/trouver patient puis rediriger
    async function handlePatientAction(type: 'usi' | 'visit') {
        if (!modalData.firstName.trim() || !modalData.lastName.trim()) {
            toast.error("Veuillez remplir le prénom et le nom")
            return
        }

        setIsProcessing(true)
        try {
            // Chercher le patient existant
            const searchRes = await fetch(`/api/patients?search=${encodeURIComponent(modalData.firstName + ' ' + modalData.lastName)}&limit=1`)
            const searchData = await searchRes.json()

            let patientId: string

            // Vérifier si on a un match exact
            const exactMatch = searchData.patients?.find((p: any) =>
                p.first_name.toLowerCase() === modalData.firstName.toLowerCase() &&
                p.last_name.toLowerCase() === modalData.lastName.toLowerCase()
            )

            if (exactMatch) {
                patientId = exactMatch.id
            } else {
                // Créer le patient
                const createRes = await fetch('/api/patients', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        firstName: modalData.firstName.trim(),
                        lastName: modalData.lastName.trim()
                    })
                })
                const createData = await createRes.json()

                if (!createRes.ok) {
                    throw new Error(createData.error || 'Erreur création patient')
                }
                patientId = createData.patient.id
                toast.success('Patient créé')
            }

            // Fermer le modal et rediriger
            setShowUSIModal(false)
            setShowVisitModal(false)
            setModalData({ firstName: "", lastName: "" })

            if (type === 'usi') {
                router.push(`/intranet/patients/${patientId}?action=newUSI`)
            } else {
                router.push(`/intranet/patients/${patientId}?action=newExam`)
            }
        } catch (error: any) {
            console.error('Erreur:', error)
            toast.error(error.message || 'Une erreur est survenue')
        } finally {
            setIsProcessing(false)
        }
    }

    useEffect(() => {
        async function fetchProfile() {
            try {
                const res = await fetch('/api/user/profile')
                if (res.ok) {
                    const data = await res.json()
                    setProfile(data)
                }
            } catch (error) {
                console.error('Erreur récupération profil:', error)
            } finally {
                setLoading(false)
            }
        }
        fetchProfile()
    }, [])

    return (
        <div className="py-4 md:py-8 space-y-6">
            {/* Header personnalisé */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                data-onboarding="welcome"
            >
                <div className="flex items-center gap-4">
                    {profile?.avatarUrl ? (
                        <img
                            src={profile.avatarUrl}
                            alt=""
                            className="w-14 h-14 md:w-16 md:h-16 rounded-full border-2 border-red-500/50"
                        />
                    ) : (
                        <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center">
                            <HeartPulse className="w-7 h-7 text-white" />
                        </div>
                    )}
                    <div>
                        <h1 className="font-display text-2xl md:text-3xl font-bold text-white">
                            Bienvenue{profile?.displayName ? `, ${profile.displayName}` : ''} !
                        </h1>
                        <div className="flex items-center gap-2 mt-1">
                            {loading ? (
                                <MiniLoader />
                            ) : profile?.gradeName ? (
                                <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs font-bold ${roleColors[profile.gradeName] || roleColors["Visiteur"]}`}>
                                    <Shield className="w-3 h-3" />
                                    {profile.gradeName}
                                </span>
                            ) : null}
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Prochain événement - Désactivé temporairement
            <NextEventWidget />
            */}

            {/* Stats utilisateur */}
            {profile && <UserStatsWidget userDiscordId={profile.discordId} />}

            {/* Actions rapides */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
            >
                <h2 className="font-display font-bold text-lg text-white mb-3">Actions rapides</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-onboarding="quick-actions">
                    {/* Créer USI - Modal */}
                    <button
                        onClick={() => setShowUSIModal(true)}
                        className="p-4 rounded-lg bg-purple-500/10 border border-transparent hover:border-purple-400 transition-all group card-premium text-left"
                    >
                        <ClipboardList className="w-6 h-6 text-purple-400 mb-2 group-hover:scale-110 transition-transform" />
                        <p className="text-sm font-medium text-purple-400">Créer un USI</p>
                    </button>

                    {/* Créer Visite - Modal */}
                    <button
                        onClick={() => setShowVisitModal(true)}
                        className="p-4 rounded-lg bg-blue-500/10 border border-transparent hover:border-blue-400 transition-all group card-premium text-left"
                    >
                        <Stethoscope className="w-6 h-6 text-blue-400 mb-2 group-hover:scale-110 transition-transform" />
                        <p className="text-sm font-medium text-blue-400">Créer une visite</p>
                    </button>

                    {/* Liens statiques */}
                    {staticQuickActions.map((action) => (
                        <Link key={action.href} href={action.href}>
                            <div className={`p-4 rounded-lg ${action.bg} border border-transparent hover:border-current transition-all group card-premium`}>
                                <action.icon className={`w-6 h-6 ${action.color} mb-2 group-hover:scale-110 transition-transform`} />
                                <p className={`text-sm font-medium ${action.color}`}>{action.label}</p>
                            </div>
                        </Link>
                    ))}
                </div>
            </motion.div>

            {/* Layout 2 colonnes */}
            <div className="grid md:grid-cols-2 gap-6">
                {/* Événements du jour */}
                <TodayEventsWidget />

                {/* Collègues en service */}
                <ColleaguesWidget />
            </div>

            {/* Modal Créer USI */}
            <AnimatePresence>
                {showUSIModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
                        onClick={() => !isProcessing && setShowUSIModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 max-w-md w-full"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <ClipboardList className="w-5 h-5 text-purple-400" />
                                    Créer un USI
                                </h3>
                                <button onClick={() => setShowUSIModal(false)} disabled={isProcessing} className="text-gray-400 hover:text-white">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">Nom *</label>
                                        <input
                                            type="text"
                                            value={modalData.lastName}
                                            onChange={(e) => setModalData({ ...modalData, lastName: e.target.value })}
                                            className="w-full bg-black/50 border border-white/10 rounded px-3 py-2 text-white focus:outline-none focus:border-purple-500/50"
                                            placeholder="DUPONT"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">Prénom *</label>
                                        <input
                                            type="text"
                                            value={modalData.firstName}
                                            onChange={(e) => setModalData({ ...modalData, firstName: e.target.value })}
                                            className="w-full bg-black/50 border border-white/10 rounded px-3 py-2 text-white focus:outline-none focus:border-purple-500/50"
                                            placeholder="Jean"
                                        />
                                    </div>
                                </div>
                                <p className="text-xs text-gray-500">
                                    Si le patient existe déjà, vous serez redirigé vers son dossier.
                                </p>
                                <div className="flex gap-3 mt-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowUSIModal(false)}
                                        disabled={isProcessing}
                                        className="flex-1 py-2 px-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors disabled:opacity-50"
                                    >
                                        Annuler
                                    </button>
                                    <button
                                        onClick={() => handlePatientAction('usi')}
                                        disabled={isProcessing}
                                        className="flex-1 py-2 px-4 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors disabled:opacity-50"
                                    >
                                        {isProcessing ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Continuer"}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Modal Créer Visite */}
            <AnimatePresence>
                {showVisitModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
                        onClick={() => !isProcessing && setShowVisitModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 max-w-md w-full"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <Stethoscope className="w-5 h-5 text-blue-400" />
                                    Créer une visite médicale
                                </h3>
                                <button onClick={() => setShowVisitModal(false)} disabled={isProcessing} className="text-gray-400 hover:text-white">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">Nom *</label>
                                        <input
                                            type="text"
                                            value={modalData.lastName}
                                            onChange={(e) => setModalData({ ...modalData, lastName: e.target.value })}
                                            className="w-full bg-black/50 border border-white/10 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500/50"
                                            placeholder="DUPONT"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">Prénom *</label>
                                        <input
                                            type="text"
                                            value={modalData.firstName}
                                            onChange={(e) => setModalData({ ...modalData, firstName: e.target.value })}
                                            className="w-full bg-black/50 border border-white/10 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500/50"
                                            placeholder="Jean"
                                        />
                                    </div>
                                </div>
                                <p className="text-xs text-gray-500">
                                    Si le patient existe déjà, vous serez redirigé vers son dossier.
                                </p>
                                <div className="flex gap-3 mt-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowVisitModal(false)}
                                        disabled={isProcessing}
                                        className="flex-1 py-2 px-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors disabled:opacity-50"
                                    >
                                        Annuler
                                    </button>
                                    <button
                                        onClick={() => handlePatientAction('visit')}
                                        disabled={isProcessing}
                                        className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50"
                                    >
                                        {isProcessing ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Continuer"}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
