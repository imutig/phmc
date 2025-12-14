"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Pill, Plus, Edit2, Trash2, Search, Loader2, ChevronDown, Clock, AlertTriangle } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import { Breadcrumbs } from "@/components/ui/Breadcrumbs"
import { useToast } from "@/contexts/ToastContext"

interface Medication {
    id: string
    name: string
    dosage?: string
    duration?: string
    effects?: string
    side_effects?: string
}

export default function MedicamentsPage() {
    const [medications, setMedications] = useState<Medication[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")
    const [expandedMed, setExpandedMed] = useState<string | null>(null)

    // Permissions : seuls direction/supervision peuvent éditer
    const [canEdit, setCanEdit] = useState(false)

    // Modals
    const [isAddOpen, setIsAddOpen] = useState(false)
    const [editingMed, setEditingMed] = useState<Medication | null>(null)

    // Form
    const [formName, setFormName] = useState("")
    const [formDosage, setFormDosage] = useState("")
    const [formDuration, setFormDuration] = useState("")
    const [formEffects, setFormEffects] = useState("")
    const [formSideEffects, setFormSideEffects] = useState("")

    useEffect(() => {
        fetchMedications()
        fetchPermissions()
    }, [])

    const fetchPermissions = async () => {
        try {
            const res = await fetch('/api/user/roles')
            if (res.ok) {
                const data = await res.json()
                setCanEdit(data.roles?.includes('direction') || data.roles?.includes('supervision'))
            }
        } catch (error) {
            console.error('Erreur récupération permissions:', error)
        }
    }

    const fetchMedications = async () => {
        try {
            const res = await fetch('/api/intranet/medications')
            if (res.ok) {
                const data = await res.json()
                setMedications(data)
            }
        } catch (error) {
            console.error('Erreur:', error)
        } finally {
            setLoading(false)
        }
    }

    const filteredMeds = medications.filter(med =>
        med.name.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const handleAdd = async () => {
        const res = await fetch('/api/intranet/medications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: formName,
                dosage: formDosage,
                duration: formDuration,
                effects: formEffects,
                side_effects: formSideEffects
            })
        })
        if (res.ok) {
            fetchMedications()
            setIsAddOpen(false)
            resetForm()
        }
    }

    const handleEdit = async () => {
        if (!editingMed) return
        const res = await fetch(`/api/intranet/medications/${editingMed.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: formName,
                dosage: formDosage,
                duration: formDuration,
                effects: formEffects,
                side_effects: formSideEffects
            })
        })
        if (res.ok) {
            fetchMedications()
            setEditingMed(null)
            resetForm()
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Supprimer ce médicament ?')) return
        await fetch(`/api/intranet/medications/${id}`, { method: 'DELETE' })
        fetchMedications()
    }

    const resetForm = () => {
        setFormName("")
        setFormDosage("")
        setFormDuration("")
        setFormEffects("")
        setFormSideEffects("")
    }

    const openEdit = (med: Medication) => {
        setFormName(med.name)
        setFormDosage(med.dosage || "")
        setFormDuration(med.duration || "")
        setFormEffects(med.effects || "")
        setFormSideEffects(med.side_effects || "")
        setEditingMed(med)
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
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
                        <Pill className="w-8 h-8 text-blue-500" />
                        <h1 className="font-display text-3xl font-bold uppercase tracking-tight">
                            Médicaments
                        </h1>
                    </div>
                    <p className="text-gray-400 font-sans">
                        Base de données des médicaments et posologies
                    </p>
                </div>
                {canEdit && (
                    <button
                        onClick={() => setIsAddOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-display font-bold text-sm uppercase tracking-widest transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Médicament
                    </button>
                )}
            </motion.div>

            {/* Search */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-3 mb-6 p-4 border border-[#2a2a2a] bg-[#141414]"
            >
                <Search className="w-5 h-5 text-gray-500" />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Rechercher un médicament..."
                    className="flex-1 bg-transparent text-white focus:outline-none placeholder:text-gray-600"
                />
            </motion.div>

            {/* Medications Grid */}
            {filteredMeds.length === 0 ? (
                <div className="text-center py-12 border border-[#2a2a2a] bg-[#141414]">
                    <Pill className="w-12 h-12 mx-auto text-gray-600 mb-4" />
                    <p className="text-gray-500">
                        {searchQuery ? "Aucun médicament trouvé" : "Aucun médicament enregistré"}
                    </p>
                </div>
            ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredMeds.map(med => (
                        <motion.div
                            key={med.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="border border-[#2a2a2a] bg-[#141414] hover:bg-[#1a1a1a] transition-colors"
                        >
                            {/* Header */}
                            <div
                                className="flex items-center justify-between p-4 cursor-pointer"
                                onClick={() => setExpandedMed(expandedMed === med.id ? null : med.id)}
                            >
                                <div className="flex items-center gap-3">
                                    <Pill className="w-5 h-5 text-blue-400" />
                                    <h3 className="font-display font-bold">{med.name}</h3>
                                </div>
                                <div className="flex items-center gap-2">
                                    <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${expandedMed === med.id ? 'rotate-180' : ''}`} />
                                </div>
                            </div>

                            {/* Details - Only render when expanded */}
                            <AnimatePresence>
                                {expandedMed === med.id && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="border-t border-[#2a2a2a] overflow-hidden"
                                    >
                                        <div className="p-4 space-y-3">
                                            {med.dosage && (
                                                <div>
                                                    <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Posologie</p>
                                                    <p className="text-sm text-gray-300">{med.dosage}</p>
                                                </div>
                                            )}
                                            {med.duration && (
                                                <div className="flex items-start gap-2">
                                                    <Clock className="w-4 h-4 text-blue-400 mt-0.5" />
                                                    <div>
                                                        <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Durée</p>
                                                        <p className="text-sm text-gray-300">{med.duration}</p>
                                                    </div>
                                                </div>
                                            )}
                                            {med.effects && (
                                                <div>
                                                    <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Effets</p>
                                                    <p className="text-sm text-green-300">{med.effects}</p>
                                                </div>
                                            )}
                                            {med.side_effects && (
                                                <div className="flex items-start gap-2">
                                                    <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5" />
                                                    <div>
                                                        <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Effets secondaires</p>
                                                        <p className="text-sm text-yellow-300">{med.side_effects}</p>
                                                    </div>
                                                </div>
                                            )}

                                            {canEdit && (
                                                <div className="flex justify-end gap-2 pt-2 border-t border-[#2a2a2a]">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); openEdit(med); }}
                                                        className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDelete(med.id); }}
                                                        className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Modal Ajouter */}
            <Modal
                isOpen={isAddOpen}
                onClose={() => { setIsAddOpen(false); resetForm(); }}
                title="Ajouter un médicament"
                footer={
                    <div className="flex justify-end gap-3">
                        <button onClick={() => { setIsAddOpen(false); resetForm(); }} className="px-4 py-2 text-gray-400 hover:text-white">
                            Annuler
                        </button>
                        <button onClick={handleAdd} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 font-bold">
                            Créer
                        </button>
                    </div>
                }
            >
                <div className="space-y-4">
                    <input
                        type="text"
                        value={formName}
                        onChange={e => setFormName(e.target.value)}
                        placeholder="Nom du médicament *"
                        className="w-full bg-black/50 border border-white/10 px-4 py-3 text-white"
                    />
                    <input
                        type="text"
                        value={formDosage}
                        onChange={e => setFormDosage(e.target.value)}
                        placeholder="Posologie (ex: 1 comprimé 3x/jour)"
                        className="w-full bg-black/50 border border-white/10 px-4 py-3 text-white"
                    />
                    <input
                        type="text"
                        value={formDuration}
                        onChange={e => setFormDuration(e.target.value)}
                        placeholder="Durée (ex: 7 jours)"
                        className="w-full bg-black/50 border border-white/10 px-4 py-3 text-white"
                    />
                    <textarea
                        value={formEffects}
                        onChange={e => setFormEffects(e.target.value)}
                        placeholder="Effets du médicament"
                        className="w-full bg-black/50 border border-white/10 px-4 py-3 text-white h-20 resize-none"
                    />
                    <textarea
                        value={formSideEffects}
                        onChange={e => setFormSideEffects(e.target.value)}
                        placeholder="Effets secondaires"
                        className="w-full bg-black/50 border border-white/10 px-4 py-3 text-white h-20 resize-none"
                    />
                </div>
            </Modal>

            {/* Modal Modifier */}
            <Modal
                isOpen={!!editingMed}
                onClose={() => { setEditingMed(null); resetForm(); }}
                title="Modifier le médicament"
                footer={
                    <div className="flex justify-end gap-3">
                        <button onClick={() => { setEditingMed(null); resetForm(); }} className="px-4 py-2 text-gray-400 hover:text-white">
                            Annuler
                        </button>
                        <button onClick={handleEdit} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 font-bold">
                            Enregistrer
                        </button>
                    </div>
                }
            >
                <div className="space-y-4">
                    <input
                        type="text"
                        value={formName}
                        onChange={e => setFormName(e.target.value)}
                        placeholder="Nom du médicament *"
                        className="w-full bg-black/50 border border-white/10 px-4 py-3 text-white"
                    />
                    <input
                        type="text"
                        value={formDosage}
                        onChange={e => setFormDosage(e.target.value)}
                        placeholder="Posologie"
                        className="w-full bg-black/50 border border-white/10 px-4 py-3 text-white"
                    />
                    <input
                        type="text"
                        value={formDuration}
                        onChange={e => setFormDuration(e.target.value)}
                        placeholder="Durée"
                        className="w-full bg-black/50 border border-white/10 px-4 py-3 text-white"
                    />
                    <textarea
                        value={formEffects}
                        onChange={e => setFormEffects(e.target.value)}
                        placeholder="Effets"
                        className="w-full bg-black/50 border border-white/10 px-4 py-3 text-white h-20 resize-none"
                    />
                    <textarea
                        value={formSideEffects}
                        onChange={e => setFormSideEffects(e.target.value)}
                        placeholder="Effets secondaires"
                        className="w-full bg-black/50 border border-white/10 px-4 py-3 text-white h-20 resize-none"
                    />
                </div>
            </Modal>
        </div>
    )
}
