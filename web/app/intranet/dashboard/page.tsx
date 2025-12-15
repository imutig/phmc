"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import {
    BarChart3, Users, Clock, DollarSign, Loader2, TrendingUp,
    ChevronLeft, ChevronRight, Award, Calendar
} from "lucide-react"
import { useToast } from "@/contexts/ToastContext"

interface WeeklyStats {
    week: number
    year: number
    totalMinutes: number
    totalSalary: number
    serviceCount: number
}

interface GradeStats {
    grade: string
    totalMinutes: number
    totalSalary: number
    employeeCount: number
}

interface TopEmployee {
    name: string
    grade: string
    totalMinutes: number
    totalSalary: number
}

interface DashboardData {
    period: { weeksBack: number, currentWeek: number, currentYear: number }
    totals: {
        totalMinutes: number
        totalHours: number
        totalSalary: number
        totalServices: number
        uniqueEmployees: number
        avgHoursPerEmployee: number
    }
    weeklyStats: WeeklyStats[]
    gradeStats: GradeStats[]
    topEmployees: TopEmployee[]
}

const GRADE_COLORS: Record<string, string> = {
    direction: '#ef4444',
    chirurgien: '#a855f7',
    medecin: '#3b82f6',
    infirmier: '#22c55e',
    ambulancier: '#f97316'
}

const GRADE_LABELS: Record<string, string> = {
    direction: 'Direction',
    chirurgien: 'Chirurgien',
    medecin: 'Médecin',
    infirmier: 'Infirmier',
    ambulancier: 'Ambulancier'
}

export default function DashboardPage() {
    const [data, setData] = useState<DashboardData | null>(null)
    const [loading, setLoading] = useState(true)
    const [weeksBack, setWeeksBack] = useState(4)
    const [error, setError] = useState("")
    const toast = useToast()

    useEffect(() => {
        fetchData()
    }, [weeksBack])

    const fetchData = async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/intranet/dashboard?weeks=${weeksBack}`)
            if (res.ok) {
                setData(await res.json())
                setError("")
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

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Loader2 className="w-8 h-8 animate-spin text-red-500" />
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

    if (!data) return null

    const maxWeeklyMinutes = Math.max(...data.weeklyStats.map(w => w.totalMinutes), 1)
    const maxGradeSalary = Math.max(...data.gradeStats.map(g => g.totalSalary), 1)

    return (
        <div className="py-4 md:p-8">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-6 md:mb-8"
            >
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <BarChart3 className="w-6 md:w-8 h-6 md:h-8 text-red-500" />
                        <h1 className="font-display text-2xl md:text-3xl font-bold uppercase tracking-tight">
                            Dashboard Analytics
                        </h1>
                    </div>
                    <p className="text-gray-400 font-sans text-sm md:text-base">
                        Vue d'ensemble des {weeksBack} dernières semaines
                    </p>
                </div>
                <div className="flex items-center gap-2 bg-[#141414] border border-[#2a2a2a] rounded-lg p-1 self-start">
                    <button
                        onClick={() => setWeeksBack(Math.max(1, weeksBack - 1))}
                        className="p-2 hover:bg-white/10 rounded transition-colors"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="px-3 font-bold text-sm">{weeksBack} sem.</span>
                    <button
                        onClick={() => setWeeksBack(Math.min(12, weeksBack + 1))}
                        className="p-2 hover:bg-white/10 rounded transition-colors"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </motion.div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="p-4 md:p-6 bg-[#141414] border border-[#2a2a2a] rounded-lg"
                >
                    <div className="flex items-center gap-2 md:gap-3 mb-2">
                        <Clock className="w-4 h-4 md:w-5 md:h-5 text-blue-400" />
                        <span className="text-[10px] md:text-xs text-gray-500 uppercase tracking-widest">Heures</span>
                    </div>
                    <p className="font-display text-xl md:text-3xl font-bold text-blue-400">{data.totals.totalHours}h</p>
                    <p className="text-[10px] md:text-xs text-gray-500 mt-1">
                        ~{data.totals.avgHoursPerEmployee}h / emp.
                    </p>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="p-4 md:p-6 bg-[#141414] border border-[#2a2a2a] rounded-lg"
                >
                    <div className="flex items-center gap-2 md:gap-3 mb-2">
                        <DollarSign className="w-4 h-4 md:w-5 md:h-5 text-green-400" />
                        <span className="text-[10px] md:text-xs text-gray-500 uppercase tracking-widest">Salaires</span>
                    </div>
                    <p className="font-display text-xl md:text-3xl font-bold text-green-400">${data.totals.totalSalary.toLocaleString()}</p>
                    <p className="text-[10px] md:text-xs text-gray-500 mt-1">
                        {data.totals.totalServices} services
                    </p>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="p-4 md:p-6 bg-[#141414] border border-[#2a2a2a] rounded-lg"
                >
                    <div className="flex items-center gap-2 md:gap-3 mb-2">
                        <Users className="w-4 h-4 md:w-5 md:h-5 text-purple-400" />
                        <span className="text-[10px] md:text-xs text-gray-500 uppercase tracking-widest">Employés</span>
                    </div>
                    <p className="font-display text-xl md:text-3xl font-bold text-purple-400">{data.totals.uniqueEmployees}</p>
                    <p className="text-[10px] md:text-xs text-gray-500 mt-1">
                        actifs
                    </p>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="p-4 md:p-6 bg-[#141414] border border-[#2a2a2a] rounded-lg"
                >
                    <div className="flex items-center gap-2 md:gap-3 mb-2">
                        <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-orange-400" />
                        <span className="text-[10px] md:text-xs text-gray-500 uppercase tracking-widest">Moy./sem</span>
                    </div>
                    <p className="font-display text-xl md:text-3xl font-bold text-orange-400">
                        ${Math.round(data.totals.totalSalary / weeksBack).toLocaleString()}
                    </p>
                    <p className="text-[10px] md:text-xs text-gray-500 mt-1">
                        {Math.round(data.totals.totalHours / weeksBack)}h / sem
                    </p>
                </motion.div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-6 md:mb-8">
                {/* Graphique évolution par semaine */}
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 }}
                    className="p-4 md:p-6 bg-[#141414] border border-[#2a2a2a] rounded-lg"
                >
                    <h2 className="font-display font-bold text-base md:text-lg mb-4 md:mb-6 flex items-center gap-2">
                        <Calendar className="w-4 h-4 md:w-5 md:h-5 text-red-500" />
                        Évolution par semaine
                    </h2>
                    <div className="flex items-end gap-1 md:gap-2 h-32 md:h-48">
                        {data.weeklyStats.map((week, i) => (
                            <div
                                key={`${week.year}-${week.week}`}
                                className="flex-1 flex flex-col items-center gap-1 md:gap-2"
                            >
                                <div className="text-[10px] md:text-xs text-gray-500">
                                    {Math.round(week.totalMinutes / 60)}h
                                </div>
                                <motion.div
                                    initial={{ height: 0 }}
                                    animate={{ height: `${(week.totalMinutes / maxWeeklyMinutes) * 100}%` }}
                                    transition={{ delay: 0.5 + i * 0.1 }}
                                    className="w-full bg-gradient-to-t from-red-600 to-red-400 rounded-t"
                                    style={{ minHeight: week.totalMinutes > 0 ? '8px' : '0' }}
                                />
                                <div className="text-[10px] md:text-xs text-gray-500 text-center">
                                    S{week.week}
                                </div>
                            </div>
                        ))}
                    </div>
                </motion.div>

                {/* Répartition par grade */}
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 }}
                    className="p-4 md:p-6 bg-[#141414] border border-[#2a2a2a] rounded-lg"
                >
                    <h2 className="font-display font-bold text-base md:text-lg mb-4 md:mb-6 flex items-center gap-2">
                        <Users className="w-4 h-4 md:w-5 md:h-5 text-red-500" />
                        Répartition par grade
                    </h2>
                    <div className="space-y-3 md:space-y-4">
                        {data.gradeStats.map((grade, i) => (
                            <div key={grade.grade}>
                                <div className="flex justify-between items-center text-xs md:text-sm mb-1">
                                    <span className="font-medium" style={{ color: GRADE_COLORS[grade.grade] }}>
                                        {GRADE_LABELS[grade.grade] || grade.grade}
                                    </span>
                                    <span className="text-gray-400 text-[10px] md:text-sm">
                                        ${grade.totalSalary.toLocaleString()} • {grade.employeeCount} emp.
                                    </span>
                                </div>
                                <div className="h-2 md:h-3 bg-[#0a0a0a] rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${(grade.totalSalary / maxGradeSalary) * 100}%` }}
                                        transition={{ delay: 0.6 + i * 0.1 }}
                                        className="h-full rounded-full"
                                        style={{ backgroundColor: GRADE_COLORS[grade.grade] }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </motion.div>
            </div>

            {/* Top employés */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="p-4 md:p-6 bg-[#141414] border border-[#2a2a2a] rounded-lg"
            >
                <h2 className="font-display font-bold text-base md:text-lg mb-4 md:mb-6 flex items-center gap-2">
                    <Award className="w-4 h-4 md:w-5 md:h-5 text-yellow-400" />
                    Top 5 employés (par heures)
                </h2>
                <div className="flex gap-3 md:gap-4 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 md:grid md:grid-cols-5">
                    {data.topEmployees.map((emp, i) => (
                        <div
                            key={i}
                            className="text-center p-3 md:p-4 bg-[#0a0a0a] rounded-lg border border-[#2a2a2a] flex-shrink-0 w-28 md:w-auto"
                        >
                            <div className={`
                                w-10 h-10 md:w-12 md:h-12 mx-auto mb-2 md:mb-3 rounded-full flex items-center justify-center text-lg md:text-xl font-bold
                                ${i === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                                    i === 1 ? 'bg-gray-400/20 text-gray-300' :
                                        i === 2 ? 'bg-orange-600/20 text-orange-400' :
                                            'bg-[#1a1a1a] text-gray-500'}
                            `}>
                                {i + 1}
                            </div>
                            <p className="font-display font-bold text-xs md:text-sm truncate">{emp.name}</p>
                            <p className="text-[10px] md:text-xs mb-1 md:mb-2" style={{ color: GRADE_COLORS[emp.grade] }}>
                                {GRADE_LABELS[emp.grade] || emp.grade}
                            </p>
                            <p className="text-base md:text-lg font-bold text-blue-400">
                                {Math.round(emp.totalMinutes / 60)}h
                            </p>
                            <p className="text-[10px] md:text-xs text-green-400">
                                ${emp.totalSalary.toLocaleString()}
                            </p>
                        </div>
                    ))}
                </div>
            </motion.div>
        </div>
    )
}
