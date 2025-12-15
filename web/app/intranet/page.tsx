"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { HeartPulse, Users, DollarSign, Pill, FileText, TrendingUp, Shield, Loader2, Calendar, MapPin, Clock } from "lucide-react"
import Link from "next/link"
import Image from "next/image"

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
            className="p-6 rounded-lg border overflow-hidden relative"
            style={{
                backgroundColor: '#141414',
                borderColor: event.color + '40'
            }}
        >
            {/* Accent bar */}
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

                {/* Countdown */}
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

const quickLinks = [
    { href: "/intranet/tarifs", label: "Calculer une facture", description: "Outil de tarification", icon: DollarSign, color: "text-red-400" },
    { href: "/intranet/medicaments", label: "Base Médicaments", description: "Posologies & effets", icon: Pill, color: "text-blue-400" },
    { href: "/intranet/candidatures", label: "Candidatures", description: "Gestion recrutement", icon: Users, color: "text-purple-400" },
    { href: "/intranet/reglement", label: "Règlement Interne", description: "Code de conduite", icon: FileText, color: "text-amber-400" },
]

const roleColors: Record<string, string> = {
    "Direction": "text-red-400 bg-red-500/10 border-red-500/30",
    "Chirurgien": "text-purple-400 bg-purple-500/10 border-purple-500/30",
    "Médecin": "text-blue-400 bg-blue-500/10 border-blue-500/30",
    "Infirmier": "text-green-400 bg-green-500/10 border-green-500/30",
    "Ambulancier": "text-orange-400 bg-orange-500/10 border-orange-500/30",
    "Recruteur": "text-pink-400 bg-pink-500/10 border-pink-500/30",
    "Candidat": "text-cyan-400 bg-cyan-500/10 border-cyan-500/30",
    "Visiteur": "text-gray-400 bg-gray-500/10 border-gray-500/30",
}

export default function IntranetPage() {
    const [userRole, setUserRole] = useState<string | null>(null)
    const [allRoles, setAllRoles] = useState<string[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetchRoles() {
            try {
                const res = await fetch('/api/user/roles')
                const data = await res.json()
                setUserRole(data.primaryRole || "Visiteur")
                setAllRoles(data.roles || [])
            } catch (error) {
                console.error('Erreur récupération rôles:', error)
                setUserRole("Erreur")
            } finally {
                setLoading(false)
            }
        }
        fetchRoles()
    }, [])

    return (
        <div className="py-4 md:py-8 space-y-6 md:space-y-8">
            {/* Header avec rôle affiché */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4 md:mb-8">
                <div className="flex items-center gap-3 md:gap-4">
                    <Image src="/logo_phmc.webp" alt="PHMC Logo" width={48} height={48} className="md:w-[60px] md:h-[60px]" />
                    <div>
                        <h1 className="font-display text-2xl md:text-3xl font-bold uppercase tracking-tight text-white mb-1">
                            Intranet EMS
                        </h1>
                        <p className="text-gray-400 font-sans text-sm md:text-base">
                            Bienvenue sur votre espace personnel.
                        </p>
                    </div>
                </div>

                {/* Badge de rôle */}
                <div className="flex flex-row md:flex-col items-start md:items-end gap-2 md:gap-1">
                    {loading ? (
                        <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
                    ) : (
                        <>
                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded border ${roleColors[userRole || "Visiteur"]}`}>
                                <Shield className="w-4 h-4" />
                                <span className="font-display font-bold text-sm uppercase tracking-wider">
                                    {userRole}
                                </span>
                            </div>
                            {allRoles.length > 0 && (
                                <span className="text-xs text-gray-500 hidden md:inline">
                                    Rôles: {allRoles.join(', ')}
                                </span>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Widget Prochain Événement avec Countdown */}
            <NextEventWidget />

            {/* Quick Links Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                {quickLinks.map((link) => (
                    <Link key={link.href} href={link.href} className="group block">
                        <div className="p-6 rounded-lg bg-[#141414] border border-[#2a2a2a] hover:border-red-500/30 transition-colors">
                            <link.icon className={`w-8 h-8 ${link.color} mb-4`} />
                            <h3 className="font-display font-bold text-lg mb-1 text-white">{link.label}</h3>
                            <p className="text-gray-500 text-sm font-sans">{link.description}</p>
                        </div>
                    </Link>
                ))}
            </div>

            {/* Info Section Simple */}
            <div className="p-6 rounded-lg bg-[#141414] border border-[#2a2a2a]">
                <div className="flex items-center gap-3 mb-4">
                    <TrendingUp className="w-5 h-5 text-red-600" />
                    <h2 className="font-display font-bold uppercase text-lg text-white">Rappels Importants</h2>
                </div>

                <ul className="space-y-3">
                    <li className="flex gap-3 text-sm text-gray-400">
                        <span className="text-red-600">•</span>
                        Effectuez vos rapports de service à la fin de chaque prise de service.
                    </li>
                    <li className="flex gap-3 text-sm text-gray-400">
                        <span className="text-red-600">•</span>
                        La facturation doit être systématique pour tout acte médical.
                    </li>
                    <li className="flex gap-3 text-sm text-gray-400">
                        <span className="text-red-600">•</span>
                        Consultez le règlement régulièrement pour les mises à jour.
                    </li>
                </ul>
            </div>
        </div>
    )
}
