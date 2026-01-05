"use client"

import { useState, useEffect, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
    Clock, Plus, Trash2, Loader2, ChevronLeft, ChevronRight, Calendar, DollarSign,
    AlertCircle, LayoutGrid, List, TrendingUp, Download, BarChart3
} from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import { Breadcrumbs } from "@/components/ui/Breadcrumbs"
import { EmptyState } from "@/components/ui/EmptyState"
import { useToast } from "@/contexts/ToastContext"
import { useConfirmAnimation } from "@/hooks/useConfirmAnimation"
import { getCurrentISOWeekAndYear, getDateOfISOWeek, formatTime } from "@/lib/date-utils"

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

interface WeekData {
    week: number
    year: number
    minutes: number
    salary: number
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
    const { week: currentWeek, year: currentYear } = getCurrentISOWeekAndYear()
    const [week, setWeek] = useState(currentWeek)
    const [year, setYear] = useState(currentYear)
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
    const [showTrend, setShowTrend] = useState(false)
    const [trendData, setTrendData] = useState<WeekData[]>([])
    const [loadingTrend, setLoadingTrend] = useState(false)
    const toast = useToast()

    // Modal ajout
    const [isAddOpen, setIsAddOpen] = useState(false)
    const [selectedDay, setSelectedDay] = useState(0)
    const [startTime, setStartTime] = useState("09:00")
    const [endTime, setEndTime] = useState("12:00")
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState("")
    const { fireSuccess } = useConfirmAnimation()

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

    // Charger les tendances (4 dernières semaines)
    const fetchTrend = async () => {
        if (trendData.length > 0) {
            setShowTrend(!showTrend)
            return
        }

        setLoadingTrend(true)
        try {
            const promises = []
            for (let i = 3; i >= 0; i--) {
                let w = week - i
                let y = year
                if (w < 1) {
                    w += 52
                    y -= 1
                }
                promises.push(
                    fetch(`/api/intranet/services?week=${w}&year=${y}`)
                        .then(r => r.json())
                        .then(data => ({ week: w, year: y, ...data.stats }))
                )
            }
            const results = await Promise.all(promises)
            setTrendData(results.map(r => ({
                week: r.week,
                year: r.year,
                minutes: r.totalMinutes || 0,
                salary: r.totalSalary || 0
            })))
            setShowTrend(true)
        } catch (e) {
            console.error('Erreur tendances:', e)
        } finally {
            setLoadingTrend(false)
        }
    }

    const handleAddService = async () => {
        setError("")
        setSubmitting(true)

        const date = getDateOfISOWeek(week, year, selectedDay)
        const startDateTime = new Date(`${date}T${startTime}:00`)
        let endDateTime = new Date(`${date}T${endTime}:00`)
        if (endDateTime <= startDateTime) {
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

            if (!res.ok) {
                const data = await res.json()
                setError(data.error || "Erreur lors de l'ajout")
                return
            }

            setIsAddOpen(false)
            fireSuccess()
            toast.success("Service ajouté !")
            fetchServices()
        } catch (error) {
            setError("Erreur réseau")
        } finally {
            setSubmitting(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm("Supprimer ce service ?")) return
        try {
            const res = await fetch(`/api/intranet/services?id=${id}`, { method: 'DELETE' })
            if (res.ok) {
                toast.success("Service supprimé")
                fetchServices()
            }
        } catch (error) {
            toast.error("Erreur suppression")
        }
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

    // Services complétés pour la liste
    const completedServices = useMemo(() => {
        return services
            .filter(s => s.end_time)
            .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
    }, [services])

    const prevWeek = () => {
        if (week === 1) { setWeek(52); setYear(year - 1) }
        else { setWeek(week - 1) }
    }

    const nextWeek = () => {
        if (week === 52) { setWeek(1); setYear(year + 1) }
        else { setWeek(week + 1) }
    }

    // Export CSV
    const exportCSV = () => {
        const header = 'Date,Début,Fin,Durée (min),Salaire\n'
        const rows = completedServices.map(s => {
            const startDate = new Date(s.start_time)
            return `${s.service_date},${formatTime(s.start_time)},${formatTime(s.end_time)},${s.duration_minutes},${s.salary_earned}`
        }).join('\n')

        const blob = new Blob([header + rows], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `services_semaine_${week}_${year}.csv`
        a.click()
        URL.revokeObjectURL(url)
        toast.success("Export téléchargé !")
    }

    // Calcul max pour le graphique tendance
    const maxTrendMinutes = Math.max(...trendData.map(d => d.minutes), 1)

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
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
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

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={fetchTrend}
                            disabled={loadingTrend}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${showTrend
                                ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
                                : 'bg-[#141414] border-[#2a2a2a] text-gray-400 hover:text-white'
                                }`}
                        >
                            {loadingTrend ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
                            <span className="hidden md:inline">Tendances</span>
                        </button>
                        <button
                            onClick={exportCSV}
                            disabled={completedServices.length === 0}
                            className="flex items-center gap-2 px-3 py-2 bg-[#141414] border border-[#2a2a2a] rounded-lg text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                        >
                            <Download className="w-4 h-4" />
                            <span className="hidden md:inline">Export</span>
                        </button>
                        <div className="flex bg-[#141414] border border-[#2a2a2a] rounded-lg overflow-hidden">
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`p-2 ${viewMode === 'grid' ? 'bg-red-500/20 text-red-400' : 'text-gray-400 hover:text-white'}`}
                            >
                                <LayoutGrid className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-2 ${viewMode === 'list' ? 'bg-red-500/20 text-red-400' : 'text-gray-400 hover:text-white'}`}
                            >
                                <List className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Graphique Tendances */}
            <AnimatePresence>
                {showTrend && trendData.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mb-6 p-4 bg-[#141414] border border-[#2a2a2a] rounded-lg overflow-hidden"
                    >
                        <h3 className="font-display font-bold text-sm mb-4 flex items-center gap-2">
                            <BarChart3 className="w-4 h-4 text-blue-400" />
                            Tendance des 4 dernières semaines
                        </h3>
                        <div className="grid grid-cols-4 gap-3">
                            {trendData.map((data, i) => (
                                <div key={i} className="text-center">
                                    <div className="h-24 flex items-end justify-center mb-2">
                                        <motion.div
                                            initial={{ height: 0 }}
                                            animate={{ height: `${(data.minutes / maxTrendMinutes) * 100}%` }}
                                            transition={{ delay: i * 0.1, duration: 0.5 }}
                                            className="w-8 bg-gradient-to-t from-blue-600 to-blue-400 rounded-t"
                                            style={{ minHeight: data.minutes > 0 ? '8px' : '0' }}
                                        />
                                    </div>
                                    <p className="text-xs text-gray-500">S{data.week}</p>
                                    <p className="text-sm font-bold text-white">{Math.floor(data.minutes / 60)}h</p>
                                    <p className="text-xs text-green-400">${data.salary.toLocaleString()}</p>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

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

            {/* Vue Liste */}
            {viewMode === 'list' ? (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="bg-[#141414] border border-[#2a2a2a] rounded-lg overflow-hidden"
                >
                    {completedServices.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                            <Clock className="w-10 h-10 mx-auto mb-2 opacity-50" />
                            <p>Aucun service cette semaine</p>
                        </div>
                    ) : (
                        <table className="w-full">
                            <thead className="bg-[#1a1a1a] border-b border-[#2a2a2a]">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase">Date</th>
                                    <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase">Horaires</th>
                                    <th className="px-4 py-3 text-right text-xs text-gray-500 uppercase">Durée</th>
                                    <th className="px-4 py-3 text-right text-xs text-gray-500 uppercase">Salaire</th>
                                    <th className="px-4 py-3 w-10"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {completedServices.map((service, i) => {
                                    const startDate = new Date(service.start_time)
                                    return (
                                        <motion.tr
                                            key={service.id}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: i * 0.05 }}
                                            className="border-b border-[#2a2a2a] hover:bg-[#1a1a1a]"
                                        >
                                            <td className="px-4 py-3">
                                                <p className="text-sm font-medium text-white">
                                                    {DAYS[startDate.getDay() === 0 ? 6 : startDate.getDay() - 1]}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    {startDate.toLocaleDateString('fr-FR')}
                                                </p>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="text-sm text-red-400 font-medium">
                                                    {formatTime(service.start_time)} - {formatTime(service.end_time)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <span className="text-sm text-white">
                                                    {Math.floor(service.duration_minutes / 60)}h{service.duration_minutes % 60 > 0 ? service.duration_minutes % 60 : ''}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <span className="text-sm text-green-400 font-bold">
                                                    ${service.salary_earned.toLocaleString()}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <button
                                                    onClick={() => handleDelete(service.id)}
                                                    className="p-1 text-gray-500 hover:text-red-400 transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </motion.tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    )}
                </motion.div>
            ) : (
                /* Vue Grille */
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
                                {servicesByDay[index]?.map(service => {
                                    const isLive = !service.end_time
                                    return (
                                        <div
                                            key={service.id}
                                            className={`p-2 rounded text-xs relative overflow-hidden ${isLive
                                                ? 'bg-green-500/10 border border-green-500/30'
                                                : 'bg-red-500/10 border border-red-500/30'
                                                }`}
                                        >
                                            {isLive && (
                                                <motion.div
                                                    className="absolute inset-0 bg-green-500/5"
                                                    animate={{ opacity: [0.3, 0.6, 0.3] }}
                                                    transition={{ repeat: Infinity, duration: 2 }}
                                                />
                                            )}
                                            <div className="relative z-10">
                                                <div className="flex justify-between items-start mb-1">
                                                    <span className={`font-bold text-[11px] md:text-xs ${isLive ? 'text-green-400' : 'text-red-400'}`}>
                                                        {formatTime(service.start_time)}
                                                        {isLive ? (
                                                            <span className="ml-1 animate-pulse">→ ...</span>
                                                        ) : (
                                                            <> - {formatTime(service.end_time)}</>
                                                        )}
                                                    </span>
                                                    {!isLive && (
                                                        <button
                                                            onClick={() => handleDelete(service.id)}
                                                            className="p-0.5 text-gray-500 hover:text-red-400"
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="flex justify-between text-gray-400 text-[10px] md:text-xs">
                                                    {isLive ? (
                                                        <span className="text-green-400 font-bold uppercase text-[9px]">En cours</span>
                                                    ) : (
                                                        <>
                                                            <span>{Math.floor(service.duration_minutes / 60)}h{service.duration_minutes % 60 || ''}</span>
                                                            <span className="text-green-400">${service.salary_earned}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                }) || (
                                        <p className="text-[10px] md:text-xs text-gray-600 text-center py-4">Aucun</p>
                                    )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

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
                            <input
                                type="time"
                                value={startTime}
                                onChange={e => setStartTime(e.target.value)}
                                className="w-full bg-black/50 border border-white/10 px-4 py-3 text-white rounded"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 uppercase tracking-widest mb-2">
                                Fin
                            </label>
                            <input
                                type="time"
                                value={endTime}
                                onChange={e => setEndTime(e.target.value)}
                                className="w-full bg-black/50 border border-white/10 px-4 py-3 text-white rounded"
                            />
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
