"use client"

import { useState, useEffect, useMemo } from "react"
import { motion } from "framer-motion"
import {
    BarChart3, Users, Clock, TrendingUp, TrendingDown, Calendar,
    Loader2, AlertCircle, ChevronLeft, ChevronRight, Activity,
    DollarSign, UserCheck, UserX
} from "lucide-react"
import { Breadcrumbs } from "@/components/ui/Breadcrumbs"
import { getCurrentISOWeekAndYear, getDateOfISOWeek } from "@/lib/date-utils"
import { DashboardSkeleton } from "@/components/ui/Skeleton"

interface EmployeeStats {
    user_discord_id: string
    user_name: string
    user_avatar_url?: string
    grade_name: string
    totalMinutes: number
    totalSalary: number
    serviceCount: number
}

interface DayStats {
    day: string
    dayName: string
    minutes: number
    services: number
}

interface WeekSummary {
    totalMinutes: number
    totalSalary: number
    totalServices: number
    activeEmployees: number
    totalEmployees: number
    previousWeekMinutes: number
}

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const DAYS_FULL = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

export default function DashboardPage() {
    const [loading, setLoading] = useState(true)
    const [week, setWeek] = useState(0)
    const [year, setYear] = useState(0)
    const [services, setServices] = useState<any[]>([])
    const [liveServices, setLiveServices] = useState<any[]>([])
    const [error, setError] = useState("")

    useEffect(() => {
        const { week: currentWeek, year: currentYear } = getCurrentISOWeekAndYear()
        setWeek(currentWeek)
        setYear(currentYear)
    }, [])

    useEffect(() => {
        if (week === 0 || year === 0) return
        fetchData()
    }, [week, year])

    const fetchData = async () => {
        setLoading(true)
        setError("")
        try {
            const [servicesRes, liveRes] = await Promise.all([
                fetch(`/api/intranet/services/admin?week=${week}&year=${year}`),
                fetch('/api/intranet/services/admin?live=true')
            ])

            if (!servicesRes.ok) {
                if (servicesRes.status === 403) {
                    setError("Accès réservé à la Direction")
                } else {
                    setError("Erreur de chargement")
                }
                return
            }

            const servicesData = await servicesRes.json()
            setServices(servicesData.services || [])

            if (liveRes.ok) {
                const liveData = await liveRes.json()
                setLiveServices(liveData.services || [])
            }
        } catch (e) {
            setError("Erreur réseau")
        } finally {
            setLoading(false)
        }
    }

    // Calcul des stats par jour
    const dayStats = useMemo((): DayStats[] => {
        const stats: Record<string, { minutes: number; services: number }> = {}

        // Init tous les jours
        for (let i = 0; i < 7; i++) {
            const date = getDateOfISOWeek(week, year, i)
            stats[date] = { minutes: 0, services: 0 }
        }

        // Agréger les services
        for (const service of services) {
            if (!service.end_time) continue
            const date = service.service_date
            if (stats[date]) {
                stats[date].minutes += service.duration_minutes || 0
                stats[date].services += 1
            }
        }

        return Object.entries(stats).map(([date, data], i) => ({
            day: date,
            dayName: DAYS[i],
            minutes: data.minutes,
            services: data.services
        }))
    }, [services, week, year])

    // Calcul des stats par employé
    const employeeStats = useMemo((): EmployeeStats[] => {
        const stats: Record<string, EmployeeStats> = {}

        for (const service of services) {
            if (!service.end_time) continue
            const id = service.user_discord_id

            if (!stats[id]) {
                stats[id] = {
                    user_discord_id: id,
                    user_name: service.user_name,
                    user_avatar_url: service.user_avatar_url,
                    grade_name: service.grade_name,
                    totalMinutes: 0,
                    totalSalary: 0,
                    serviceCount: 0
                }
            }

            stats[id].totalMinutes += service.duration_minutes || 0
            stats[id].totalSalary += service.salary_earned || 0
            stats[id].serviceCount += 1
        }

        return Object.values(stats).sort((a, b) => b.totalMinutes - a.totalMinutes)
    }, [services])

    // Résumé de la semaine
    const weekSummary = useMemo((): WeekSummary => {
        const completedServices = services.filter(s => s.end_time)
        // Calculer le nombre total d'employés uniques qui ont travaillé
        const allEmployees = new Set(services.map(s => s.user_discord_id))
        const activeEmployees = new Set(completedServices.map(s => s.user_discord_id))

        return {
            totalMinutes: completedServices.reduce((acc, s) => acc + (s.duration_minutes || 0), 0),
            totalSalary: completedServices.reduce((acc, s) => acc + (s.salary_earned || 0), 0),
            totalServices: completedServices.length,
            activeEmployees: activeEmployees.size,
            totalEmployees: Math.max(allEmployees.size, activeEmployees.size, 1), // Au moins 1
            previousWeekMinutes: 0 // TODO: Récupérer depuis l'API
        }
    }, [services])

    const formatTime = (minutes: number) => {
        const h = Math.floor(minutes / 60)
        const m = minutes % 60
        return `${h}h${m > 0 ? m.toString().padStart(2, '0') : ''}`
    }

    const formatMoney = (amount: number) => {
        return new Intl.NumberFormat('fr-FR').format(amount) + ' $'
    }

    const maxDayMinutes = Math.max(...dayStats.map(d => d.minutes), 1)

    const navigateWeek = (delta: number) => {
        let newWeek = week + delta
        let newYear = year

        if (newWeek < 1) {
            newYear--
            newWeek = 52
        } else if (newWeek > 52) {
            newYear++
            newWeek = 1
        }

        setWeek(newWeek)
        setYear(newYear)
    }

    if (error) {
        return (
            <div className="py-4 md:py-8">
                <Breadcrumbs items={[{ label: "Dashboard" }]} />
                <div className="p-8 text-center">
                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <p className="text-red-400">{error}</p>
                </div>
            </div>
        )
    }

    return (
        <div className="py-4 md:py-8 space-y-6">
            <Breadcrumbs items={[{ label: "Dashboard" }]} />

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <BarChart3 className="w-8 h-8 text-red-500" />
                    <div>
                        <h1 className="font-display text-2xl md:text-3xl font-bold uppercase tracking-tight">
                            Dashboard
                        </h1>
                        <p className="text-gray-400 text-sm">Vue d'ensemble de l'activité</p>
                    </div>
                </div>

                {/* Navigation semaine */}
                <div className="flex items-center gap-2 bg-[#141414] border border-[#2a2a2a] rounded-lg p-1">
                    <button
                        onClick={() => navigateWeek(-1)}
                        className="p-2 hover:bg-[#2a2a2a] rounded transition-colors"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <div className="px-4 py-1 text-center min-w-[140px]">
                        <p className="font-display font-bold text-white">Semaine {week}</p>
                        <p className="text-xs text-gray-500">{year}</p>
                    </div>
                    <button
                        onClick={() => navigateWeek(1)}
                        className="p-2 hover:bg-[#2a2a2a] rounded transition-colors"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {loading ? (
                <DashboardSkeleton />
            ) : (
                <>
                    {/* KPIs */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-4 rounded-lg bg-[#141414] border border-[#2a2a2a]"
                        >
                            <div className="flex items-center gap-2 mb-2">
                                <Clock className="w-4 h-4 text-blue-400" />
                                <span className="text-xs text-gray-500 uppercase">Heures totales</span>
                            </div>
                            <p className="text-2xl md:text-3xl font-display font-bold text-white">
                                {formatTime(weekSummary.totalMinutes)}
                            </p>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="p-4 rounded-lg bg-[#141414] border border-[#2a2a2a]"
                        >
                            <div className="flex items-center gap-2 mb-2">
                                <DollarSign className="w-4 h-4 text-green-400" />
                                <span className="text-xs text-gray-500 uppercase">Salaires versés</span>
                            </div>
                            <p className="text-2xl md:text-3xl font-display font-bold text-green-400">
                                {formatMoney(weekSummary.totalSalary)}
                            </p>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="p-4 rounded-lg bg-[#141414] border border-[#2a2a2a]"
                        >
                            <div className="flex items-center gap-2 mb-2">
                                <Activity className="w-4 h-4 text-purple-400" />
                                <span className="text-xs text-gray-500 uppercase">Services</span>
                            </div>
                            <p className="text-2xl md:text-3xl font-display font-bold text-white">
                                {weekSummary.totalServices}
                            </p>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="p-4 rounded-lg bg-[#141414] border border-[#2a2a2a]"
                        >
                            <div className="flex items-center gap-2 mb-2">
                                <Users className="w-4 h-4 text-orange-400" />
                                <span className="text-xs text-gray-500 uppercase">Employés actifs</span>
                            </div>
                            <p className="text-2xl md:text-3xl font-display font-bold text-white">
                                {weekSummary.activeEmployees}
                                <span className="text-sm text-gray-500 font-normal ml-1">
                                    /{weekSummary.totalEmployees}
                                </span>
                            </p>
                            <p className="text-xs text-gray-500">
                                {Math.round((weekSummary.activeEmployees / weekSummary.totalEmployees) * 100)}% de présence
                            </p>
                        </motion.div>
                    </div>

                    {/* Graphique activité par jour */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="p-6 rounded-lg bg-[#141414] border border-[#2a2a2a]"
                    >
                        <h3 className="font-display font-bold text-lg text-white mb-4">
                            Activité par jour
                        </h3>
                        <div className="space-y-3">
                            {dayStats.map((day, i) => (
                                <div key={day.day} className="flex items-center gap-4">
                                    <span className="w-10 text-sm text-gray-500">{day.dayName}</span>
                                    <div className="flex-1 h-8 bg-[#1a1a1a] rounded-lg overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${(day.minutes / maxDayMinutes) * 100}%` }}
                                            transition={{ delay: 0.5 + i * 0.05, duration: 0.5 }}
                                            className="h-full bg-gradient-to-r from-red-600 to-red-500 rounded-lg flex items-center justify-end px-2"
                                        >
                                            {day.minutes > 0 && (
                                                <span className="text-xs text-white font-medium">
                                                    {formatTime(day.minutes)}
                                                </span>
                                            )}
                                        </motion.div>
                                    </div>
                                    <span className="w-16 text-right text-xs text-gray-500">
                                        {day.services} srv
                                    </span>
                                </div>
                            ))}
                        </div>
                    </motion.div>

                    <div className="grid md:grid-cols-2 gap-6">
                        {/* Top employés */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 }}
                            className="p-6 rounded-lg bg-[#141414] border border-[#2a2a2a]"
                        >
                            <h3 className="font-display font-bold text-lg text-white mb-4">
                                Top Employés
                            </h3>
                            {employeeStats.length === 0 ? (
                                <p className="text-gray-500 text-sm text-center py-4">Aucun service cette semaine</p>
                            ) : (
                                <div className="space-y-3">
                                    {employeeStats.slice(0, 5).map((emp, i) => (
                                        <div
                                            key={emp.user_discord_id}
                                            className="flex items-center gap-3 p-2 rounded-lg bg-[#1a1a1a]"
                                        >
                                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                                                i === 1 ? 'bg-gray-400/20 text-gray-300' :
                                                    i === 2 ? 'bg-orange-500/20 text-orange-400' :
                                                        'bg-[#2a2a2a] text-gray-500'
                                                }`}>
                                                {i + 1}
                                            </span>
                                            {emp.user_avatar_url ? (
                                                <img
                                                    src={emp.user_avatar_url}
                                                    alt=""
                                                    className="w-8 h-8 rounded-full"
                                                />
                                            ) : (
                                                <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                                                    <Users className="w-4 h-4 text-gray-500" />
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-white truncate">{emp.user_name}</p>
                                                <p className="text-xs text-gray-500">{emp.grade_name}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-bold text-white">{formatTime(emp.totalMinutes)}</p>
                                                <p className="text-xs text-green-400">{formatMoney(emp.totalSalary)}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </motion.div>

                        {/* Services en cours */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.6 }}
                            className="p-6 rounded-lg bg-[#141414] border border-[#2a2a2a]"
                        >
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-display font-bold text-lg text-white">
                                    En service actuellement
                                </h3>
                                <span className="flex items-center gap-1.5 px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full text-xs">
                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                    {liveServices.length} actif{liveServices.length !== 1 ? 's' : ''}
                                </span>
                            </div>
                            {liveServices.length === 0 ? (
                                <div className="text-center py-8">
                                    <UserX className="w-10 h-10 text-gray-600 mx-auto mb-2" />
                                    <p className="text-gray-500 text-sm">Personne en service</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {liveServices.map((service) => {
                                        const start = new Date(service.start_time)
                                        return (
                                            <div
                                                key={service.id}
                                                className="flex items-center gap-3 p-2 rounded-lg bg-green-500/10 border border-green-500/20"
                                            >
                                                {service.user_avatar_url ? (
                                                    <img
                                                        src={service.user_avatar_url}
                                                        alt=""
                                                        className="w-8 h-8 rounded-full"
                                                    />
                                                ) : (
                                                    <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                                                        <UserCheck className="w-4 h-4 text-green-400" />
                                                    </div>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-white truncate">{service.user_name}</p>
                                                    <p className="text-xs text-gray-500">{service.grade_name}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-xs text-gray-400">
                                                        Depuis {start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </motion.div>
                    </div>
                </>
            )}
        </div>
    )
}
