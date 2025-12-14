"use client"

import { motion, AnimatePresence } from "framer-motion"
import { ArrowLeft, MessageSquare, Plus, Edit2, Trash2, Loader2, Search, X, Save, Copy, Check } from "lucide-react"
import Link from "next/link"
import { useSession, signIn } from "next-auth/react"
import { useEffect, useState, useCallback } from "react"

interface Snippet {
    id: string
    name: string
    content: string
    created_at: string
    updated_at?: string
}

export default function SnippetsPage() {
    const { status } = useSession()
    const [snippets, setSnippets] = useState<Snippet[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState('')

    // Modal states
    const [showModal, setShowModal] = useState(false)
    const [editingSnippet, setEditingSnippet] = useState<Snippet | null>(null)
    const [formName, setFormName] = useState('')
    const [formContent, setFormContent] = useState('')
    const [saving, setSaving] = useState(false)
    const [deleting, setDeleting] = useState<string | null>(null)

    // Copy feedback
    const [copiedId, setCopiedId] = useState<string | null>(null)

    const fetchSnippets = useCallback(async () => {
        setLoading(true)
        try {
            const response = await fetch('/api/admin/snippets')
            const data = await response.json()

            if (!response.ok) {
                setError(data.error || "Erreur de chargement.")
                return
            }

            setSnippets(data.snippets)
            setError(null)
        } catch {
            setError("Erreur de connexion au serveur.")
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        if (status === "authenticated") {
            fetchSnippets()
        }
    }, [status, fetchSnippets])

    const openCreateModal = () => {
        setEditingSnippet(null)
        setFormName('')
        setFormContent('')
        setShowModal(true)
    }

    const openEditModal = (snippet: Snippet) => {
        setEditingSnippet(snippet)
        setFormName(snippet.name)
        setFormContent(snippet.content)
        setShowModal(true)
    }

    const closeModal = () => {
        setShowModal(false)
        setEditingSnippet(null)
        setFormName('')
        setFormContent('')
    }

    const handleSave = async () => {
        if (!formName.trim() || !formContent.trim()) return

        setSaving(true)
        try {
            const url = editingSnippet
                ? `/api/admin/snippets/${editingSnippet.id}`
                : '/api/admin/snippets'

            const response = await fetch(url, {
                method: editingSnippet ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: formName.trim(),
                    content: formContent.trim()
                })
            })

            if (response.ok) {
                closeModal()
                fetchSnippets()
            } else {
                const data = await response.json()
                setError(data.error || "Erreur lors de la sauvegarde.")
            }
        } catch {
            setError("Erreur de connexion.")
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (id: string) => {
        setDeleting(id)
        try {
            const response = await fetch(`/api/admin/snippets/${id}`, {
                method: 'DELETE'
            })

            if (response.ok) {
                fetchSnippets()
            }
        } finally {
            setDeleting(null)
        }
    }

    const copyToClipboard = (snippet: Snippet) => {
        navigator.clipboard.writeText(snippet.content)
        setCopiedId(snippet.id)
        setTimeout(() => setCopiedId(null), 2000)
    }

    const filteredSnippets = snippets.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.content.toLowerCase().includes(searchQuery.toLowerCase())
    )

    if (status === "loading" || loading) {
        return (
            <main className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-white" />
            </main>
        )
    }

    if (status === "unauthenticated") {
        return (
            <main className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center"
                >
                    <h2 className="font-display text-2xl font-bold uppercase mb-4">Accès Restreint</h2>
                    <button
                        onClick={() => signIn("discord")}
                        className="bg-[#5865F2] hover:bg-[#4752C4] px-6 py-3 text-white font-bold"
                    >
                        Se connecter avec Discord
                    </button>
                </motion.div>
            </main>
        )
    }

    return (
        <>
            <div className="scan-overlay" />
            <div className="siren-bar">
                <div className="siren-blue" />
                <div className="siren-red" />
            </div>

            <main className="min-h-screen bg-[#0a0a0a] text-white">
                <div className="container mx-auto px-4 py-8 max-w-5xl">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-4">
                                <Link href="/admin" className="text-gray-400 hover:text-white transition-colors">
                                    <ArrowLeft className="w-5 h-5" />
                                </Link>
                                <div>
                                    <h1 className="font-display text-2xl font-bold uppercase tracking-tighter">
                                        Gestion des Snippets
                                    </h1>
                                    <p className="text-gray-500 text-sm font-mono">
                                        {snippets.length} snippet(s) disponible(s)
                                    </p>
                                </div>
                            </div>
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={openCreateModal}
                                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 flex items-center gap-2 font-display font-bold text-sm uppercase transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                                Nouveau
                            </motion.button>
                        </div>

                        {/* Search */}
                        <div className="relative mb-6">
                            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Rechercher un snippet..."
                                className="w-full bg-white/5 border border-white/10 pl-12 pr-4 py-3 text-white focus:outline-none focus:border-white/30"
                            />
                        </div>

                        {/* Error */}
                        {error && (
                            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400">
                                {error}
                            </div>
                        )}

                        {/* Snippets Grid */}
                        <div className="grid md:grid-cols-2 gap-4">
                            {filteredSnippets.map(snippet => (
                                <motion.div
                                    key={snippet.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="border border-white/10 bg-white/[0.02] p-5 hover:border-white/20 transition-colors group"
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <MessageSquare className="w-4 h-4 text-blue-400" />
                                            <span className="font-display font-bold text-blue-400 uppercase text-sm">
                                                /{snippet.name}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => copyToClipboard(snippet)}
                                                className="p-1.5 text-gray-500 hover:text-white transition-colors"
                                                title="Copier le contenu"
                                            >
                                                {copiedId === snippet.id ? (
                                                    <Check className="w-4 h-4 text-green-400" />
                                                ) : (
                                                    <Copy className="w-4 h-4" />
                                                )}
                                            </button>
                                            <button
                                                onClick={() => openEditModal(snippet)}
                                                className="p-1.5 text-gray-500 hover:text-white transition-colors"
                                                title="Modifier"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(snippet.id)}
                                                disabled={deleting === snippet.id}
                                                className="p-1.5 text-gray-500 hover:text-red-400 transition-colors disabled:opacity-50"
                                                title="Supprimer"
                                            >
                                                {deleting === snippet.id ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <Trash2 className="w-4 h-4" />
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                    <p className="text-gray-300 text-sm line-clamp-3">
                                        {snippet.content}
                                    </p>
                                </motion.div>
                            ))}
                        </div>

                        {filteredSnippets.length === 0 && !loading && (
                            <div className="text-center py-12 text-gray-500">
                                <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                <p>Aucun snippet trouvé</p>
                            </div>
                        )}
                    </motion.div>
                </div>
            </main>

            {/* Modal */}
            <AnimatePresence>
                {showModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
                        onClick={closeModal}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-[#111] border border-white/10 p-6 max-w-lg w-full"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="font-display text-xl font-bold uppercase">
                                    {editingSnippet ? 'Modifier le snippet' : 'Nouveau snippet'}
                                </h3>
                                <button onClick={closeModal} className="text-gray-500 hover:text-white">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">
                                        Nom du snippet
                                    </label>
                                    <div className="flex items-center">
                                        <span className="bg-white/5 border border-white/10 border-r-0 px-3 py-2 text-gray-500">/</span>
                                        <input
                                            type="text"
                                            value={formName}
                                            onChange={(e) => setFormName(e.target.value.toLowerCase().replace(/\s/g, '_'))}
                                            placeholder="nom_du_snippet"
                                            className="flex-1 bg-black/50 border border-white/10 px-3 py-2 text-white focus:outline-none focus:border-white/30"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">
                                        Contenu
                                    </label>
                                    <textarea
                                        value={formContent}
                                        onChange={(e) => setFormContent(e.target.value)}
                                        placeholder="Le contenu du message qui sera envoyé..."
                                        className="w-full bg-black/50 border border-white/10 p-3 text-white text-sm resize-none h-40 focus:outline-none focus:border-white/30"
                                        maxLength={2000}
                                    />
                                    <p className="text-xs text-gray-600 mt-1 text-right">{formContent.length}/2000</p>
                                </div>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={closeModal}
                                    className="flex-1 py-3 border border-white/10 hover:bg-white/5 font-display font-bold text-sm uppercase transition-colors"
                                >
                                    Annuler
                                </motion.button>
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={handleSave}
                                    disabled={saving || !formName.trim() || !formContent.trim()}
                                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-display font-bold text-sm uppercase flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                                >
                                    {saving ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <>
                                            <Save className="w-4 h-4" />
                                            Enregistrer
                                        </>
                                    )}
                                </motion.button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    )
}
