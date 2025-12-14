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
        <div className="p-8">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-between items-start mb-8"
            >
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <BarChart3 className="w-8 h-8 text-red-500" />
                        <h1 className="font-display text-3xl font-bold uppercase tracking-tight">
                            Dashboard Analytics
                        </h1>
                    </div>
                    <p className="text-gray-400 font-sans">
                        Vue d'ensemble des {weeksBack} dernières semaines
                    </p>
                </div>
                <div className="flex items-center gap-2 bg-[#141414] border border-[#2a2a2a] rounded-lg p-1">
                    <button
                        onClick={() => setWeeksBack(Math.max(1, weeksBack - 1))}
                        className="p-2 hover:bg-white/10 rounded transition-colors"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="px-3 font-bold">{weeksBack} sem.</span>
                    <button
                        onClick={() => setWeeksBack(Math.min(12, weeksBack + 1))}
                        className="p-2 hover:bg-white/10 rounded transition-colors"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </motion.div>

            {/* Stats Cards */}
            <div className="grid grid-cols-4 gap-4 mb-8">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="p-6 bg-[#141414] border border-[#2a2a2a] rounded-lg"
                >
                    <div className="flex items-center gap-3 mb-2">
                        <Clock className="w-5 h-5 text-blue-400" />
                        <span className="text-xs text-gray-500 uppercase tracking-widest">Heures totales</span>
                    </div>
                    <p className="font-display text-3xl font-bold text-blue-400">{data.totals.totalHours}h</p>
                    <p className="text-xs text-gray-500 mt-1">
                        ~{data.totals.avgHoursPerEmployee}h / employé
                    </p>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="p-6 bg-[#141414] border border-[#2a2a2a] rounded-lg"
                >
                    <div className="flex items-center gap-3 mb-2">
                        <DollarSign className="w-5 h-5 text-green-400" />
                        <span className="text-xs text-gray-500 uppercase tracking-widest">Masse salariale</span>
                    </div>
                    <p className="font-display text-3xl font-bold text-green-400">${data.totals.totalSalary.toLocaleString()}</p>
                    <p className="text-xs text-gray-500 mt-1">
                        {data.totals.totalServices} services
                    </p>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="p-6 bg-[#141414] border border-[#2a2a2a] rounded-lg"
                >
                    <div className="flex items-center gap-3 mb-2">
                        <Users className="w-5 h-5 text-purple-400" />
                        <span className="text-xs text-gray-500 uppercase tracking-widest">Employés actifs</span>
                    </div>
                    <p className="font-display text-3xl font-bold text-purple-400">{data.totals.uniqueEmployees}</p>
                    <p className="text-xs text-gray-500 mt-1">
                        ont travaillé
                    </p>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="p-6 bg-[#141414] border border-[#2a2a2a] rounded-lg"
                >
                    <div className="flex items-center gap-3 mb-2">
                        <TrendingUp className="w-5 h-5 text-orange-400" />
                        <span className="text-xs text-gray-500 uppercase tracking-widest">Moy. / semaine</span>
                    </div>
                    <p className="font-display text-3xl font-bold text-orange-400">
                        ${Math.round(data.totals.totalSalary / weeksBack).toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                        {Math.round(data.totals.totalHours / weeksBack)}h / sem
                    </p>
                </motion.div>
            </div>

            <div className="grid grid-cols-2 gap-6 mb-8">
                {/* Graphique évolution par semaine */}
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 }}
                    className="p-6 bg-[#141414] border border-[#2a2a2a] rounded-lg"
                >
                    <h2 className="font-display font-bold text-lg mb-6 flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-red-500" />
                        Évolution par semaine
                    </h2>
                    <div className="flex items-end gap-2 h-48">
                        {data.weeklyStats.map((week, i) => (
                            <div
                                key={`${week.year}-${week.week}`}
                                className="flex-1 flex flex-col items-center gap-2"
                            >
                                <div className="text-xs text-gray-500">
                                    {Math.round(week.totalMinutes / 60)}h
                                </div>
                                <motion.div
                                    initial={{ height: 0 }}
                                    animate={{ height: `${(week.totalMinutes / maxWeeklyMinutes) * 100}%` }}
                                    transition={{ delay: 0.5 + i * 0.1 }}
                                    className="w-full bg-gradient-to-t from-red-600 to-red-400 rounded-t"
                                    style={{ minHeight: week.totalMinutes > 0 ? '8px' : '0' }}
                                />
                                <div className="text-xs text-gray-500 text-center">
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
                    className="p-6 bg-[#141414] border border-[#2a2a2a] rounded-lg"
                >
                    <h2 className="font-display font-bold text-lg mb-6 flex items-center gap-2">
                        <Users className="w-5 h-5 text-red-500" />
                        Répartition par grade
                    </h2>
                    <div className="space-y-4">
                        {data.gradeStats.map((grade, i) => (
                            <div key={grade.grade}>
                                <div className="flex justify-between items-center text-sm mb-1">
                                    <span className="font-medium" style={{ color: GRADE_COLORS[grade.grade] }}>
                                        {GRADE_LABELS[grade.grade] || grade.grade}
                                    </span>
                                    <span className="text-gray-400">
                                        ${grade.totalSalary.toLocaleString()} • {grade.employeeCount} emp.
                                    </span>
                                </div>
                                <div className="h-3 bg-[#0a0a0a] rounded-full overflow-hidden">
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
                className="p-6 bg-[#141414] border border-[#2a2a2a] rounded-lg"
            >
                <h2 className="font-display font-bold text-lg mb-6 flex items-center gap-2">
                    <Award className="w-5 h-5 text-yellow-400" />
                    Top 5 employés (par heures)
                </h2>
                <div className="grid grid-cols-5 gap-4">
                    {data.topEmployees.map((emp, i) => (
                        <div
                            key={i}
                            className="text-center p-4 bg-[#0a0a0a] rounded-lg border border-[#2a2a2a]"
                        >
                            <div className={`
                                w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center text-xl font-bold
                                ${i === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                                    i === 1 ? 'bg-gray-400/20 text-gray-300' :
                                        i === 2 ? 'bg-orange-600/20 text-orange-400' :
                                            'bg-[#1a1a1a] text-gray-500'}
                            `}>
                                {i + 1}
                            </div>
                            <p className="font-display font-bold text-sm truncate">{emp.name}</p>
                            <p className="text-xs text-gray-500 mb-2" style={{ color: GRADE_COLORS[emp.grade] }}>
                                {GRADE_LABELS[emp.grade] || emp.grade}
                            </p>
                            <p className="text-lg font-bold text-blue-400">
                                {Math.round(emp.totalMinutes / 60)}h
                            </p>
                            <p className="text-xs text-green-400">
                                ${emp.totalSalary.toLocaleString()}
                            </p>
                        </div>
                    ))}
                </div>
            </motion.div>
        </div>
    )
}
