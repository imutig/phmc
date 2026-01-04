"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { User, X, Save, Loader2, Check } from "lucide-react"

interface IGNModalProps {
    isOpen: boolean
    onClose: () => void
    currentIgn?: string | null
    onSuccess?: (newIgn: string) => void
}

export function IGNModal({ isOpen, onClose, currentIgn, onSuccess }: IGNModalProps) {
    const [ign, setIgn] = useState("")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    useEffect(() => {
        if (isOpen) {
            setIgn(currentIgn || "")
            setError(null)
            setSuccess(false)
        }
    }, [isOpen, currentIgn])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            const res = await fetch('/api/user/ign', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ign: ign.trim() })
            })

            const data = await res.json()

            if (!res.ok) {
                setError(data.error || 'Erreur lors de la sauvegarde')
                return
            }

            setSuccess(true)
            onSuccess?.(data.ign)

            // Fermer après un court délai pour montrer le succès
            setTimeout(() => {
                onClose()
            }, 1000)
        } catch (err) {
            setError('Erreur de connexion')
        } finally {
            setLoading(false)
        }
    }

    if (!isOpen) return null

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md z-50"
                    >
                        <div className="bg-[#141414] border border-[#2a2a2a] rounded-lg shadow-2xl overflow-hidden">
                            {/* Header */}
                            <div className="flex items-center justify-between p-4 border-b border-[#2a2a2a]">
                                <div className="flex items-center gap-3">
                                    <User className="w-5 h-5 text-red-500" />
                                    <h2 className="font-display font-bold text-lg">Nom RP (In-Game)</h2>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Content */}
                            <form onSubmit={handleSubmit} className="p-6 space-y-4">
                                <div>
                                    <label className="block text-xs text-gray-500 uppercase tracking-widest mb-2">
                                        Prénom et Nom (comme affiché en jeu)
                                    </label>
                                    <input
                                        type="text"
                                        value={ign}
                                        onChange={(e) => setIgn(e.target.value)}
                                        placeholder="Ex: Ella Belliart"
                                        className="w-full bg-black/50 border border-white/10 px-4 py-3 text-white rounded focus:outline-none focus:border-red-500/50 transition-colors"
                                        disabled={loading || success}
                                        autoFocus
                                    />
                                    <p className="text-xs text-gray-500 mt-2">
                                        Ce nom sera utilisé pour synchroniser automatiquement vos prises de service en jeu.
                                    </p>
                                </div>

                                {error && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm"
                                    >
                                        {error}
                                    </motion.div>
                                )}

                                {success && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="p-3 bg-green-500/10 border border-green-500/30 rounded text-green-400 text-sm flex items-center gap-2"
                                    >
                                        <Check className="w-4 h-4" />
                                        Nom RP enregistré avec succès !
                                    </motion.div>
                                )}

                                <div className="flex justify-end gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                                        disabled={loading}
                                    >
                                        Annuler
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={loading || success || !ign.trim() || ign.trim().length < 3}
                                        className="flex items-center gap-2 px-6 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded transition-colors"
                                    >
                                        {loading ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : success ? (
                                            <Check className="w-4 h-4" />
                                        ) : (
                                            <Save className="w-4 h-4" />
                                        )}
                                        {success ? 'Enregistré' : 'Enregistrer'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}
