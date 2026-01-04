"use client"

import { useState, useEffect, useCallback } from "react"
import { motion } from "framer-motion"
import { DollarSign, ChevronLeft, ChevronRight, Download, RefreshCw, Users, Gift, Check, Loader2 } from "lucide-react"
import { Breadcrumbs } from "@/components/ui/Breadcrumbs"
import { Skeleton } from "@/components/ui/Skeleton"

interface Employee {
    discordId: string
    name: string
    grade: string
    gradeDisplay: string
    totalMinutes: number
    totalSlots: number
    totalSalary: number
    maxWeekly: number
    remainingSalary: number
    hoursFormatted: string
    services: number
}

interface SalairesData {
    week: number
    year: number
    employees: Employee[]
    totals: {
        totalMinutes: number
        totalSlots: number
        totalSalary: number
        totalRemaining: number
        employeeCount: number
        hoursFormatted: string
    }
}

const GRADE_COLORS: Record<string, string> = {
    'Direction': 'text-red-400 bg-red-500/10',
    'Chirurgien': 'text-purple-400 bg-purple-500/10',
    'Médecin': 'text-blue-400 bg-blue-500/10',
    'Infirmier': 'text-green-400 bg-green-500/10',
    'Ambulancier': 'text-orange-400 bg-orange-500/10',
}

export default function SalairesPage() {
    const [data, setData] = useState<SalairesData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [week, setWeek] = useState<number | null>(null)
    const [year, setYear] = useState<number | null>(null)
    const [primes, setPrimes] = useState<Record<string, number>>({})
    const [savingPrime, setSavingPrime] = useState<string | null>(null)
    const [savedPrime, setSavedPrime] = useState<string | null>(null)

    const fetchPrimes = useCallback(async (w: number, y: number) => {
        try {
            const res = await fetch(`/api/intranet/salaires/primes?week=${w}&year=${y}`)
            if (res.ok) {
                const data = await res.json()
                setPrimes(data.primes || {})
            }
        } catch (e) {
            console.error('Erreur fetch primes:', e)
        }
    }, [])

    const fetchData = async (targetWeek?: number, targetYear?: number) => {
        setLoading(true)
        setError(null)
        try {
            const params = new URLSearchParams()
            if (targetWeek) params.set('week', targetWeek.toString())
            if (targetYear) params.set('year', targetYear.toString())

            const res = await fetch(`/api/intranet/salaires?${params}`)
            if (!res.ok) {
                const errData = await res.json()
                throw new Error(errData.error || 'Erreur lors du chargement')
            }
            const json = await res.json()
            setData(json)
            setWeek(json.week)
            setYear(json.year)
            // Charger les primes de la semaine
            await fetchPrimes(json.week, json.year)
        } catch (e: any) {
            setError(e.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
    }, [])

    const goToPreviousWeek = () => {
        if (!week || !year) return
        if (week === 1) {
            setWeek(52)
            setYear(year - 1)
            fetchData(52, year - 1)
        } else {
            setWeek(week - 1)
            fetchData(week - 1, year)
        }
    }

    const goToNextWeek = () => {
        if (!week || !year) return
        if (week === 52) {
            setWeek(1)
            setYear(year + 1)
            fetchData(1, year + 1)
        } else {
            setWeek(week + 1)
            fetchData(week + 1, year)
        }
    }

    const savePrime = async (discordId: string, value: number) => {
        if (!week || !year) return
        setSavingPrime(discordId)
        try {
            const res = await fetch('/api/intranet/salaires/primes', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ discordId, week, year, prime: value })
            })
            if (res.ok) {
                setSavedPrime(discordId)
                setTimeout(() => setSavedPrime(null), 1500)
            }
        } catch (e) {
            console.error('Erreur save prime:', e)
        } finally {
            setSavingPrime(null)
        }
    }

    const handlePrimeChange = (discordId: string, value: string) => {
        const numValue = parseInt(value.replace(/[^0-9]/g, '')) || 0
        setPrimes(prev => ({ ...prev, [discordId]: numValue }))
    }

    const handlePrimeBlur = (discordId: string) => {
        const value = primes[discordId] || 0
        savePrime(discordId, value)
    }

    const getTotalPrimes = () => Object.values(primes).reduce((sum, p) => sum + p, 0)

    const exportCSV = () => {
        if (!data) return
        const headers = ['Employé', 'Grade', 'Heures', 'Versements', 'Salaire', 'Prime', 'Reste à verser', 'Max']
        const rows = data.employees.map(e => {
            const prime = primes[e.discordId] || 0
            const resteAvecPrime = e.remainingSalary + prime
            return [
                e.name,
                e.gradeDisplay,
                e.hoursFormatted,
                e.totalSlots.toString(),
                `$${e.totalSalary.toLocaleString()}`,
                `$${prime.toLocaleString()}`,
                `$${resteAvecPrime.toLocaleString()}`,
                `$${e.maxWeekly.toLocaleString()}`
            ]
        })
        const tp = getTotalPrimes()
        rows.push(['TOTAL', '-', data.totals.hoursFormatted, data.totals.totalSlots.toString(),
            `$${data.totals.totalSalary.toLocaleString()}`, `$${tp.toLocaleString()}`,
            `$${(data.totals.totalRemaining + tp).toLocaleString()}`, '-'])

        const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
        const blob = new Blob([csv], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `salaires_S${week}_${year}.csv`
        a.click()
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <Breadcrumbs items={[{ label: "Intranet", href: "/intranet" }, { label: "Salaires" }]} />
                    <h1 className="font-display text-2xl font-bold mt-2 flex items-center gap-3">
                        <DollarSign className="w-6 h-6 text-green-500" />
                        Gestion des Salaires
                    </h1>
                </div>

                <div className="flex items-center gap-2">
                    <button onClick={goToPreviousWeek} className="p-2 hover:bg-white/10 rounded transition-colors" disabled={loading}>
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div className="px-4 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg min-w-[160px] text-center">
                        {week && year ? <span className="font-display font-bold">Semaine {week} • {year}</span> : <Skeleton className="h-5 w-24 mx-auto" />}
                    </div>
                    <button onClick={goToNextWeek} className="p-2 hover:bg-white/10 rounded transition-colors" disabled={loading}>
                        <ChevronRight className="w-5 h-5" />
                    </button>
                    <button onClick={() => fetchData(week!, year!)} className="p-2 hover:bg-white/10 rounded transition-colors ml-2" disabled={loading}>
                        <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors ml-2" disabled={loading || !data}>
                        <Download className="w-4 h-4" />
                        Export CSV
                    </button>
                </div>
            </div>

            {error && <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">{error}</div>}

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-[#141414] border border-[#2a2a2a] rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-[#1a1a1a] border-b border-[#2a2a2a]">
                                <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium">Employé</th>
                                <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium">Grade</th>
                                <th className="text-right px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium">Heures</th>
                                <th className="text-right px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium">Versements</th>
                                <th className="text-right px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium">Salaire</th>
                                <th className="text-center px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium"><Gift className="w-3 h-3 inline mr-1" />Prime</th>
                                <th className="text-right px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium">Reste à verser</th>
                                <th className="text-right px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium">Max</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="border-b border-[#2a2a2a]/50">
                                        {Array.from({ length: 8 }).map((_, j) => <td key={j} className="px-4 py-3"><Skeleton className="h-5 w-20" /></td>)}
                                    </tr>
                                ))
                            ) : data?.employees.length === 0 ? (
                                <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-500"><Users className="w-12 h-12 mx-auto mb-3 opacity-50" /><p>Aucun service cette semaine</p></td></tr>
                            ) : (
                                data?.employees.map((emp, index) => {
                                    const prime = primes[emp.discordId] || 0
                                    const resteAvecPrime = emp.remainingSalary + prime
                                    const isSaving = savingPrime === emp.discordId
                                    const isSaved = savedPrime === emp.discordId
                                    return (
                                        <motion.tr key={emp.discordId} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.05 }} className="border-b border-[#2a2a2a]/50 hover:bg-white/5 transition-colors">
                                            <td className="px-4 py-3 font-medium">{emp.name}</td>
                                            <td className="px-4 py-3"><span className={`px-2 py-1 rounded text-xs font-medium ${GRADE_COLORS[emp.gradeDisplay] || 'text-gray-400 bg-gray-500/10'}`}>{emp.gradeDisplay}</span></td>
                                            <td className="px-4 py-3 text-right font-mono">{emp.hoursFormatted}</td>
                                            <td className="px-4 py-3 text-right font-mono">{emp.totalSlots}</td>
                                            <td className="px-4 py-3 text-right font-mono text-green-400">${emp.totalSalary.toLocaleString()}</td>
                                            <td className="px-4 py-2 text-center">
                                                <div className="relative inline-flex items-center">
                                                    <span className="absolute left-2 text-purple-400 font-mono text-sm">$</span>
                                                    <input
                                                        type="text"
                                                        value={prime > 0 ? prime.toLocaleString() : ''}
                                                        onChange={(e) => handlePrimeChange(emp.discordId, e.target.value)}
                                                        onBlur={() => handlePrimeBlur(emp.discordId)}
                                                        placeholder="0"
                                                        className="w-24 bg-purple-500/10 border border-purple-500/30 rounded px-2 pl-5 py-1.5 text-right font-mono text-purple-400 text-sm focus:outline-none focus:border-purple-500/50 placeholder:text-purple-400/30"
                                                    />
                                                    {isSaving && <Loader2 className="absolute -right-6 w-4 h-4 text-purple-400 animate-spin" />}
                                                    {isSaved && <Check className="absolute -right-6 w-4 h-4 text-green-400" />}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono text-cyan-400 font-bold">${resteAvecPrime.toLocaleString()}</td>
                                            <td className="px-4 py-3 text-right font-mono text-gray-500">${emp.maxWeekly.toLocaleString()}</td>
                                        </motion.tr>
                                    )
                                })
                            )}
                        </tbody>
                        {data && data.employees.length > 0 && (
                            <tfoot>
                                <tr className="bg-[#1a1a1a] border-t-2 border-green-500/30 font-bold">
                                    <td className="px-4 py-4 text-green-400">TOTAL ({data.totals.employeeCount})</td>
                                    <td className="px-4 py-4">-</td>
                                    <td className="px-4 py-4 text-right font-mono">{data.totals.hoursFormatted}</td>
                                    <td className="px-4 py-4 text-right font-mono">{data.totals.totalSlots}</td>
                                    <td className="px-4 py-4 text-right font-mono text-green-400">${data.totals.totalSalary.toLocaleString()}</td>
                                    <td className="px-4 py-4 text-center font-mono text-purple-400">${getTotalPrimes().toLocaleString()}</td>
                                    <td className="px-4 py-4 text-right font-mono text-cyan-400">${(data.totals.totalRemaining + getTotalPrimes()).toLocaleString()}</td>
                                    <td className="px-4 py-4">-</td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </motion.div>

            <div className="text-xs text-gray-500 space-y-1">
                <p>💡 <strong>Versements</strong> = Intervalles de 15 min traversés</p>
                <p>💡 <strong>Reste à verser</strong> = (Max - Salaire déjà reçu) + Prime</p>
            </div>
        </div>
    )
}
