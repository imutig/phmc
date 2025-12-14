"use client"

import { motion } from "framer-motion"
import { ArrowLeft, Shield, AlertCircle, RefreshCw, ChevronLeft, ChevronRight, Users } from "lucide-react"
import { useSession, signIn } from "next-auth/react"
import { useEffect, useState, useCallback } from "react"
import { createClient } from "@supabase/supabase-js"
import { type ApplicationStatus } from "@/lib/types/database"

// Composants atomiques
import { StatsCards } from "@/components/admin/StatsCards"
import { ApplicationTable } from "@/components/admin/ApplicationTable"
import { FiltersBar } from "@/components/admin/FiltersBar"
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

export default function CandidaturesPage() {
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

            setApplications(appsData.applications || [])
            setTotalPages(appsData.totalPages || 1)
            setTotalCount(appsData.totalCount || 0)
            setStatsData(statsData)
            setError(null)
        } catch (err) {
            console.error('Fetch error:', err)
            setError("Erreur de connexion au serveur.")
        } finally {
            setLoading(false)
        }
    }, [filterStatus, filterService, currentPage])

    // Realtime subscription
    useEffect(() => {
        const channel = supabaseClient
            .channel('admin-candidatures')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'applications' },
                (payload) => {
                    console.log('[Realtime] Change:', payload)
                    if (payload.eventType === 'INSERT') {
                        // @ts-ignore Type du payload
                        setNewAppFlash(payload.new?.id || null)
                        setTimeout(() => setNewAppFlash(null), 3000)
                    }
                    fetchApplications()
                }
            )
            .subscribe()

        return () => {
            supabaseClient.removeChannel(channel)
        }
    }, [fetchApplications])

    // Initial load + filter changes
    useEffect(() => {
        if (status === 'authenticated') {
            fetchApplications()
        }
    }, [status, fetchApplications])

    // Reset page on filter change
    useEffect(() => {
        setCurrentPage(1)
    }, [filterStatus, filterService])

    // Filtrer par recherche (côté client)
    const filteredApplications = applications.filter(app => {
        if (!searchQuery) return true
        const query = searchQuery.toLowerCase()
        const fullName = `${app.first_name} ${app.last_name}`.toLowerCase()
        const discord = (app.users?.discord_username || '').toLowerCase()
        return fullName.includes(query) || discord.includes(query)
    })

    if (status === 'loading') {
        return <DashboardSkeleton />
    }

    if (status === 'unauthenticated') {
        return (
            <div className="min-h-screen flex items-center justify-center p-8">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center max-w-md"
                >
                    <Shield className="w-16 h-16 mx-auto mb-4 text-emerald-500" />
                    <h1 className="font-display text-2xl font-bold mb-2">Accès Restreint</h1>
                    <p className="text-gray-400 mb-6">Connectez-vous pour accéder à la gestion des candidatures.</p>
                    <button
                        onClick={() => signIn('discord')}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 font-display font-bold tracking-widest uppercase transition-colors"
                    >
                        Connexion Discord
                    </button>
                </motion.div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center p-8">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center max-w-md"
                >
                    <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
                    <h1 className="font-display text-2xl font-bold mb-2">Erreur</h1>
                    <p className="text-gray-400 mb-6">{error}</p>
                    <button
                        onClick={() => fetchApplications()}
                        className="bg-white/10 hover:bg-white/20 text-white px-6 py-3 font-display font-bold tracking-widest uppercase transition-colors"
                    >
                        Réessayer
                    </button>
                </motion.div>
            </div>
        )
    }

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
                        <Users className="w-8 h-8 text-purple-500" />
                        <h1 className="font-display text-3xl font-bold uppercase tracking-tight">
                            Candidatures
                        </h1>
                    </div>
                    <p className="text-gray-400 font-sans">
                        Gestion des candidatures EMS — {totalCount} dossier{totalCount > 1 ? 's' : ''}
                    </p>
                </div>
                <button
                    onClick={() => fetchApplications()}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 border border-white/10 hover:bg-white/5 transition-colors disabled:opacity-50"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Actualiser
                </button>
            </motion.div>



            {/* Stats Cards */}
            {!loading && (
                <StatsCards stats={{
                    total: applications.length,
                    pending: applications.filter(a => a.status === 'pending').length,
                    reviewing: applications.filter(a => a.status === 'reviewing').length,
                    recruited: applications.filter(a => a.status === 'recruited').length,
                    rejected: applications.filter(a => a.status === 'rejected').length,
                }} />
            )}

            {/* Filters */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
            >
                <FiltersBar
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    filterStatus={filterStatus}
                    onStatusChange={setFilterStatus}
                    filterService={filterService}
                    onServiceChange={setFilterService}
                />
            </motion.div>

            {/* New application flash */}
            {newAppFlash && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mb-4 p-3 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-sm"
                >
                    🆕 Nouvelle candidature reçue!
                </motion.div>
            )}

            {/* Table */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
            >
                {loading ? (
                    <DashboardSkeleton />
                ) : (
                    <ApplicationTable
                        applications={filteredApplications}
                        searchQuery={searchQuery}
                    />
                )}
            </motion.div>

            {/* Pagination */}
            {totalPages > 1 && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center justify-center gap-4 mt-6"
                >
                    <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="p-2 border border-white/10 hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="font-mono text-sm text-gray-400">
                        Page {currentPage} / {totalPages}
                    </span>
                    <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="p-2 border border-white/10 hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </motion.div>
            )}
        </div>
    )
}
