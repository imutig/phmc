"use client"

import { motion } from "framer-motion"
import { ArrowLeft, Shield, AlertCircle, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react"
import Link from "next/link"
import { useSession, signIn } from "next-auth/react"
import { useEffect, useState, useCallback } from "react"
import { createClient } from "@supabase/supabase-js"
import { type ApplicationStatus } from "@/lib/types/database"

// Composants atomiques
import { StatsCards } from "@/components/admin/StatsCards"
import { ApplicationTable } from "@/components/admin/ApplicationTable"
import { FiltersBar } from "@/components/admin/FiltersBar"
import { StatsCharts } from "@/components/admin/StatsCharts"
import { DashboardSkeleton } from "@/components/ui/Skeleton"

interface Application {
    id: string
    service: 'EMS'
    status: ApplicationStatus
    first_name: string
    last_name: string
    created_at: string
    updated_at: string
    users?: { discord_username: string; avatar_url?: string }
    stats: {
        votes_pour: number
        votes_contre: number
        documents_count: number
        messages_count: number
    }
}

// Client Supabase pour le Realtime (côté client)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseClient = createClient(supabaseUrl, supabaseAnonKey)

export default function AdminPage() {
    const { status } = useSession()
    const [applications, setApplications] = useState<Application[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [filterStatus, setFilterStatus] = useState<string>('all')
    const [filterService, setFilterService] = useState<string>('all')
    const [searchQuery, setSearchQuery] = useState<string>('')
    const [statsData, setStatsData] = useState<any>(null)
    const [newAppFlash, setNewAppFlash] = useState<string | null>(null)

    // Pagination
    const [currentPage, setCurrentPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [totalCount, setTotalCount] = useState(0)
    const ITEMS_PER_PAGE = 20

    const fetchApplications = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            if (filterStatus !== 'all') params.append('status', filterStatus)
            if (filterService !== 'all') params.append('service', filterService)
            params.append('page', currentPage.toString())
            params.append('limit', ITEMS_PER_PAGE.toString())

            // Charger applications et stats en parallèle
            const [appsRes, statsRes] = await Promise.all([
                fetch(`/api/admin/applications?${params}`),
                fetch('/api/admin/stats')
            ])

            const [appsData, statsData] = await Promise.all([
                appsRes.json(),
                statsRes.ok ? statsRes.json() : null
            ])

            if (!appsRes.ok) {
                setError(appsData.error || "Erreur de chargement.")
                return
            }

            setApplications(appsData.applications)
            setTotalPages(appsData.totalPages || 1)
            setTotalCount(appsData.total || appsData.applications.length)
            setStatsData(statsData)
            setError(null)
        } catch {
            setError("Erreur de connexion au serveur.")
        } finally {
            setLoading(false)
        }
    }, [filterStatus, filterService, currentPage])

    useEffect(() => {
        if (status === "authenticated") {
            fetchApplications()
        } else if (status === "unauthenticated") {
            setLoading(false)
        }
    }, [status, fetchApplications])

    // Supabase Realtime pour les nouvelles candidatures
    useEffect(() => {
        if (status !== "authenticated") return

        const channel = supabaseClient
            .channel('admin-applications')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'applications' },
                (payload) => {
                    console.log('[Realtime] Nouvelle candidature:', payload)
                    setNewAppFlash(payload.new.id as string)
                    setTimeout(() => setNewAppFlash(null), 3000)
                    fetchApplications()
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'applications' },
                () => {
                    fetchApplications()
                }
            )
            .subscribe((status, err) => {
                console.log('[Realtime] Status:', status)
                if (err) console.error('[Realtime] Error:', err)
            })

        return () => {
            supabaseClient.removeChannel(channel)
        }
    }, [status, fetchApplications])

    if (status === "loading" || loading) {
        return (
            <>
                <div className="scan-overlay" />
                <div className="siren-bar">
                    <div className="siren-blue" />
                    <div className="siren-red" />
                </div>
                <main className="min-h-screen bg-[#0a0a0a] text-white">
                    <div className="container mx-auto px-4 py-8 max-w-7xl">
                        <DashboardSkeleton />
                    </div>
                </main>
            </>
        )
    }

    if (status === "unauthenticated") {
        return (
            <>
                <div className="scan-overlay" />
                <div className="siren-bar">
                    <div className="siren-blue" />
                    <div className="siren-red" />
                </div>
                <main className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        className="max-w-md w-full text-center p-8 border border-white/10 bg-white/[0.02] backdrop-blur-sm"
                    >
                        <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                        <h2 className="font-display text-2xl font-bold mb-2 uppercase">Accès Restreint</h2>
                        <p className="font-sans text-gray-400 mb-6">
                            Cette zone est réservée aux recruteurs.
                        </p>
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => signIn("discord", { callbackUrl: "/admin" })}
                            className="w-full flex items-center justify-center gap-3 bg-[#5865F2] hover:bg-[#4752C4] text-white py-4 px-6 font-display font-bold tracking-widest uppercase transition-all"
                        >
                            Se connecter avec Discord
                        </motion.button>
                    </motion.div>
                </main>
            </>
        )
    }

    // Statistiques
    const stats = {
        total: applications.length,
        pending: applications.filter(a => a.status === 'pending').length,
        reviewing: applications.filter(a => a.status === 'reviewing').length,
        recruited: applications.filter(a => a.status === 'recruited').length,
        rejected: applications.filter(a => a.status === 'rejected').length,
    }

    return (
        <>
            <div className="scan-overlay" />
            <div className="siren-bar">
                <div className="siren-blue" />
                <div className="siren-red" />
            </div>

            {/* Notification nouvelle candidature */}
            {newAppFlash && (
                <motion.div
                    initial={{ y: -100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -100, opacity: 0 }}
                    className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-6 py-3 bg-green-500/20 border border-green-500/50 backdrop-blur-sm"
                >
                    <p className="text-green-400 font-display font-bold tracking-widest text-sm">
                        ✨ NOUVELLE CANDIDATURE REÇUE
                    </p>
                </motion.div>
            )}

            {/* Navigation */}
            <nav className="fixed w-full z-40 py-6 px-8 border-b border-white/10 backdrop-blur-sm bg-black/50">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <Link href="/" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                        <span className="font-sans text-sm">Retour</span>
                    </Link>
                    <div className="flex items-center gap-6">
                        <Link
                            href="/admin/snippets"
                            className="text-gray-500 hover:text-white text-sm font-display uppercase tracking-wider transition-colors"
                        >
                            Snippets
                        </Link>
                        <div className="text-purple-400 font-display font-bold tracking-widest text-sm flex items-center gap-2">
                            <Shield className="w-4 h-4" />
                            PORTAIL ADMIN
                        </div>
                    </div>
                </div>
            </nav>

            <main className="min-h-screen bg-[#0a0a0a] text-white pt-32 pb-12 px-4">
                <div className="max-w-7xl mx-auto">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h1 className="font-display text-3xl font-bold uppercase tracking-tighter mb-2">
                                    Gestion des Candidatures
                                </h1>
                                <p className="font-sans text-gray-400">
                                    {stats.total} candidature(s) au total
                                </p>
                            </div>
                            <motion.button
                                whileHover={{ scale: 1.05, rotate: 180 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={fetchApplications}
                                className="p-3 border border-white/10 hover:bg-white/5 transition-colors"
                            >
                                <RefreshCw className="w-5 h-5" />
                            </motion.button>
                        </div>

                        {/* Stats Cards & Charts */}
                        {statsData ? (
                            <StatsCharts stats={statsData} />
                        ) : (
                            <StatsCards stats={stats} />
                        )}

                        {/* Filters */}
                        <FiltersBar
                            searchQuery={searchQuery}
                            onSearchChange={setSearchQuery}
                            filterStatus={filterStatus}
                            onStatusChange={setFilterStatus}
                            filterService={filterService}
                            onServiceChange={setFilterService}
                        />

                        {/* Error */}
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 flex items-start gap-3 font-sans"
                            >
                                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                <span>{error}</span>
                            </motion.div>
                        )}

                        {/* Table */}
                        <ApplicationTable
                            applications={applications}
                            searchQuery={searchQuery}
                        />

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-between mt-6 pt-6 border-t border-white/10">
                                <p className="text-sm text-gray-500 font-mono">
                                    Page {currentPage} sur {totalPages} ({totalCount} candidatures)
                                </p>
                                <div className="flex items-center gap-2">
                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className="p-2 border border-white/10 text-gray-400 hover:text-white hover:border-white/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                    >
                                        <ChevronLeft className="w-5 h-5" />
                                    </motion.button>

                                    {/* Page numbers */}
                                    <div className="flex gap-1">
                                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                            let pageNum: number
                                            if (totalPages <= 5) {
                                                pageNum = i + 1
                                            } else if (currentPage <= 3) {
                                                pageNum = i + 1
                                            } else if (currentPage >= totalPages - 2) {
                                                pageNum = totalPages - 4 + i
                                            } else {
                                                pageNum = currentPage - 2 + i
                                            }
                                            return (
                                                <button
                                                    key={pageNum}
                                                    onClick={() => setCurrentPage(pageNum)}
                                                    className={`px-3 py-1 text-sm font-mono transition-colors ${currentPage === pageNum
                                                        ? 'bg-white/10 text-white border border-white/20'
                                                        : 'text-gray-500 hover:text-white'
                                                        }`}
                                                >
                                                    {pageNum}
                                                </button>
                                            )
                                        })}
                                    </div>

                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages}
                                        className="p-2 border border-white/10 text-gray-400 hover:text-white hover:border-white/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                    >
                                        <ChevronRight className="w-5 h-5" />
                                    </motion.button>
                                </div>
                            </div>
                        )}
                    </motion.div>
                </div>
            </main>
        </>
    )
}
