"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import {
    Settings, Bell, User, Database,
    Clock, Download, LogOut, Gamepad2, Save, Check, RefreshCw
} from "lucide-react"
import { useToast } from "@/contexts/ToastContext"

// Types
interface UserSettings {
    serviceReminder: number | null // heures, null = désactivé
}

interface UserProfile {
    discordId: string
    displayName: string
    ign: string | null
    avatarUrl?: string
}

// Section Card Component
function SettingsSection({
    title,
    icon: Icon,
    children,
    delay = 0
}: {
    title: string
    icon: React.ElementType
    children: React.ReactNode
    delay?: number
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay }}
            className="p-6 rounded-xl bg-[#141414] border border-[#2a2a2a]"
        >
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-red-500/10">
                    <Icon className="w-5 h-5 text-red-400" />
                </div>
                <h2 className="font-display text-lg font-bold text-white">{title}</h2>
            </div>
            <div className="space-y-4">
                {children}
            </div>
        </motion.div>
    )
}

// Setting Row Component
function SettingRow({
    label,
    description,
    children
}: {
    label: string
    description?: string
    children: React.ReactNode
}) {
    return (
        <div className="flex items-center justify-between py-3 border-b border-[#2a2a2a] last:border-0">
            <div className="flex-1 mr-4">
                <p className="font-medium text-white">{label}</p>
                {description && (
                    <p className="text-sm text-gray-500 mt-0.5">{description}</p>
                )}
            </div>
            <div className="flex-shrink-0">
                {children}
            </div>
        </div>
    )
}

// Toggle Switch Component
function Toggle({ checked, onChange }: { checked: boolean; onChange: (val: boolean) => void }) {
    return (
        <button
            onClick={() => onChange(!checked)}
            className={`
                relative w-12 h-6 rounded-full transition-colors duration-200
                ${checked ? 'bg-red-500' : 'bg-gray-700'}
            `}
        >
            <div
                className={`
                    absolute top-1 w-4 h-4 rounded-full bg-white shadow-md
                    transition-transform duration-200
                    ${checked ? 'translate-x-7' : 'translate-x-1'}
                `}
            />
        </button>
    )
}

// Select Component
function Select({
    value,
    onChange,
    options
}: {
    value: string
    onChange: (val: string) => void
    options: { value: string; label: string }[]
}) {
    return (
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="px-3 py-2 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-white text-sm
                       focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50
                       cursor-pointer"
        >
            {options.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
        </select>
    )
}

export default function ParametresPage() {
    const toast = useToast()
    const [profile, setProfile] = useState<UserProfile | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    // Settings state
    const [settings, setSettings] = useState<UserSettings>({
        serviceReminder: 4
    })

    // Synchro Discord
    const [syncing, setSyncing] = useState(false)
    const [lastSyncTime, setLastSyncTime] = useState<number | null>(null)
    const [syncCooldown, setSyncCooldown] = useState(0)

    // Cooldown timer
    useEffect(() => {
        const saved = localStorage.getItem('phmc-last-sync')
        if (saved) {
            const savedTime = parseInt(saved)
            const elapsed = Date.now() - savedTime
            const remaining = Math.max(0, 5 * 60 * 1000 - elapsed)
            if (remaining > 0) {
                setSyncCooldown(Math.ceil(remaining / 1000))
                setLastSyncTime(savedTime)
            }
        }
    }, [])

    useEffect(() => {
        if (syncCooldown > 0) {
            const timer = setTimeout(() => setSyncCooldown(syncCooldown - 1), 1000)
            return () => clearTimeout(timer)
        }
    }, [syncCooldown])

    // IGN editing
    const [ign, setIgn] = useState('')
    const [ignSaving, setIgnSaving] = useState(false)

    // Load profile and settings
    useEffect(() => {
        async function loadData() {
            try {
                // Load profile
                const profileRes = await fetch('/api/user/profile')
                if (profileRes.ok) {
                    const data = await profileRes.json()
                    setProfile(data)
                    setIgn(data.ign || '')
                }

                // Load settings from localStorage
                const savedSettings = localStorage.getItem('phmc-settings')
                if (savedSettings) {
                    setSettings(JSON.parse(savedSettings))
                }
            } catch (e) {
                console.error('Erreur chargement paramètres:', e)
            }
            setLoading(false)
        }
        loadData()
    }, [])

    // Save settings to localStorage
    const saveSettings = (newSettings: UserSettings) => {
        setSettings(newSettings)
        localStorage.setItem('phmc-settings', JSON.stringify(newSettings))
    }

    // Save IGN
    const handleSaveIgn = async () => {
        if (!profile) return

        setIgnSaving(true)
        try {
            const res = await fetch('/api/user/ign', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ign: ign.trim() || null })
            })

            if (res.ok) {
                toast.success('Nom en jeu mis à jour !')
                setProfile(prev => prev ? { ...prev, ign: ign.trim() || null } : null)
            } else {
                const error = await res.json()
                toast.error(error.error || 'Erreur lors de la mise à jour')
            }
        } catch (e) {
            toast.error('Erreur de connexion')
        }
        setIgnSaving(false)
    }

    // Export services to CSV
    const handleExportServices = async () => {
        try {
            const res = await fetch('/api/intranet/services?export=csv')
            if (res.ok) {
                const blob = await res.blob()
                const url = window.URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `services_${new Date().toISOString().split('T')[0]}.csv`
                document.body.appendChild(a)
                a.click()
                window.URL.revokeObjectURL(url)
                a.remove()
                toast.success('Export téléchargé !')
            } else {
                toast.error('Erreur lors de l\'export')
            }
        } catch (e) {
            toast.error('Erreur de connexion')
        }
    }

    // Sync Discord data
    const handleSyncDiscord = async () => {
        if (syncCooldown > 0) return

        setSyncing(true)
        try {
            const res = await fetch('/api/user/sync', { method: 'POST' })
            if (res.ok) {
                const data = await res.json()
                toast.success('Données Discord synchronisées !')
                // Mettre à jour le profil avec les nouvelles données
                if (data.profile) {
                    setProfile(prev => prev ? { ...prev, ...data.profile } : prev)
                }
                // Démarrer le cooldown
                const now = Date.now()
                localStorage.setItem('phmc-last-sync', now.toString())
                setLastSyncTime(now)
                setSyncCooldown(5 * 60) // 5 minutes
            } else {
                const error = await res.json()
                toast.error(error.error || 'Erreur lors de la synchronisation')
            }
        } catch (e) {
            toast.error('Erreur de connexion')
        }
        setSyncing(false)
    }

    const formatCooldown = (seconds: number) => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-red-500 border-t-transparent" />
            </div>
        )
    }

    return (
        <div className="py-4 md:py-8 space-y-6 max-w-3xl mx-auto">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-4"
            >
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                    <Settings className="w-6 h-6 text-red-400" />
                </div>
                <div>
                    <h1 className="font-display text-2xl md:text-3xl font-bold text-white">
                        Paramètres
                    </h1>
                    <p className="text-gray-500 text-sm">
                        Personnalisez votre expérience PHMC
                    </p>
                </div>
            </motion.div>

            {/* Notifications */}
            <SettingsSection title="Notifications" icon={Bell} delay={0.2}>
                <SettingRow
                    label="Rappel fin de service"
                    description="Recevoir un rappel après X heures de service"
                >
                    <Select
                        value={settings.serviceReminder?.toString() || 'off'}
                        onChange={(val) => saveSettings({
                            ...settings,
                            serviceReminder: val === 'off' ? null : parseInt(val)
                        })}
                        options={[
                            { value: 'off', label: 'Désactivé' },
                            { value: '2', label: 'Après 2h' },
                            { value: '4', label: 'Après 4h' },
                            { value: '6', label: 'Après 6h' },
                            { value: '8', label: 'Après 8h' }
                        ]}
                    />
                </SettingRow>
            </SettingsSection>

            {/* Compte */}
            <SettingsSection title="Compte" icon={User} delay={0.3}>
                {profile && (
                    <>
                        <SettingRow
                            label="Compte Discord"
                            description={`Connecté en tant que ${profile.displayName}`}
                        >
                            {profile.avatarUrl && (
                                <img
                                    src={profile.avatarUrl}
                                    alt=""
                                    className="w-10 h-10 rounded-full border-2 border-[#2a2a2a]"
                                />
                            )}
                        </SettingRow>

                        <SettingRow
                            label="Synchroniser Discord"
                            description="Met à jour votre rôle et nom d'affichage depuis Discord"
                        >
                            <button
                                onClick={handleSyncDiscord}
                                disabled={syncing || syncCooldown > 0}
                                className={`
                                    px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2
                                    transition-all duration-200
                                    ${syncCooldown > 0
                                        ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                                        : 'bg-purple-500/10 border border-purple-500/30 text-purple-400 hover:bg-purple-500/20'
                                    }
                                    disabled:opacity-50
                                `}
                            >
                                <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                                {syncing ? 'Synchro...' : syncCooldown > 0 ? formatCooldown(syncCooldown) : 'Synchroniser'}
                            </button>
                        </SettingRow>

                        <div className="py-3 border-b border-[#2a2a2a]">
                            <div className="flex items-center gap-2 mb-2">
                                <Gamepad2 className="w-4 h-4 text-gray-400" />
                                <p className="font-medium text-white">Nom en jeu (IGN)</p>
                            </div>
                            <p className="text-sm text-gray-500 mb-3">
                                Votre nom de personnage dans le jeu
                            </p>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={ign}
                                    onChange={(e) => setIgn(e.target.value)}
                                    placeholder="Ex: John Doe"
                                    className="flex-1 px-3 py-2 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a]
                                               text-white placeholder-gray-600 text-sm
                                               focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50"
                                />
                                <button
                                    onClick={handleSaveIgn}
                                    disabled={ignSaving || ign === (profile.ign || '')}
                                    className={`
                                        px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2
                                        transition-all duration-200
                                        ${ign !== (profile.ign || '')
                                            ? 'bg-red-500 hover:bg-red-600 text-white'
                                            : 'bg-green-500/20 text-green-400 cursor-default'
                                        }
                                        disabled:opacity-50
                                    `}
                                >
                                    {ignSaving ? (
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : ign === (profile.ign || '') ? (
                                        <Check className="w-4 h-4" />
                                    ) : (
                                        <Save className="w-4 h-4" />
                                    )}
                                    {ign === (profile.ign || '') ? 'Enregistré' : 'Sauvegarder'}
                                </button>
                            </div>
                        </div>
                    </>
                )}

                <SettingRow label="Déconnexion" description="Se déconnecter de l'intranet">
                    <a
                        href="/api/auth/signout"
                        className="px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30 
                                   text-red-400 text-sm font-medium hover:bg-red-500/20 
                                   transition-colors flex items-center gap-2"
                    >
                        <LogOut className="w-4 h-4" />
                        Déconnexion
                    </a>
                </SettingRow>
            </SettingsSection>

            {/* Données */}
            <SettingsSection title="Données" icon={Database} delay={0.4}>
                <SettingRow
                    label="Exporter mes services"
                    description="Télécharger l'historique de vos services au format CSV"
                >
                    <button
                        onClick={handleExportServices}
                        className="px-4 py-2 rounded-lg bg-blue-500/10 border border-blue-500/30 
                                   text-blue-400 text-sm font-medium hover:bg-blue-500/20 
                                   transition-colors flex items-center gap-2"
                    >
                        <Download className="w-4 h-4" />
                        Exporter
                    </button>
                </SettingRow>
            </SettingsSection>
        </div>
    )
}
