"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Clock, Plus, Trash2, Loader2, ChevronLeft, ChevronRight, Calendar, DollarSign, AlertCircle } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import { Breadcrumbs } from "@/components/ui/Breadcrumbs"
import { EmptyState } from "@/components/ui/EmptyState"
import { useToast } from "@/contexts/ToastContext"

interface Service {
    id: string
    start_time: string
    end_time: string
    duration_minutes: number
    slots_count: number
    salary_earned: number
    service_date: string
    grade_name: string
}

interface ServiceStats {
    totalMinutes: number
    totalHours: number
    totalSalary: number
    maxWeekly: number
    remainingSalary: number
}

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
const TIME_SLOTS = Array.from({ length: 96 }, (_, i) => {
    const hours = Math.floor(i / 4)
    const minutes = (i % 4) * 15
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
})

export default function ServicesPage() {
    const [services, setServices] = useState<Service[]>([])
    const [stats, setStats] = useState<ServiceStats | null>(null)
    const [loading, setLoading] = useState(true)
    const [week, setWeek] = useState(getCurrentISOWeek())
    const [year, setYear] = useState(new Date().getFullYear())
    const toast = useToast()

    // Modal ajout
    const [isAddOpen, setIsAddOpen] = useState(false)
    const [selectedDay, setSelectedDay] = useState(0)
    const [startTime, setStartTime] = useState("09:00")
    const [endTime, setEndTime] = useState("12:00")
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState("")

    useEffect(() => {
        fetchServices()
    }, [week, year])

    const fetchServices = async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/intranet/services?week=${week}&year=${year}`)
            if (res.ok) {
                const data = await res.json()
                setServices(data.services || [])
                setStats(data.stats || null)
            }
        } catch (error) {
            console.error('Erreur:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleAddService = async () => {
        setError("")
        setSubmitting(true)

        // Calculer la date du jour sélectionné dans la semaine
        const date = getDateOfISOWeek(week, year, selectedDay)
        const startDateTime = new Date(`${date}T${startTime}:00`)

        // Gérer le cas où la fin est le lendemain
        let endDateTime = new Date(`${date}T${endTime}:00`)
        if (endDateTime <= startDateTime) {
            // Service qui passe minuit
            endDateTime.setDate(endDateTime.getDate() + 1)
        }

        try {
            const res = await fetch('/api/intranet/services', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    start_time: startDateTime.toISOString(),
                    end_time: endDateTime.toISOString()
                })
            })

            if (res.ok) {
                setIsAddOpen(false)
                fetchServices()
            } else {
                const data = await res.json()
                setError(data.error || "Erreur lors de l'ajout")
            }
        } catch (e) {
            setError("Erreur réseau")
        } finally {
            setSubmitting(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Supprimer ce service ?')) return
        await fetch(`/api/intranet/services/${id}`, { method: 'DELETE' })
        fetchServices()
    }

    const openAddModal = (dayIndex: number) => {
        setSelectedDay(dayIndex)
        setStartTime("09:00")
        setEndTime("12:00")
        setError("")
        setIsAddOpen(true)
    }

    // Grouper services par jour
    const servicesByDay: Record<number, Service[]> = {}
    services.forEach(s => {
        const dayOfWeek = new Date(s.start_time).getDay()
        const dayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1
        if (!servicesByDay[dayIndex]) servicesByDay[dayIndex] = []
        servicesByDay[dayIndex].push(s)
    })

    const prevWeek = () => {
        if (week === 1) {
            setWeek(52)
            setYear(year - 1)
        } else {
            setWeek(week - 1)
        }
    }

    const nextWeek = () => {
        if (week === 52) {
            setWeek(1)
            setYear(year + 1)
        } else {
            setWeek(week + 1)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Loader2 className="w-8 h-8 animate-spin text-red-500" />
            </div>
        )
    }

    return (
        <div className="py-4 md:p-8">
            <Breadcrumbs items={[{ label: "Mes Services" }]} />

            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6"
            >
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <Clock className="w-6 md:w-8 h-6 md:h-8 text-red-500" />
                        <h1 className="font-display text-2xl md:text-3xl font-bold uppercase tracking-tight">
                            Mes Services
                        </h1>
                    </div>
                    <p className="text-gray-400 font-sans text-sm md:text-base">
                        Gérez vos prises de service et consultez votre salaire
                    </p>
                </div>
            </motion.div>

            {/* Navigation semaine */}
            <div className="flex items-center justify-between mb-6 p-4 bg-[#141414] border border-[#2a2a2a] rounded-lg">
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

            {/* Stats */}
            {stats && (
                <div className="grid grid-cols-3 gap-2 md:gap-4 mb-6">
                    <div className="p-3 md:p-4 bg-[#141414] border border-[#2a2a2a] rounded-lg">
                        <p className="text-[10px] md:text-xs text-gray-500 uppercase tracking-widest mb-1">Heures</p>
                        <p className="font-display text-lg md:text-2xl font-bold text-white">
                            {stats.totalHours}h{stats.totalMinutes % 60 > 0 ? (stats.totalMinutes % 60) : ''}
                        </p>
                    </div>
                    <div className="p-3 md:p-4 bg-[#141414] border border-[#2a2a2a] rounded-lg">
                        <p className="text-[10px] md:text-xs text-gray-500 uppercase tracking-widest mb-1">Salaire</p>
                        <p className="font-display text-lg md:text-2xl font-bold text-green-400">
                            ${stats.totalSalary.toLocaleString()}
                        </p>
                    </div>
                    <div className="p-3 md:p-4 bg-[#141414] border border-[#2a2a2a] rounded-lg">
                        <p className="text-[10px] md:text-xs text-gray-500 uppercase tracking-widest mb-1">
                            <span className="hidden md:inline">Reste (max {stats.maxWeekly.toLocaleString()}$)</span>
                            <span className="md:hidden">Reste</span>
                        </p>
                        <p className="font-display text-lg md:text-2xl font-bold text-orange-400">
                            ${stats.remainingSalary.toLocaleString()}
                        </p>
                    </div>
                </div>
            )}

            {/* Grille de la semaine */}
            <div className="grid grid-cols-2 md:grid-cols-7 gap-2">
                {DAYS.map((day, index) => (
                    <div key={day} className="bg-[#141414] border border-[#2a2a2a] rounded-lg overflow-hidden">
                        {/* Header jour */}
                        <div className="p-2 md:p-3 bg-[#1a1a1a] border-b border-[#2a2a2a] flex justify-between items-center">
                            <span className="font-display font-bold text-xs md:text-sm">
                                <span className="md:hidden">{day.slice(0, 3)}</span>
                                <span className="hidden md:inline">{day}</span>
                            </span>
                            <button
                                onClick={() => openAddModal(index)}
                                className="p-1 text-red-400 hover:bg-red-500/20 rounded transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Services du jour */}
                        <div className="p-2 min-h-[100px] md:min-h-[150px] space-y-2">
                            {servicesByDay[index]?.map(service => (
                                <div
                                    key={service.id}
                                    className="p-2 bg-red-500/10 border border-red-500/30 rounded text-xs"
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="font-bold text-red-400 text-[11px] md:text-xs">
                                            {formatTime(service.start_time)} - {formatTime(service.end_time)}
                                        </span>
                                        <button
                                            onClick={() => handleDelete(service.id)}
                                            className="p-0.5 text-gray-500 hover:text-red-400"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                    <div className="flex justify-between text-gray-400 text-[10px] md:text-xs">
                                        <span>{Math.floor(service.duration_minutes / 60)}h{service.duration_minutes % 60 || ''}</span>
                                        <span className="text-green-400">${service.salary_earned}</span>
                                    </div>
                                </div>
                            )) || (
                                    <p className="text-[10px] md:text-xs text-gray-600 text-center py-4">Aucun</p>
                                )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal Ajouter */}
            <Modal
                isOpen={isAddOpen}
                onClose={() => setIsAddOpen(false)}
                title={`Ajouter un service - ${DAYS[selectedDay]}`}
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
                    {error && (
                        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
                            <AlertCircle className="w-4 h-4" />
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-gray-500 uppercase tracking-widest mb-2">
                                Début
                            </label>
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
                            <label className="block text-xs text-gray-500 uppercase tracking-widest mb-2">
                                Fin
                            </label>
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

                    <p className="text-xs text-gray-500">
                        💡 Si l'heure de fin est avant l'heure de début, le service sera compté jusqu'au lendemain.
                    </p>
                </div>
            </Modal>
        </div>
    )
}

// Helpers
function getCurrentISOWeek(): number {
    const now = new Date()
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
    const dayNum = d.getUTCDay() || 7
    d.setUTCDate(d.getUTCDate() + 4 - dayNum)
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

function getDateOfISOWeek(week: number, year: number, dayIndex: number): string {
    const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7))
    const dow = simple.getUTCDay()
    const ISOweekStart = simple
    if (dow <= 4)
        ISOweekStart.setUTCDate(simple.getUTCDate() - simple.getUTCDay() + 1)
    else
        ISOweekStart.setUTCDate(simple.getUTCDate() + 8 - simple.getUTCDay())

    ISOweekStart.setUTCDate(ISOweekStart.getUTCDate() + dayIndex)
    return ISOweekStart.toISOString().split('T')[0]
}

function formatTime(isoString: string): string {
    const date = new Date(isoString)
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
}
