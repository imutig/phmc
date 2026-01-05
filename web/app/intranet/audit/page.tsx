"use client"

import { useState, useEffect, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
    History, Search, Filter, ChevronLeft, ChevronRight,
    Plus, Edit, Trash2, RotateCcw, Calendar, User, Database,
    RefreshCw, X, Eye
} from "lucide-react"
import { useFetch, useDebounce } from "@/hooks"
import { Skeleton } from "@/components/ui/Skeleton"

interface AuditLog {
    id: string
    actor_discord_id: string
    actor_name: string | null
    actor_grade: string | null
    action: 'create' | 'update' | 'delete' | 'restore'
    table_name: string
    record_id: string | null
    old_data: Record<string, any> | null
    new_data: Record<string, any> | null
    created_at: string
}

interface Filters {
    tables: string[]
    actors: { actor_discord_id: string; actor_name: string | null }[]
    actions: string[]
}

const ACTION_COLORS: Record<string, { bg: string; text: string; icon: React.ElementType }> = {
    create: { bg: 'bg-green-500/10', text: 'text-green-400', icon: Plus },
    update: { bg: 'bg-blue-500/10', text: 'text-blue-400', icon: Edit },
    delete: { bg: 'bg-red-500/10', text: 'text-red-400', icon: Trash2 },
    restore: { bg: 'bg-purple-500/10', text: 'text-purple-400', icon: RotateCcw }
}

const TABLE_LABELS: Record<string, string> = {
    services: 'Services',
    events: 'Événements',
    prescriptions: 'Ordonnances',
    wiki_articles: 'Wiki',
    care_types: 'Tarifs',
    care_categories: 'Catégories de soins',
    medications: 'Médicaments',
    medical_exams: 'Examens médicaux (USI)',
    patients: 'Patients',
    users: 'Utilisateurs',
    permissions: 'Permissions',
    grades: 'Grades'
}

// Fonction pour formater le nom d'affichage avec l'ID Discord
function formatActorDisplay(name: string | null, discordId: string) {
    const displayName = name || 'Inconnu'
    return `${displayName} (${discordId})`
}

// Fonction pour comparer deux objets et retourner les différences
function getChangedKeys(oldData: Record<string, any> | null, newData: Record<string, any> | null): Set<string> {
    const changedKeys = new Set<string>()
    if (!oldData || !newData) return changedKeys

    const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)])

    for (const key of allKeys) {
        const oldVal = JSON.stringify(oldData[key])
        const newVal = JSON.stringify(newData[key])
        if (oldVal !== newVal) {
            changedKeys.add(key)
        }
    }

    return changedKeys
}

// Composant pour afficher les données avec highlighting des changements
function DataWithHighlight({
    data,
    changedKeys,
    type
}: {
    data: Record<string, any>;
    changedKeys: Set<string>;
    type: 'old' | 'new'
}) {
    const highlightColor = type === 'old' ? 'bg-red-500/30' : 'bg-green-500/30'

    return (
        <div className="space-y-1 font-mono text-xs">
            {Object.entries(data).map(([key, value]) => {
                const isChanged = changedKeys.has(key)
                const displayValue = typeof value === 'object' && value !== null
                    ? JSON.stringify(value, null, 2)
                    : String(value ?? 'null')

                return (
                    <div
                        key={key}
                        className={`px-2 py-1 rounded ${isChanged ? highlightColor : ''}`}
                    >
                        <span className="text-purple-400">{key}</span>
                        <span className="text-gray-500">: </span>
                        <span className={isChanged ? 'text-white font-medium' : 'text-gray-400'}>
                            {displayValue.length > 100 ? displayValue.slice(0, 100) + '...' : displayValue}
                        </span>
                    </div>
                )
            })}
        </div>
    )
}

export default function LogsPage() {
    const [page, setPage] = useState(1)
    const [search, setSearch] = useState('')
    const [tableFilter, setTableFilter] = useState<string>('')
    const [actionFilter, setActionFilter] = useState<string>('')
    const [actorFilter, setActorFilter] = useState<string>('')
    const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)

    const debouncedSearch = useDebounce(search, 300)

    // Construction de l'URL avec les filtres
    const buildUrl = () => {
        const params = new URLSearchParams()
        params.set('page', page.toString())
        params.set('limit', '30')
        if (debouncedSearch) params.set('search', debouncedSearch)
        if (tableFilter) params.set('table', tableFilter)
        if (actionFilter) params.set('action', actionFilter)
        if (actorFilter) params.set('actor', actorFilter)
        return `/api/admin/audit?${params.toString()}`
    }

    const { data, loading, error, refetch } = useFetch<{
        logs: AuditLog[]
        pagination: { page: number; limit: number; total: number; totalPages: number }
        filters: Filters
    }>(buildUrl(), { deps: [page, debouncedSearch, tableFilter, actionFilter, actorFilter] })

    const formatDate = (date: string) => {
        return new Date(date).toLocaleString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    const resetFilters = () => {
        setSearch('')
        setTableFilter('')
        setActionFilter('')
        setActorFilter('')
        setPage(1)
    }

    const hasActiveFilters = search || tableFilter || actionFilter || actorFilter

    // Calculer les changements pour le log sélectionné
    const selectedLogChanges = useMemo(() => {
        if (!selectedLog) return new Set<string>()
        return getChangedKeys(selectedLog.old_data, selectedLog.new_data)
    }, [selectedLog])

    return (
        <div className="py-4 md:py-8 space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="font-display text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
                        <History className="w-8 h-8 text-purple-400" />
                        Logs
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">
                        Historique de toutes les modifications
                    </p>
                </div>
                <button
                    onClick={() => refetch()}
                    className="flex items-center gap-2 px-4 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg hover:border-purple-500/50 transition-colors"
                >
                    <RefreshCw className="w-4 h-4" />
                    Actualiser
                </button>
            </div>

            {/* Filtres */}
            <div className="p-4 rounded-lg bg-[#141414] border border-[#2a2a2a]">
                <div className="flex flex-wrap items-center gap-3">
                    {/* Recherche */}
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Rechercher..."
                            className="w-full pl-10 pr-4 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
                        />
                    </div>

                    {/* Filtre Table */}
                    <select
                        value={tableFilter}
                        onChange={(e) => { setTableFilter(e.target.value); setPage(1) }}
                        className="px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
                    >
                        <option value="">Toutes les tables</option>
                        {data?.filters.tables.map(t => (
                            <option key={t} value={t}>{TABLE_LABELS[t] || t}</option>
                        ))}
                    </select>

                    {/* Filtre Action */}
                    <select
                        value={actionFilter}
                        onChange={(e) => { setActionFilter(e.target.value); setPage(1) }}
                        className="px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
                    >
                        <option value="">Toutes les actions</option>
                        <option value="create">Création</option>
                        <option value="update">Modification</option>
                        <option value="delete">Suppression</option>
                        <option value="restore">Restauration</option>
                    </select>

                    {/* Filtre Acteur - Affiche le displayName, filtre par discord_id */}
                    <select
                        value={actorFilter}
                        onChange={(e) => { setActorFilter(e.target.value); setPage(1) }}
                        className="px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
                    >
                        <option value="">Tous les utilisateurs</option>
                        {data?.filters.actors.map(a => (
                            <option key={a.actor_discord_id} value={a.actor_discord_id}>
                                {a.actor_name || a.actor_discord_id}
                            </option>
                        ))}
                    </select>

                    {hasActiveFilters && (
                        <button
                            onClick={resetFilters}
                            className="flex items-center gap-1 px-3 py-2 text-red-400 hover:text-red-300 text-sm"
                        >
                            <X className="w-4 h-4" />
                            Réinitialiser
                        </button>
                    )}
                </div>
            </div>

            {/* Stats */}
            {data && (
                <div className="text-sm text-gray-500">
                    {data.pagination.total} entrées trouvées
                </div>
            )}

            {/* Liste des logs */}
            {loading ? (
                <div className="space-y-2">
                    {[1, 2, 3, 4, 5].map(i => (
                        <Skeleton key={i} variant="card" />
                    ))}
                </div>
            ) : error ? (
                <div className="p-8 text-center text-red-400">
                    Erreur: {error}
                </div>
            ) : data?.logs.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                    <History className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Aucun log trouvé</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {data?.logs.map((log, index) => {
                        const actionStyle = ACTION_COLORS[log.action] || ACTION_COLORS.update
                        const ActionIcon = actionStyle.icon

                        return (
                            <motion.div
                                key={log.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.02 }}
                                className="p-4 rounded-lg bg-[#141414] border border-[#2a2a2a] hover:border-[#3a3a3a] transition-colors"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-start gap-3">
                                        {/* Icône action */}
                                        <div className={`p-2 rounded-lg ${actionStyle.bg}`}>
                                            <ActionIcon className={`w-4 h-4 ${actionStyle.text}`} />
                                        </div>

                                        <div>
                                            {/* Description */}
                                            <p className="text-white text-sm">
                                                <span className="font-medium">{log.actor_name || 'Inconnu'}</span>
                                                <span className="text-gray-600 text-xs ml-1">({log.actor_discord_id})</span>
                                                <span className="text-gray-400"> a </span>
                                                <span className={actionStyle.text}>
                                                    {log.action === 'create' && 'créé'}
                                                    {log.action === 'update' && 'modifié'}
                                                    {log.action === 'delete' && 'supprimé'}
                                                    {log.action === 'restore' && 'restauré'}
                                                </span>
                                                <span className="text-gray-400"> un enregistrement dans </span>
                                                <span className="text-purple-400 font-medium">
                                                    {TABLE_LABELS[log.table_name] || log.table_name}
                                                </span>
                                            </p>

                                            {/* Métadonnées */}
                                            <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                                                <span className="flex items-center gap-1">
                                                    <Calendar className="w-3 h-3" />
                                                    {formatDate(log.created_at)}
                                                </span>
                                                {log.record_id && (
                                                    <span className="font-mono text-gray-600">
                                                        ID: {log.record_id.slice(0, 8)}...
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Bouton détails */}
                                    {(log.old_data || log.new_data) && (
                                        <button
                                            onClick={() => setSelectedLog(log)}
                                            className="p-2 text-gray-400 hover:text-white hover:bg-[#2a2a2a] rounded-lg transition-colors"
                                        >
                                            <Eye className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </motion.div>
                        )
                    })}
                </div>
            )}

            {/* Pagination */}
            {data && data.pagination.totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="p-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:border-purple-500/50"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="px-4 py-2 text-sm text-gray-400">
                        Page {page} sur {data.pagination.totalPages}
                    </span>
                    <button
                        onClick={() => setPage(p => Math.min(data.pagination.totalPages, p + 1))}
                        disabled={page === data.pagination.totalPages}
                        className="p-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:border-purple-500/50"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Modal Détails avec highlighting des changements */}
            <AnimatePresence>
                {selectedLog && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
                        onClick={() => setSelectedLog(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.95 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0.95 }}
                            className="w-full max-w-3xl max-h-[80vh] overflow-auto bg-[#141414] border border-[#2a2a2a] rounded-lg p-6"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h2 className="font-display text-xl font-bold text-white">
                                        Détails du changement
                                    </h2>
                                    <p className="text-sm text-gray-500 mt-1">
                                        {formatActorDisplay(selectedLog.actor_name, selectedLog.actor_discord_id)}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setSelectedLog(null)}
                                    className="p-2 text-gray-400 hover:text-white"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Légende */}
                            {selectedLog.old_data && selectedLog.new_data && selectedLogChanges.size > 0 && (
                                <div className="flex items-center gap-4 mb-4 text-xs">
                                    <span className="flex items-center gap-2">
                                        <span className="w-3 h-3 rounded bg-red-500/30"></span>
                                        <span className="text-gray-400">Ancienne valeur</span>
                                    </span>
                                    <span className="flex items-center gap-2">
                                        <span className="w-3 h-3 rounded bg-green-500/30"></span>
                                        <span className="text-gray-400">Nouvelle valeur</span>
                                    </span>
                                    <span className="text-gray-600">
                                        ({selectedLogChanges.size} champ{selectedLogChanges.size > 1 ? 's' : ''} modifié{selectedLogChanges.size > 1 ? 's' : ''})
                                    </span>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {selectedLog.old_data && (
                                    <div>
                                        <h3 className="text-sm text-red-400 font-medium mb-2 flex items-center gap-2">
                                            <Trash2 className="w-4 h-4" />
                                            Avant
                                        </h3>
                                        <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-lg overflow-auto max-h-[400px]">
                                            <DataWithHighlight
                                                data={selectedLog.old_data}
                                                changedKeys={selectedLogChanges}
                                                type="old"
                                            />
                                        </div>
                                    </div>
                                )}

                                {selectedLog.new_data && (
                                    <div>
                                        <h3 className="text-sm text-green-400 font-medium mb-2 flex items-center gap-2">
                                            <Plus className="w-4 h-4" />
                                            Après
                                        </h3>
                                        <div className="p-4 bg-green-500/5 border border-green-500/20 rounded-lg overflow-auto max-h-[400px]">
                                            <DataWithHighlight
                                                data={selectedLog.new_data}
                                                changedKeys={selectedLogChanges}
                                                type="new"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
