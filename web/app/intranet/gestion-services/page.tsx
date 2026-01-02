"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Users, Clock, ChevronLeft, ChevronRight, Calendar, Loader2, BadgeDollarSign, Plus, Trash2, Edit2, Search, AlertCircle, X, Download } from "lucide-react"
import { SkeletonServiceCard, SkeletonTable } from "@/components/ui/Skeleton"
import { Modal } from "@/components/ui/Modal"
import { getCurrentISOWeekAndYear, getDateOfISOWeek, formatTime } from "@/lib/date-utils"

interface Service {
    id: string
    start_time: string
    end_time: string
    duration_minutes: number
    salary_earned: number
    service_date: string
}

interface LiveService {
    id: string
    user_discord_id: string
    user_name: string
    user_avatar_url: string | null
    grade_name: string
    start_time: string
}

interface EmployeeData {
    user_discord_id: string
    user_name: string
    user_avatar_url: string | null
    grade_name: string
    services: Service[]
    totalMinutes: number
    totalSalary: number
}

interface Totals {
    totalServices: number
    totalMinutes: number
    totalSalary: number
}

const GRADE_DISPLAY: Record<string, { name: string; color: string }> = {
    direction: { name: 'Direction', color: 'text-red-400' },
    chirurgien: { name: 'Chirurgien', color: 'text-purple-400' },
    medecin: { name: 'Médecin', color: 'text-blue-400' },
    infirmier: { name: 'Infirmier', color: 'text-green-400' },
    ambulancier: { name: 'Ambulancier', color: 'text-orange-400' }
}

const TIME_SLOTS = Array.from({ length: 96 }, (_, i) => {
    const hours = Math.floor(i / 4)
    const minutes = (i % 4) * 15
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
})

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

export default function GestionServicesPage() {
    const [employees, setEmployees] = useState<EmployeeData[]>([])
    const [totals, setTotals] = useState<Totals | null>(null)
    const [loading, setLoading] = useState(true)
    const { week: currentWeek, year: currentYear } = getCurrentISOWeekAndYear()
    const [week, setWeek] = useState(currentWeek)
    const [year, setYear] = useState(currentYear)
    const [error, setError] = useState("")
    const [searchQuery, setSearchQuery] = useState("")

    // Modal ajout service
    const [isAddOpen, setIsAddOpen] = useState(false)
    const [selectedEmployee, setSelectedEmployee] = useState<EmployeeData | null>(null)
    const [selectedDay, setSelectedDay] = useState(0)
    const [startTime, setStartTime] = useState("09:00")
    const [endTime, setEndTime] = useState("12:00")
    const [submitting, setSubmitting] = useState(false)
    const [modalError, setModalError] = useState("")

    // Services en cours
    const [liveServices, setLiveServices] = useState<LiveService[]>([])
    const [cuttingService, setCuttingService] = useState<string | null>(null)

    useEffect(() => {
        fetchData()
        fetchLiveServices()
        // Polling toutes les 30 secondes pour les services en cours
        const interval = setInterval(fetchLiveServices, 30000)
        return () => clearInterval(interval)
    }, [week, year])

    const fetchData = async () => {
        setLoading(true)
        setError("")
        try {
            const res = await fetch(`/api/intranet/services/admin?week=${week}&year=${year}`)
            if (res.ok) {
                const data = await res.json()
                setEmployees(data.employees || [])
                setTotals(data.totals || null)
            } else if (res.status === 403) {
                setError("Accès réservé à la direction")
            } else {
                setError("Erreur de chargement")
            }
        } catch (e) {
            setError("Erreur réseau")
        } finally {
            setLoading(false)
        }
    }

    const fetchLiveServices = async () => {
        try {
            const res = await fetch('/api/intranet/services/admin?live=true')
            if (res.ok) {
                const data = await res.json()
                setLiveServices(data.services || [])
            }
        } catch (e) {
            console.error('Erreur récupération services en cours:', e)
        }
    }

    const handleCutService = async (serviceId: string) => {
        if (!confirm('Couper ce service maintenant ?')) return
        setCuttingService(serviceId)
        try {
            const res = await fetch('/api/intranet/services/live', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ service_id: serviceId, cancel: false })
            })
            if (res.ok) {
                fetchLiveServices()
                fetchData()
            }
        } catch (e) {
            console.error('Erreur coupure service:', e)
        } finally {
            setCuttingService(null)
        }
    }

    const handleAddService = async () => {
        if (!selectedEmployee) return
        setModalError("")
        setSubmitting(true)

        const date = getDateOfISOWeek(week, year, selectedDay)
        const startDateTime = new Date(`${date}T${startTime}:00`)
        let endDateTime = new Date(`${date}T${endTime}:00`)
        if (endDateTime <= startDateTime) {
            endDateTime.setDate(endDateTime.getDate() + 1)
        }

        try {
            const res = await fetch('/api/intranet/services/admin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_discord_id: selectedEmployee.user_discord_id,
                    user_name: selectedEmployee.user_name,
                    grade_name: selectedEmployee.grade_name,
                    start_time: startDateTime.toISOString(),
                    end_time: endDateTime.toISOString()
                })
            })

            if (res.ok) {
                setIsAddOpen(false)
                setSelectedEmployee(null)
                fetchData()
            } else {
                const data = await res.json()
                setModalError(data.error || "Erreur")
            }
        } catch (e) {
            setModalError("Erreur réseau")
        } finally {
            setSubmitting(false)
        }
    }

    const handleDeleteService = async (serviceId: string) => {
        if (!confirm('Supprimer ce service ?')) return
        try {
            await fetch(`/api/intranet/services/admin?id=${serviceId}`, { method: 'DELETE' })
            fetchData()
        } catch (e) {
            console.error('Erreur suppression:', e)
        }
    }

    const openAddModal = (emp: EmployeeData) => {
        setSelectedEmployee(emp)
        setSelectedDay(0)
        setStartTime("09:00")
        setEndTime("12:00")
        setModalError("")
        setIsAddOpen(true)
    }

    const prevWeek = () => {
        if (week === 1) { setWeek(52); setYear(year - 1) }
        else { setWeek(week - 1) }
    }

    const nextWeek = () => {
        if (week === 52) { setWeek(1); setYear(year + 1) }
        else { setWeek(week + 1) }
    }

    // Filtrer les employés par recherche
    const filteredEmployees = employees.filter(emp =>
        emp.user_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (GRADE_DISPLAY[emp.grade_name]?.name || '').toLowerCase().includes(searchQuery.toLowerCase())
    )

    if (loading) {
        return (
            <div className="py-4 md:py-8 space-y-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="animate-pulse h-8 w-8 bg-zinc-800 rounded-full" />
                    <div className="animate-pulse h-6 w-48 bg-zinc-800 rounded" />
                </div>
                {[1, 2, 3].map(i => (
                    <SkeletonServiceCard key={i} />
                ))}
            </div>
        )
    }

    if (error) {
        return (
            <div className="p-8">
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-center text-red-400">
                    {error}
                </div>
            </div>
        )
    }

    return (
        <div className="p-8">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-between items-start mb-6"
            >
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <Users className="w-6 md:w-8 h-6 md:h-8 text-red-500" />
                        <h1 className="font-display text-2xl md:text-3xl font-bold uppercase tracking-tight">
                            Gestion Services
                        </h1>
                    </div>
                    <p className="text-gray-400 font-sans text-sm md:text-base">
                        Vue d'ensemble des services de tous les employés
                    </p>
                </div>
                <a
                    href={`/api/intranet/services/export?week=${week}&year=${year}`}
                    className="hidden md:flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white font-bold rounded transition-colors"
                >
                    <Download className="w-4 h-4" />
                    Export CSV
                </a>
            </motion.div>

            {/* Navigation semaine */}
            <div className="flex items-center justify-between mb-4 p-4 bg-[#141414] border border-[#2a2a2a] rounded-lg">
                <button onClick={prevWeek} className="p-2 hover:bg-white/10 rounded transition-colors">
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-red-500" />
                    <span className="font-display font-bold">Semaine {week} - {year}</span>
                </div>
                <button onClick={nextWeek} className="p-2 hover:bg-white/10 rounded transition-colors">
                    <ChevronRight className="w-5 h-5" />
                </button>
            </div>

            {/* Recherche */}
            <div className="flex items-center gap-3 mb-6 p-4 bg-[#141414] border border-[#2a2a2a] rounded-lg">
                <Search className="w-5 h-5 text-gray-500" />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Rechercher un employé..."
                    className="flex-1 bg-transparent text-white focus:outline-none placeholder:text-gray-600"
                />
            </div>

            {/* Stats globales */}
            {totals && (
                <div className="grid grid-cols-3 gap-2 md:gap-4 mb-6">
                    <div className="p-3 md:p-4 bg-[#141414] border border-[#2a2a2a] rounded-lg">
                        <p className="text-[10px] md:text-xs text-gray-500 uppercase tracking-widest mb-1">Services</p>
                        <p className="font-display text-lg md:text-2xl font-bold text-white">{totals.totalServices}</p>
                    </div>
                    <div className="p-3 md:p-4 bg-[#141414] border border-[#2a2a2a] rounded-lg">
                        <p className="text-[10px] md:text-xs text-gray-500 uppercase tracking-widest mb-1">
                            <span className="hidden md:inline">Heures totales</span>
                            <span className="md:hidden">Heures</span>
                        </p>
                        <p className="font-display text-lg md:text-2xl font-bold text-blue-400">
                            {Math.floor(totals.totalMinutes / 60)}h{totals.totalMinutes % 60 || ''}
                        </p>
                    </div>
                    <div className="p-3 md:p-4 bg-[#141414] border border-[#2a2a2a] rounded-lg">
                        <p className="text-[10px] md:text-xs text-gray-500 uppercase tracking-widest mb-1">
                            <span className="hidden md:inline">Masse salariale</span>
                            <span className="md:hidden">Salaires</span>
                        </p>
                        <p className="font-display text-lg md:text-2xl font-bold text-green-400">
                            ${totals.totalSalary.toLocaleString()}
                        </p>
                    </div>
                </div>
            )}

            {/* Services en cours (Live) */}
            {liveServices.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg"
                >
                    <div className="flex items-center gap-2 mb-4">
                        <motion.div
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ repeat: Infinity, duration: 1.5 }}
                            className="w-3 h-3 bg-red-500 rounded-full"
                        />
                        <h2 className="font-display font-bold text-red-400 uppercase tracking-wider text-sm">
                            Services en cours ({liveServices.length})
                        </h2>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {liveServices.map(service => {
                            const startTime = new Date(service.start_time)
                            const elapsed = Math.floor((Date.now() - startTime.getTime()) / 1000 / 60)
                            return (
                                <div
                                    key={service.id}
                                    className="flex items-center justify-between p-3 bg-[#1a1a1a] border border-red-500/20 rounded-lg"
                                >
                                    <div className="flex items-center gap-3">
                                        {service.user_avatar_url ? (
                                            <img
                                                src={service.user_avatar_url}
                                                alt={service.user_name}
                                                className="w-8 h-8 rounded-full border-2 border-red-500/30"
                                            />
                                        ) : (
                                            <div className="w-8 h-8 bg-red-500/20 rounded-full flex items-center justify-center">
                                                <span className="text-red-400 font-bold text-xs">
                                                    {service.user_name.charAt(0).toUpperCase()}
                                                </span>
                                            </div>
                                        )}
                                        <div>
                                            <p className="font-bold text-sm">{service.user_name}</p>
                                            <p className="text-xs text-gray-500">
                                                {GRADE_DISPLAY[service.grade_name]?.name || service.grade_name}
                                                {' • '}
                                                <span className="text-red-400">
                                                    {elapsed >= 60 ? `${Math.floor(elapsed / 60)}h${elapsed % 60}m` : `${elapsed}m`}
                                                </span>
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleCutService(service.id)}
                                        disabled={cuttingService === service.id}
                                        className="px-3 py-1.5 text-xs font-bold text-red-400 border border-red-500/30 hover:bg-red-500/20 rounded transition-colors disabled:opacity-50"
                                    >
                                        {cuttingService === service.id ? (
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                        ) : (
                                            'Couper'
                                        )}
                                    </button>
                                </div>
                            )
                        })}
                    </div>
                </motion.div>
            )}

            {/* Liste des employés */}
            {filteredEmployees.length === 0 ? (
                <div className="text-center py-12 bg-[#141414] border border-[#2a2a2a] rounded-lg">
                    <Users className="w-12 h-12 mx-auto text-gray-600 mb-4" />
                    <p className="text-gray-500">
                        {searchQuery ? "Aucun employé trouvé" : "Aucun service enregistré cette semaine"}
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredEmployees.map(emp => (
                        <motion.div
                            key={emp.user_discord_id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-[#141414] border border-[#2a2a2a] rounded-lg overflow-hidden"
                        >
                            {/* Header employé */}
                            <div className="p-3 md:p-4 bg-[#1a1a1a] border-b border-[#2a2a2a]">
                                <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3">
                                    <div className="flex items-center gap-3">
                                        {emp.user_avatar_url ? (
                                            <img
                                                src={emp.user_avatar_url}
                                                alt={emp.user_name}
                                                className="w-8 h-8 md:w-10 md:h-10 rounded-full flex-shrink-0 border-2 border-[#2a2a2a]"
                                            />
                                        ) : (
                                            <div className="w-8 h-8 md:w-10 md:h-10 bg-red-500/20 rounded-full flex items-center justify-center">
                                                <span className="font-bold text-red-400 text-sm">
                                                    {emp.user_name.charAt(0).toUpperCase()}
                                                </span>
                                            </div>
                                        )}
                                        <div>
                                            <h3 className="font-display font-bold text-sm md:text-base">{emp.user_name}</h3>
                                            <p className={`text-xs ${GRADE_DISPLAY[emp.grade_name]?.color || 'text-gray-400'}`}>
                                                {GRADE_DISPLAY[emp.grade_name]?.name || emp.grade_name}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 md:gap-4 ml-11 md:ml-0">
                                        <div className="flex items-center gap-1 md:gap-2 text-xs md:text-sm">
                                            <Clock className="w-3 h-3 md:w-4 md:h-4 text-gray-500" />
                                            <span>{Math.floor(emp.totalMinutes / 60)}h{emp.totalMinutes % 60 || ''}</span>
                                        </div>
                                        <div className="flex items-center gap-1 md:gap-2 text-green-400 text-xs md:text-sm">
                                            <BadgeDollarSign className="w-3 h-3 md:w-4 md:h-4" />
                                            <span className="font-bold">${emp.totalSalary.toLocaleString()}</span>
                                        </div>
                                        <button
                                            onClick={() => openAddModal(emp)}
                                            className="p-1.5 md:p-2 text-red-400 hover:bg-red-500/20 rounded transition-colors"
                                            title="Ajouter un service"
                                        >
                                            <Plus className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Services */}
                            <div className="p-3 md:p-4">
                                {emp.services.length === 0 ? (
                                    <p className="text-gray-500 text-sm text-center py-4">Aucun service cette semaine</p>
                                ) : (
                                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
                                        {emp.services.map(service => (
                                            <div
                                                key={service.id}
                                                className="p-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded text-xs group relative"
                                            >
                                                <button
                                                    onClick={() => handleDeleteService(service.id)}
                                                    className="absolute top-1 right-1 p-1 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                                <div className="text-gray-400 mb-1 text-[10px] md:text-xs">
                                                    {new Date(service.service_date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })}
                                                </div>
                                                <div className="font-bold text-white text-[11px] md:text-xs">
                                                    {formatTime(service.start_time)}-{formatTime(service.end_time)}
                                                </div>
                                                <div className="text-green-400 text-[10px] md:text-xs">${service.salary_earned}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Modal Ajouter Service */}
            <Modal
                isOpen={isAddOpen}
                onClose={() => setIsAddOpen(false)}
                title={`Ajouter un service pour ${selectedEmployee?.user_name || ''}`}
                footer={
                    <div className="flex justify-end gap-3">
                        <button onClick={() => setIsAddOpen(false)} className="px-4 py-2 text-gray-400 hover:text-white">
                            Annuler
                        </button>
                        <button
                            onClick={handleAddService}
                            disabled={submitting}
                            className="bg-red-600 hover:bg-red-500 text-white px-6 py-2 font-bold disabled:opacity-50"
                        >
                            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Ajouter'}
                        </button>
                    </div>
                }
            >
                <div className="space-y-4">
                    {modalError && (
                        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
                            <AlertCircle className="w-4 h-4" />
                            {modalError}
                        </div>
                    )}

                    <div>
                        <label className="block text-xs text-gray-500 uppercase tracking-widest mb-2">Jour</label>
                        <select
                            value={selectedDay}
                            onChange={e => setSelectedDay(parseInt(e.target.value))}
                            className="w-full bg-black/50 border border-white/10 px-4 py-3 text-white"
                        >
                            {DAYS.map((d, i) => (
                                <option key={d} value={i}>{d}</option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-gray-500 uppercase tracking-widest mb-2">Début</label>
                            <select
                                value={startTime}
                                onChange={e => setStartTime(e.target.value)}
                                className="w-full bg-black/50 border border-white/10 px-4 py-3 text-white"
                            >
                                {TIME_SLOTS.map(t => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 uppercase tracking-widest mb-2">Fin</label>
                            <select
                                value={endTime}
                                onChange={e => setEndTime(e.target.value)}
                                className="w-full bg-black/50 border border-white/10 px-4 py-3 text-white"
                            >
                                {TIME_SLOTS.map(t => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            </Modal>
        </div>
    )
}
