"use client"

import { useState, useEffect, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Shield, Loader2, Check, X, RefreshCw, ChevronDown, ChevronRight, Info, AlertCircle } from "lucide-react"
import { Breadcrumbs } from "@/components/ui/Breadcrumbs"
import { useToast } from "@/contexts/ToastContext"
import {
    ALL_PERMISSIONS,
    PERMISSION_CATEGORIES,
    GRADE_HIERARCHY,
    GRADE_INFO,
    getPermissionsByCategory,
    getDefaultPermissionsForGrade,
    type GradeType,
    type PermissionDefinition
} from "@/lib/permissions"

interface PermissionState {
    [grade: string]: {
        [permissionKey: string]: boolean
    }
}

export default function PermissionsPage() {
    const [permissions, setPermissions] = useState<PermissionState>({})
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState<string | null>(null)
    const [error, setError] = useState("")
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(PERMISSION_CATEGORIES.map(c => c.id)))
    const [selectedGrade, setSelectedGrade] = useState<GradeType>('chirurgien')
    const toast = useToast()

    const permissionsByCategory = useMemo(() => getPermissionsByCategory(), [])

    useEffect(() => {
        fetchPermissions()
    }, [])

    const fetchPermissions = async () => {
        setLoading(true)
        setError("")
        try {
            const res = await fetch('/api/intranet/permissions')
            if (res.ok) {
                const data = await res.json()
                setPermissions(data.permissions || {})
            } else if (res.status === 403) {
                setError("Accès réservé à la Direction")
            } else {
                setError("Erreur de chargement")
            }
        } catch (e) {
            setError("Erreur réseau")
        } finally {
            setLoading(false)
        }
    }

    const handleTogglePermission = async (grade: GradeType, permKey: string, currentValue: boolean) => {
        if (grade === 'direction') {
            toast.error("Impossible de modifier les permissions de la Direction")
            return
        }

        const key = `${grade}-${permKey}`
        setSaving(key)

        try {
            const res = await fetch('/api/intranet/permissions', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    grade,
                    permission_key: permKey,
                    granted: !currentValue
                })
            })

            if (res.ok) {
                setPermissions(prev => ({
                    ...prev,
                    [grade]: {
                        ...prev[grade],
                        [permKey]: !currentValue
                    }
                }))
                toast.success("Permission modifiée")
            } else {
                const data = await res.json()
                toast.error(data.error || "Erreur")
            }
        } catch (e) {
            toast.error("Erreur réseau")
        } finally {
            setSaving(null)
        }
    }

    const handleResetGrade = async (grade: GradeType) => {
        if (grade === 'direction') return
        if (!confirm(`Réinitialiser toutes les permissions de ${GRADE_INFO[grade].name} aux valeurs par défaut ?`)) return

        setSaving(`reset-${grade}`)
        try {
            const res = await fetch('/api/intranet/permissions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ grade, reset: true })
            })

            if (res.ok) {
                // Recharger les permissions
                await fetchPermissions()
                toast.success(`Permissions de ${GRADE_INFO[grade].name} réinitialisées`)
            } else {
                const data = await res.json()
                toast.error(data.error || "Erreur")
            }
        } catch (e) {
            toast.error("Erreur réseau")
        } finally {
            setSaving(null)
        }
    }

    const toggleCategory = (categoryId: string) => {
        setExpandedCategories(prev => {
            const next = new Set(prev)
            if (next.has(categoryId)) {
                next.delete(categoryId)
            } else {
                next.add(categoryId)
            }
            return next
        })
    }

    const getPermissionValue = (grade: GradeType, permKey: string): boolean => {
        return permissions[grade]?.[permKey] ?? getDefaultPermissionsForGrade(grade)[permKey] ?? false
    }

    const isModified = (grade: GradeType, permKey: string): boolean => {
        const defaultValue = getDefaultPermissionsForGrade(grade)[permKey]
        const currentValue = getPermissionValue(grade, permKey)
        return defaultValue !== currentValue
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
                    <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                    {error}
                </div>
            </div>
        )
    }

    return (
        <div className="py-4 md:p-8">
            <Breadcrumbs items={[{ label: "Permissions" }]} />

            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6"
            >
                <div className="flex items-center gap-3 mb-2">
                    <Shield className="w-6 md:w-8 h-6 md:h-8 text-red-500" />
                    <h1 className="font-display text-2xl md:text-3xl font-bold uppercase tracking-tight">
                        Permissions
                    </h1>
                </div>
                <p className="text-gray-400 font-sans text-sm md:text-base">
                    Configurez les droits d'accès pour chaque grade
                </p>
            </motion.div>

            {/* Sélecteur de grade */}
            <div className="flex flex-wrap gap-2 mb-6">
                {GRADE_HIERARCHY.map(grade => (
                    <button
                        key={grade}
                        onClick={() => setSelectedGrade(grade)}
                        disabled={grade === 'direction'}
                        className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${selectedGrade === grade
                                ? `${GRADE_INFO[grade].bgColor} ${GRADE_INFO[grade].color} ring-2 ring-current`
                                : grade === 'direction'
                                    ? 'bg-red-500/10 text-red-400/50 cursor-not-allowed'
                                    : 'bg-[#1a1a1a] text-gray-400 hover:text-white hover:bg-[#2a2a2a]'
                            }`}
                    >
                        {GRADE_INFO[grade].name}
                        {grade === 'direction' && (
                            <span className="ml-2 text-[10px] opacity-60">(Tous droits)</span>
                        )}
                    </button>
                ))}
            </div>

            {/* Bouton réinitialiser */}
            {selectedGrade !== 'direction' && (
                <div className="flex justify-end mb-4">
                    <button
                        onClick={() => handleResetGrade(selectedGrade)}
                        disabled={saving?.startsWith('reset')}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white bg-[#1a1a1a] hover:bg-[#2a2a2a] rounded-lg transition-colors"
                    >
                        {saving === `reset-${selectedGrade}` ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <RefreshCw className="w-4 h-4" />
                        )}
                        Réinitialiser par défaut
                    </button>
                </div>
            )}

            {/* Catégories et permissions */}
            <div className="space-y-4">
                {PERMISSION_CATEGORIES.map(category => {
                    const categoryPerms = permissionsByCategory[category.id] || []
                    const isExpanded = expandedCategories.has(category.id)
                    const grantedCount = categoryPerms.filter(p => getPermissionValue(selectedGrade, p.key)).length

                    return (
                        <motion.div
                            key={category.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-[#141414] border border-[#2a2a2a] rounded-lg overflow-hidden"
                        >
                            {/* Header catégorie */}
                            <button
                                onClick={() => toggleCategory(category.id)}
                                className="w-full p-4 flex items-center justify-between hover:bg-[#1a1a1a] transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">{category.icon}</span>
                                    <div className="text-left">
                                        <h3 className="font-display font-bold">{category.label}</h3>
                                        <p className="text-xs text-gray-500">{category.description}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs text-gray-500">
                                        {grantedCount}/{categoryPerms.length} actives
                                    </span>
                                    {isExpanded ? (
                                        <ChevronDown className="w-5 h-5 text-gray-500" />
                                    ) : (
                                        <ChevronRight className="w-5 h-5 text-gray-500" />
                                    )}
                                </div>
                            </button>

                            {/* Liste des permissions */}
                            <AnimatePresence>
                                {isExpanded && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        <div className="border-t border-[#2a2a2a]">
                                            {categoryPerms.map((perm, idx) => {
                                                const isGranted = getPermissionValue(selectedGrade, perm.key)
                                                const modified = isModified(selectedGrade, perm.key)
                                                const isSaving = saving === `${selectedGrade}-${perm.key}`
                                                const isDirection = selectedGrade === 'direction'

                                                return (
                                                    <div
                                                        key={perm.key}
                                                        className={`p-4 flex items-center justify-between ${idx < categoryPerms.length - 1 ? 'border-b border-[#2a2a2a]' : ''
                                                            } ${isDirection ? 'opacity-60' : ''}`}
                                                    >
                                                        <div className="flex-1 pr-4">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-medium">{perm.label}</span>
                                                                {modified && (
                                                                    <span className="text-[10px] px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded">
                                                                        Modifié
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="text-xs text-gray-500 mt-0.5">{perm.description}</p>
                                                        </div>
                                                        <button
                                                            onClick={() => handleTogglePermission(selectedGrade, perm.key, isGranted)}
                                                            disabled={isSaving || isDirection}
                                                            className={`relative w-14 h-8 rounded-full transition-colors ${isGranted
                                                                    ? 'bg-green-500'
                                                                    : 'bg-gray-700'
                                                                } ${isDirection ? 'cursor-not-allowed' : ''}`}
                                                        >
                                                            {isSaving ? (
                                                                <div className="absolute inset-0 flex items-center justify-center">
                                                                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                                                                </div>
                                                            ) : (
                                                                <motion.div
                                                                    className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow-md flex items-center justify-center`}
                                                                    animate={{ left: isGranted ? 'calc(100% - 28px)' : '4px' }}
                                                                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                                                                >
                                                                    {isGranted ? (
                                                                        <Check className="w-3 h-3 text-green-500" />
                                                                    ) : (
                                                                        <X className="w-3 h-3 text-gray-400" />
                                                                    )}
                                                                </motion.div>
                                                            )}
                                                        </button>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    )
                })}
            </div>

            {/* Info box */}
            <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-300">
                    <p className="font-bold mb-1">Comment ça marche ?</p>
                    <ul className="list-disc list-inside text-blue-300/80 space-y-1">
                        <li>La <strong>Direction</strong> a toujours toutes les permissions (non modifiable)</li>
                        <li>Les permissions <span className="text-yellow-400">Modifié</span> diffèrent des valeurs par défaut</li>
                        <li>Utilisez "Réinitialiser par défaut" pour revenir aux permissions d'origine</li>
                    </ul>
                </div>
            </div>
        </div>
    )
}
