"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Play, Square, Clock, AlertCircle } from "lucide-react"

interface ServiceButtonProps {
    userDiscordId: string
    userName: string
    gradeName: string
    avatarUrl?: string | null
}

interface LiveService {
    id: string
    start_time: string
    user_discord_id: string
}

// Formater la durée en HH:MM:SS
function formatDuration(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

export function ServiceButton({ userDiscordId, userName, gradeName, avatarUrl }: ServiceButtonProps) {
    const [liveService, setLiveService] = useState<LiveService | null>(null)
    const [loading, setLoading] = useState(true)
    const [actionLoading, setActionLoading] = useState(false)
    const [elapsed, setElapsed] = useState(0)
    const [showWarning, setShowWarning] = useState(false)
    const [warningMessage, setWarningMessage] = useState("")

    // Charger le service en cours au montage
    useEffect(() => {
        fetchLiveService()
    }, [])

    // Timer pour le compteur
    useEffect(() => {
        if (!liveService) {
            setElapsed(0)
            return
        }

        const startTime = new Date(liveService.start_time).getTime()

        const updateElapsed = () => {
            setElapsed(Date.now() - startTime)
        }

        updateElapsed()
        const interval = setInterval(updateElapsed, 1000)
        return () => clearInterval(interval)
    }, [liveService])

    const fetchLiveService = async () => {
        try {
            const res = await fetch('/api/intranet/services/live')
            if (res.ok) {
                const data = await res.json()
                setLiveService(data.service || null)
            }
        } catch (e) {
            console.error('Erreur fetch live service:', e)
        } finally {
            setLoading(false)
        }
    }

    const startService = async () => {
        setActionLoading(true)
        try {
            const res = await fetch('/api/intranet/services/live', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_name: userName,
                    grade_name: gradeName,
                    user_avatar_url: avatarUrl
                })
            })

            if (res.ok) {
                const data = await res.json()
                setLiveService(data.service)
            } else {
                const error = await res.json()
                setWarningMessage(error.error || "Erreur lors du démarrage")
                setShowWarning(true)
            }
        } catch (e) {
            setWarningMessage("Erreur de connexion")
            setShowWarning(true)
        } finally {
            setActionLoading(false)
        }
    }

    const stopService = async () => {
        if (!liveService) return

        const endTime = new Date()

        setActionLoading(true)
        try {
            const res = await fetch('/api/intranet/services/live', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    service_id: liveService.id,
                    end_time: endTime.toISOString()
                })
            })

            if (res.ok) {
                const data = await res.json()
                setLiveService(null)
                // Afficher un message de confirmation si le service a été enregistré
                if (data.service && data.service.slots_count !== undefined) {
                    if (data.service.slots_count === 0) {
                        setWarningMessage(`Service enregistré mais aucun intervalle de 15 min traversé. Durée: ${data.service.duration_minutes} min. Salaire: 0$`)
                    } else {
                        setWarningMessage(`Service terminé ! Durée: ${data.service.duration_minutes} min. Salaire: ${data.service.salary_earned}$`)
                    }
                    setShowWarning(true)
                }
            } else {
                const error = await res.json()
                setWarningMessage(error.error || "Erreur lors de l'arrêt")
                setShowWarning(true)
            }
        } catch (e) {
            setWarningMessage("Erreur de connexion")
            setShowWarning(true)
        } finally {
            setActionLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="w-10 h-10 rounded-full bg-white/5 animate-pulse" />
        )
    }

    const isActive = !!liveService

    return (
        <>
            <motion.button
                onClick={isActive ? stopService : startService}
                disabled={actionLoading}
                className={`
                    relative flex items-center gap-2 px-4 py-2 rounded-full
                    transition-all duration-300 overflow-hidden
                    ${isActive
                        ? 'bg-red-500/20 border border-red-500/50 text-red-400'
                        : 'bg-white/10 backdrop-blur-md border border-white/20 text-white hover:bg-white/20'
                    }
                    ${actionLoading ? 'opacity-50 cursor-wait' : 'cursor-pointer'}
                `}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
            >
                {/* Animation de fond pulsante quand actif */}
                {isActive && (
                    <motion.div
                        className="absolute inset-0 bg-red-500/10 rounded-full"
                        animate={{
                            scale: [1, 1.1, 1],
                            opacity: [0.5, 0.2, 0.5]
                        }}
                        transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                    />
                )}

                {/* Bordure animée quand actif */}
                {isActive && (
                    <motion.div
                        className="absolute inset-0 rounded-full"
                        style={{
                            border: '2px solid transparent',
                            background: 'linear-gradient(90deg, transparent, rgba(239, 68, 68, 0.5), transparent) border-box',
                            WebkitMask: 'linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)',
                            WebkitMaskComposite: 'xor',
                            maskComposite: 'exclude',
                        }}
                        animate={{
                            rotate: [0, 360]
                        }}
                        transition={{
                            duration: 3,
                            repeat: Infinity,
                            ease: "linear"
                        }}
                    />
                )}

                <div className="relative z-10 flex items-center gap-2">
                    {isActive ? (
                        <>
                            <motion.div
                                animate={{ scale: [1, 1.2, 1] }}
                                transition={{ duration: 1, repeat: Infinity }}
                            >
                                <Square className="w-4 h-4 fill-current" />
                            </motion.div>
                            <span className="font-mono text-sm font-medium">
                                {formatDuration(elapsed)}
                            </span>
                        </>
                    ) : (
                        <>
                            <Play className="w-4 h-4" />
                            <span className="text-sm font-medium hidden sm:inline">
                                Prendre service
                            </span>
                        </>
                    )}
                </div>
            </motion.button>

            {/* Modal d'avertissement */}
            <AnimatePresence>
                {showWarning && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                        onClick={() => setShowWarning(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-[#1a1a1a] border border-yellow-500/30 rounded-lg p-6 max-w-md"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex items-center gap-3 mb-4">
                                <AlertCircle className="w-6 h-6 text-yellow-500" />
                                <h3 className="font-display font-bold text-lg">Attention</h3>
                            </div>
                            <p className="text-gray-400 text-sm whitespace-pre-line mb-4">
                                {warningMessage}
                            </p>
                            <button
                                onClick={() => setShowWarning(false)}
                                className="w-full py-2 bg-white/10 hover:bg-white/20 rounded-md text-sm font-medium transition-colors"
                            >
                                Compris
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    )
}
