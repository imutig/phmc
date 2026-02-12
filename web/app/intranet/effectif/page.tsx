"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Users, Search, RefreshCw, Filter, ChevronDown, Check, UserPlus, Pencil, X, Save, Trash2 } from "lucide-react"
import { useToast } from "@/contexts/ToastContext"
import Image from "next/image"

interface Employee {
    id: string
    discordId: string
    displayName: string
    avatarUrl: string | null
    ign: string | null
    grade: string | null
    gradeInfo: { name: string; color: string; bgColor: string } | null
    lastSync: string
    createdAt: string
}

// Hiérarchie des grades (du plus haut au plus bas)
const GRADE_HIERARCHY = ['direction', 'chirurgien', 'medecin', 'infirmier', 'ambulancier']

// Infos des grades
const GRADE_INFOS: Record<string, { name: string; color: string; bgColor: string; borderColor: string }> = {
    direction: { name: 'Direction', color: 'text-red-400', bgColor: 'bg-red-500/20', borderColor: 'border-red-500/30' },
    chirurgien: { name: 'Chirurgien', color: 'text-purple-400', bgColor: 'bg-purple-500/20', borderColor: 'border-purple-500/30' },
    medecin: { name: 'Médecin', color: 'text-blue-400', bgColor: 'bg-blue-500/20', borderColor: 'border-blue-500/30' },
    infirmier: { name: 'Infirmier', color: 'text-green-400', bgColor: 'bg-green-500/20', borderColor: 'border-green-500/30' },
    ambulancier: { name: 'Ambulancier', color: 'text-orange-400', bgColor: 'bg-orange-500/20', borderColor: 'border-orange-500/30' }
}

// Avatar Component
function EmployeeAvatar({ avatarUrl, displayName }: { avatarUrl: string | null; displayName: string }) {
    if (!avatarUrl) {
        return (
            <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-gray-400 font-medium">
                {displayName.charAt(0).toUpperCase()}
            </div>
        )
    }
    return (
        <Image
            src={avatarUrl}
            alt={displayName}
            width={40}
            height={40}
            className="rounded-full object-cover"
        />
    )
}

// Composant ligne employé
function EmployeeRow({
    employee,
    onSync,
    onDelete,
    onUpdateIGN,
    syncingId
}: {
    employee: Employee
    onSync: (discordId: string) => void
    onDelete: (discordId: string, displayName: string) => void
    onUpdateIGN: (discordId: string, ign: string) => Promise<void>
    syncingId: string | null
}) {
    const [editingIGN, setEditingIGN] = useState(false)
    const [ignValue, setIgnValue] = useState(employee.ign || '')
    const [saving, setSaving] = useState(false)

    const handleSaveIGN = async () => {
        setSaving(true)
        await onUpdateIGN(employee.discordId, ignValue)
        setSaving(false)
        setEditingIGN(false)
    }

    const handleCancelEdit = () => {
        setIgnValue(employee.ign || '')
        setEditingIGN(false)
    }

    return (
        <tr className="hover:bg-[#1a1a1a] transition-colors border-b border-[#2a2a2a] last:border-b-0">
            {/* Employé */}
            <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                    <EmployeeAvatar avatarUrl={employee.avatarUrl} displayName={employee.displayName} />
                    <div>
                        <p className="font-medium text-white">{employee.displayName}</p>
                        <p className="text-xs text-gray-500">ID: {employee.discordId}</p>
                    </div>
                </div>
            </td>

            {/* IGN - Éditable */}
            <td className="px-4 py-3">
                {editingIGN ? (
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            value={ignValue}
                            onChange={(e) => setIgnValue(e.target.value)}
                            placeholder="Entrer IGN..."
                            className="px-2 py-1 text-sm bg-[#0a0a0a] border border-[#3a3a3a] rounded text-white placeholder-gray-500 focus:outline-none focus:border-red-500/50 w-32"
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveIGN()
                                if (e.key === 'Escape') handleCancelEdit()
                            }}
                        />
                        <button
                            onClick={handleSaveIGN}
                            disabled={saving}
                            className="p-1 text-green-400 hover:bg-green-500/20 rounded transition-colors"
                        >
                            <Save className={`w-4 h-4 ${saving ? 'animate-pulse' : ''}`} />
                        </button>
                        <button
                            onClick={handleCancelEdit}
                            className="p-1 text-gray-400 hover:bg-gray-500/20 rounded transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 group">
                        <span className={`text-sm ${employee.ign ? 'text-gray-300' : 'text-gray-600 italic'}`}>
                            {employee.ign || 'Non défini'}
                        </span>
                        <button
                            onClick={() => setEditingIGN(true)}
                            className="p-1 text-gray-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Modifier l'IGN"
                        >
                            <Pencil className="w-3 h-3" />
                        </button>
                    </div>
                )}
            </td>

            {/* Dernière synchro */}
            <td className="px-4 py-3">
                {employee.lastSync ? (
                    <span className="text-sm text-gray-400">
                        {new Date(employee.lastSync).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                        })}
                    </span>
                ) : (
                    <span className="text-gray-600 italic text-sm">Jamais</span>
                )}
            </td>

            {/* Actions */}
            <td className="px-4 py-3 text-right">
                <div className="inline-flex items-center gap-2">
                    <button
                        onClick={() => onSync(employee.discordId)}
                        disabled={syncingId === employee.discordId}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${syncingId === employee.discordId ? 'animate-spin' : ''}`} />
                        {syncingId === employee.discordId ? 'Synchro...' : 'Sync'}
                    </button>
                    <button
                        onClick={() => onDelete(employee.discordId, employee.displayName)}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-500/10 text-gray-300 hover:bg-red-500/20 hover:text-red-300 transition-colors text-sm"
                        title="Supprimer cet employé"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                        Supprimer
                    </button>
                </div>
            </td>
        </tr>
    )
}

export default function EffectifPage() {
    const toast = useToast()
    const [employees, setEmployees] = useState<Employee[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")
    const [gradeFilter, setGradeFilter] = useState<string | null>(null)
    const [syncingId, setSyncingId] = useState<string | null>(null)
    const [syncingAll, setSyncingAll] = useState(false)
    const [showFilters, setShowFilters] = useState(false)

    // Charger les employés
    useEffect(() => {
        loadEmployees()
    }, [])

    async function loadEmployees() {
        try {
            const res = await fetch('/api/admin/employees')
            if (res.ok) {
                const data = await res.json()
                setEmployees(data.employees || [])
            } else if (res.status === 403) {
                toast.error("Vous n'avez pas la permission d'accéder à cette page")
            } else {
                toast.error("Impossible de charger les employés")
            }
        } catch (e) {
            console.error('Erreur chargement employés:', e)
            toast.error("Erreur de connexion")
        }
        setLoading(false)
    }

    // Synchroniser un employé
    async function syncEmployee(discordId: string) {
        setSyncingId(discordId)
        try {
            const res = await fetch(`/api/admin/employees/${discordId}/sync`, { method: 'POST' })
            if (res.ok) {
                const data = await res.json()
                setEmployees(prev => prev.map(emp =>
                    emp.discordId === discordId
                        ? {
                            ...emp,
                            displayName: data.data.displayName,
                            avatarUrl: data.data.avatarUrl,
                            grade: data.data.grade,
                            gradeInfo: data.data.grade ? GRADE_INFOS[data.data.grade] || null : null,
                            lastSync: data.data.syncedAt
                        }
                        : emp
                ))
                toast.success(`${data.data.displayName} synchronisé`)
            } else {
                const error = await res.json()
                toast.error(error.error || "Erreur lors de la synchronisation")
            }
        } catch (e) {
            console.error('Erreur sync:', e)
            toast.error("Erreur de connexion")
        }
        setSyncingId(null)
    }

    // Synchroniser tout l'effectif
    async function syncAllEmployees() {
        setSyncingAll(true)
        try {
            const res = await fetch('/api/admin/employees/sync-all', { method: 'POST' })
            if (res.ok) {
                const data = await res.json()
                toast.success(`${data.newMembersAdded} nouveaux membres ajoutés`)
                loadEmployees()
            } else {
                const error = await res.json()
                toast.error(error.error || "Erreur lors de la synchronisation")
            }
        } catch (e) {
            console.error('Erreur sync all:', e)
            toast.error("Erreur de connexion")
        }
        setSyncingAll(false)
    }

    // Mettre à jour l'IGN
    async function updateIGN(discordId: string, ign: string) {
        try {
            const res = await fetch(`/api/admin/employees/${discordId}/ign`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ign })
            })
            if (res.ok) {
                setEmployees(prev => prev.map(emp =>
                    emp.discordId === discordId ? { ...emp, ign: ign || null } : emp
                ))
                toast.success("IGN mis à jour")
            } else {
                const error = await res.json()
                toast.error(error.error || "Erreur lors de la mise à jour")
            }
        } catch (e) {
            console.error('Erreur update IGN:', e)
            toast.error("Erreur de connexion")
        }
    }

    async function deleteEmployee(discordId: string, displayName: string) {
        const confirmed = window.confirm(`Supprimer ${displayName} de l'effectif ?`)
        if (!confirmed) return

        try {
            const res = await fetch(`/api/admin/employees/${discordId}`, { method: 'DELETE' })

            if (res.ok) {
                setEmployees(prev => prev.filter(emp => emp.discordId !== discordId))
                toast.success(`${displayName} supprimé`)
            } else {
                const error = await res.json()
                toast.error(error.error || "Erreur lors de la suppression")
            }
        } catch (e) {
            console.error('Erreur suppression employé:', e)
            toast.error("Erreur de connexion")
        }
    }

    // Filtrer les employés
    const filteredEmployees = employees.filter(emp => {
        const matchesSearch = !searchQuery ||
            emp.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (emp.ign?.toLowerCase().includes(searchQuery.toLowerCase()))
        const matchesGrade = !gradeFilter || emp.grade === gradeFilter
        return matchesSearch && matchesGrade
    })

    // Grouper par grade selon la hiérarchie
    const groupedEmployees = GRADE_HIERARCHY.map(grade => ({
        grade,
        info: GRADE_INFOS[grade],
        employees: filteredEmployees.filter(emp => emp.grade === grade)
    })).filter(group => group.employees.length > 0)

    // Employés sans grade
    const employeesWithoutGrade = filteredEmployees.filter(emp => !emp.grade || !GRADE_HIERARCHY.includes(emp.grade))

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-red-500 border-t-transparent" />
            </div>
        )
    }

    return (
        <div className="py-4 md:py-8 space-y-6">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
            >
                <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                        <Users className="w-6 h-6 text-red-400" />
                    </div>
                    <div>
                        <h1 className="font-display text-2xl md:text-3xl font-bold text-white">
                            Effectif
                        </h1>
                        <p className="text-gray-500 text-sm">
                            {employees.length} membre{employees.length > 1 ? 's' : ''}
                        </p>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={syncAllEmployees}
                        disabled={syncingAll}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <UserPlus className={`w-4 h-4 ${syncingAll ? 'animate-pulse' : ''}`} />
                        {syncingAll ? 'Synchronisation...' : 'Importer depuis Discord'}
                    </button>
                    <button
                        onClick={loadEmployees}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-gray-300 hover:text-white hover:border-red-500/50 transition-colors"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Actualiser
                    </button>
                </div>
            </motion.div>

            {/* Filters Bar */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="flex flex-col md:flex-row gap-4"
            >
                {/* Search */}
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                        type="text"
                        placeholder="Rechercher par nom ou IGN..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-white placeholder-gray-500 focus:outline-none focus:border-red-500/50"
                    />
                </div>

                {/* Grade Filter */}
                <div className="relative">
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-gray-300 hover:text-white transition-colors"
                    >
                        <Filter className="w-4 h-4" />
                        {gradeFilter ? GRADE_INFOS[gradeFilter]?.name || gradeFilter : 'Tous les grades'}
                        <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                    </button>

                    <AnimatePresence>
                        {showFilters && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="absolute top-full mt-2 right-0 w-48 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-xl z-10 overflow-hidden"
                            >
                                <button
                                    onClick={() => { setGradeFilter(null); setShowFilters(false) }}
                                    className={`w-full px-4 py-2 text-left text-sm hover:bg-[#2a2a2a] flex items-center justify-between ${!gradeFilter ? 'text-red-400' : 'text-gray-300'}`}
                                >
                                    Tous les grades
                                    {!gradeFilter && <Check className="w-4 h-4" />}
                                </button>
                                {GRADE_HIERARCHY.map(grade => {
                                    const info = GRADE_INFOS[grade]
                                    return (
                                        <button
                                            key={grade}
                                            onClick={() => { setGradeFilter(grade); setShowFilters(false) }}
                                            className={`w-full px-4 py-2 text-left text-sm hover:bg-[#2a2a2a] flex items-center justify-between ${gradeFilter === grade ? 'text-red-400' : 'text-gray-300'}`}
                                        >
                                            {info?.name || grade}
                                            {gradeFilter === grade && <Check className="w-4 h-4" />}
                                        </button>
                                    )
                                })}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>

            {/* Tables par grade */}
            <div className="space-y-6">
                {groupedEmployees.map(({ grade, info, employees: gradeEmployees }) => (
                    <motion.div
                        key={grade}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-xl overflow-hidden border border-[#2a2a2a]"
                    >
                        {/* Grade Header */}
                        <div className={`px-4 py-3 ${info.bgColor} border-b ${info.borderColor}`}>
                            <span className={`font-display font-bold uppercase tracking-wider ${info.color}`}>
                                {info.name}
                            </span>
                            <span className="text-sm text-gray-400 ml-2">
                                ({gradeEmployees.length})
                            </span>
                        </div>

                        {/* Table */}
                        <table className="w-full bg-[#141414]">
                            <thead>
                                <tr className="border-b border-[#2a2a2a]">
                                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Membre</th>
                                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">IGN</th>
                                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Dernière synchro</th>
                                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {gradeEmployees.map(employee => (
                                    <EmployeeRow
                                        key={employee.id}
                                        employee={employee}
                                        onSync={syncEmployee}
                                        onDelete={deleteEmployee}
                                        onUpdateIGN={updateIGN}
                                        syncingId={syncingId}
                                    />
                                ))}
                            </tbody>
                        </table>
                    </motion.div>
                ))}

                {/* Employés sans grade */}
                {employeesWithoutGrade.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-xl overflow-hidden border border-[#2a2a2a]"
                    >
                        <div className="px-4 py-3 bg-gray-500/10 border-b border-gray-500/20">
                            <span className="font-display font-bold uppercase tracking-wider text-gray-400">
                                Non assigné
                            </span>
                            <span className="text-sm text-gray-500 ml-2">
                                ({employeesWithoutGrade.length})
                            </span>
                        </div>

                        <table className="w-full bg-[#141414]">
                            <thead>
                                <tr className="border-b border-[#2a2a2a]">
                                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Membre</th>
                                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">IGN</th>
                                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Dernière synchro</th>
                                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {employeesWithoutGrade.map(employee => (
                                    <EmployeeRow
                                        key={employee.id}
                                        employee={employee}
                                        onSync={syncEmployee}
                                        onDelete={deleteEmployee}
                                        onUpdateIGN={updateIGN}
                                        syncingId={syncingId}
                                    />
                                ))}
                            </tbody>
                        </table>
                    </motion.div>
                )}

                {/* Empty state */}
                {filteredEmployees.length === 0 && (
                    <div className="text-center py-12 text-gray-500 bg-[#141414] rounded-xl border border-[#2a2a2a]">
                        {searchQuery || gradeFilter ? 'Aucun employé trouvé avec ces critères' : 'Aucun employé enregistré'}
                    </div>
                )}
            </div>
        </div>
    )
}
