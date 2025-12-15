"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Calendar, Plus, Edit2, Trash2, Loader2, MapPin, Clock, Save, X, List, LayoutGrid } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import { CalendarView } from "@/components/ui/CalendarView"
import { Breadcrumbs } from "@/components/ui/Breadcrumbs"
import { useToast } from "@/contexts/ToastContext"
import { usePermissions } from "@/components/intranet/ClientWrapper"

interface Event {
    id: string
    title: string
    description: string | null
    event_date: string
    end_date: string | null
    location: string | null
    event_type: string
    color: string
    is_published: boolean
}

const EVENT_TYPES = [
    { value: 'general', label: 'Général', color: '#6b7280' },
    { value: 'ceremonie', label: 'Cérémonie', color: '#f59e0b' },
    { value: 'formation', label: 'Formation', color: '#3b82f6' },
    { value: 'reunion', label: 'Réunion', color: '#8b5cf6' },
    { value: 'fete', label: 'Fête / Événement', color: '#ef4444' },
]

export default function PlanningPage() {
    const [events, setEvents] = useState<Event[]>([])
    const [loading, setLoading] = useState(true)
    const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list')
    const toast = useToast()
    const { canEdit } = usePermissions() // Utilisation du context centralisé

    // Modal
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingEvent, setEditingEvent] = useState<Event | null>(null)
    const [formTitle, setFormTitle] = useState("")
    const [formDescription, setFormDescription] = useState("")
    const [formDate, setFormDate] = useState("")
    const [formTime, setFormTime] = useState("20:00")
    const [formLocation, setFormLocation] = useState("")
    const [formType, setFormType] = useState("fete")
    const [formColor, setFormColor] = useState("#ef4444")
    const [submitting, setSubmitting] = useState(false)

    useEffect(() => {
        fetchEvents()
    }, [])

    const fetchEvents = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/intranet/events')
            if (res.ok) {
                const data = await res.json()
                setEvents(data.events || [])
            }
        } catch (e) {
            toast.error("Erreur de chargement")
        } finally {
            setLoading(false)
        }
    }

    const openNewEvent = () => {
        setEditingEvent(null)
        setFormTitle("")
        setFormDescription("")
        setFormDate("")
        setFormTime("20:00")
        setFormLocation("")
        setFormType("fete")
        setFormColor("#ef4444")
        setIsModalOpen(true)
    }

    const openEditEvent = (event: Event) => {
        setEditingEvent(event)
        const date = new Date(event.event_date)
        setFormTitle(event.title)
        setFormDescription(event.description || "")
        setFormDate(date.toISOString().split('T')[0])
        setFormTime(date.toTimeString().slice(0, 5))
        setFormLocation(event.location || "")
        setFormType(event.event_type)
        setFormColor(event.color)
        setIsModalOpen(true)
    }

    const handleSave = async () => {
        if (!formTitle || !formDate) {
            toast.error("Titre et date requis")
            return
        }

        setSubmitting(true)
        try {
            const eventDate = new Date(`${formDate}T${formTime}:00`)
            const payload = {
                title: formTitle,
                description: formDescription || null,
                event_date: eventDate.toISOString(),
                location: formLocation || null,
                event_type: formType,
                color: formColor,
                is_published: true
            }

            if (editingEvent) {
                const res = await fetch(`/api/intranet/events?id=${editingEvent.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                })
                if (res.ok) {
                    toast.success("Événement modifié")
                    setIsModalOpen(false)
                    fetchEvents()
                } else {
                    const err = await res.json()
                    toast.error(err.error || "Erreur")
                }
            } else {
                const res = await fetch('/api/intranet/events', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                })
                if (res.ok) {
                    toast.success("Événement créé")
                    setIsModalOpen(false)
                    fetchEvents()
                } else {
                    const err = await res.json()
                    toast.error(err.error || "Erreur")
                }
            }
        } catch (e) {
            toast.error("Erreur réseau")
        } finally {
            setSubmitting(false)
        }
    }

    const handleDelete = async (event: Event) => {
        if (!confirm(`Supprimer "${event.title}" ?`)) return
        try {
            await fetch(`/api/intranet/events?id=${event.id}`, { method: 'DELETE' })
            toast.success("Événement supprimé")
            fetchEvents()
        } catch (e) {
            toast.error("Erreur")
        }
    }

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr)
        return date.toLocaleDateString('fr-FR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        })
    }

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr)
        return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    }

    // Grouper par mois
    const groupedByMonth: Record<string, Event[]> = {}
    for (const event of events) {
        const date = new Date(event.event_date)
        const monthKey = `${date.getFullYear()}-${date.getMonth()}`
        const monthLabel = date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
        if (!groupedByMonth[monthLabel]) groupedByMonth[monthLabel] = []
        groupedByMonth[monthLabel].push(event)
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Loader2 className="w-8 h-8 animate-spin text-red-500" />
            </div>
        )
    }

    return (
        <div className="py-4 md:p-8">
            <Breadcrumbs items={[{ label: "Planning" }]} />

            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 md:mb-8"
            >
                <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <Calendar className="w-6 md:w-8 h-6 md:h-8 text-red-500" />
                            <h1 className="font-display text-2xl md:text-3xl font-bold uppercase tracking-tight">
                                Planning Événements
                            </h1>
                        </div>
                        <p className="text-gray-400 text-sm md:text-base">
                            Événements et occasions spéciales à venir
                        </p>
                    </div>
                    <div className="flex items-center gap-2 md:gap-3">
                        {/* Toggle Vue */}
                        <div className="flex bg-black/30 rounded-lg p-1 border border-white/10">
                            <button
                                onClick={() => setViewMode('list')}
                                className={`flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1.5 rounded-md text-xs md:text-sm transition-colors ${viewMode === 'list' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'
                                    }`}
                            >
                                <List className="w-4 h-4" />
                                <span className="hidden sm:inline">Liste</span>
                            </button>
                            <button
                                onClick={() => setViewMode('calendar')}
                                className={`flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1.5 rounded-md text-xs md:text-sm transition-colors ${viewMode === 'calendar' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'
                                    }`}
                            >
                                <LayoutGrid className="w-4 h-4" />
                                <span className="hidden sm:inline">Calendrier</span>
                            </button>
                        </div>
                        {canEdit && (
                            <button
                                onClick={openNewEvent}
                                className="flex items-center gap-1 md:gap-2 px-3 md:px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded transition-colors text-sm"
                            >
                                <Plus className="w-4 h-4" />
                                <span className="hidden sm:inline">Nouvel événement</span>
                            </button>
                        )}
                    </div>
                </div>
            </motion.div>

            {/* Contenu selon le mode de vue */}
            {viewMode === 'calendar' ? (
                <CalendarView
                    events={events}
                    onEventClick={(event) => openEditEvent(event as Event)}
                    onDayClick={(date) => {
                        if (canEdit) {
                            setFormDate(date.toISOString().split('T')[0])
                            openNewEvent()
                        }
                    }}
                    canEdit={canEdit}
                />
            ) : events.length === 0 ? (
                <div className="text-center py-12 bg-[#141414] border border-[#2a2a2a] rounded-lg">
                    <Calendar className="w-12 h-12 mx-auto text-gray-600 mb-4" />
                    <p className="text-gray-500">Aucun événement prévu</p>
                    {canEdit && (
                        <button onClick={openNewEvent} className="mt-4 text-red-400 hover:text-red-300">
                            Créer le premier événement
                        </button>
                    )}
                </div>
            ) : (
                <div className="space-y-6 md:space-y-8">
                    {Object.entries(groupedByMonth).map(([month, monthEvents]) => (
                        <div key={month}>
                            <h2 className="text-base md:text-lg font-bold text-gray-400 uppercase tracking-wider mb-3 md:mb-4 capitalize">
                                {month}
                            </h2>
                            <div className="space-y-3 md:space-y-4">
                                {monthEvents.map(event => (
                                    <motion.div
                                        key={event.id}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="bg-[#141414] border border-[#2a2a2a] rounded-lg overflow-hidden"
                                    >
                                        <div className="flex">
                                            {/* Barre de couleur */}
                                            <div
                                                className="w-1.5 md:w-2 flex-shrink-0"
                                                style={{ backgroundColor: event.color }}
                                            />

                                            {/* Contenu */}
                                            <div className="flex-1 p-3 md:p-4">
                                                <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-2 md:gap-0">
                                                    <div className="flex-1">
                                                        <h3 className="font-display font-bold text-base md:text-lg text-white mb-1">
                                                            {event.title}
                                                        </h3>
                                                        <div className="flex flex-wrap items-center gap-2 md:gap-4 text-xs md:text-sm text-gray-400">
                                                            <span className="flex items-center gap-1">
                                                                <Calendar className="w-3 h-3 md:w-4 md:h-4" />
                                                                <span className="hidden sm:inline">{formatDate(event.event_date)}</span>
                                                                <span className="sm:hidden">{new Date(event.event_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
                                                            </span>
                                                            <span className="flex items-center gap-1">
                                                                <Clock className="w-3 h-3 md:w-4 md:h-4" />
                                                                {formatTime(event.event_date)}
                                                            </span>
                                                            {event.location && (
                                                                <span className="flex items-center gap-1">
                                                                    <MapPin className="w-3 h-3 md:w-4 md:h-4" />
                                                                    <span className="truncate max-w-[100px] md:max-w-none">{event.location}</span>
                                                                </span>
                                                            )}
                                                        </div>
                                                        {event.description && (
                                                            <p className="text-gray-500 mt-2 text-xs md:text-sm line-clamp-2">
                                                                {event.description}
                                                            </p>
                                                        )}
                                                    </div>

                                                    {canEdit && (
                                                        <div className="flex items-center gap-1 md:gap-2">
                                                            <button
                                                                onClick={() => openEditEvent(event)}
                                                                className="p-1.5 md:p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded"
                                                            >
                                                                <Edit2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDelete(event)}
                                                                className="p-1.5 md:p-2 text-gray-400 hover:text-red-400 hover:bg-white/10 rounded"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingEvent ? "Modifier l'événement" : "Nouvel événement"}
                footer={
                    <div className="flex justify-end gap-3">
                        <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-400 hover:text-white">
                            Annuler
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={submitting || !formTitle || !formDate}
                            className="bg-red-600 hover:bg-red-500 text-white px-6 py-2 font-bold disabled:opacity-50 flex items-center gap-2"
                        >
                            <Save className="w-4 h-4" />
                            {submitting ? "..." : "Enregistrer"}
                        </button>
                    </div>
                }
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs text-gray-500 uppercase tracking-widest mb-2">Titre *</label>
                        <input
                            type="text"
                            value={formTitle}
                            onChange={e => setFormTitle(e.target.value)}
                            className="w-full bg-black/50 border border-white/10 px-4 py-3 text-white rounded"
                            placeholder="Bal des Services, Cérémonie..."
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-gray-500 uppercase tracking-widest mb-2">Date *</label>
                            <input
                                type="date"
                                value={formDate}
                                onChange={e => setFormDate(e.target.value)}
                                className="w-full bg-black/50 border border-white/10 px-4 py-3 text-white rounded"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 uppercase tracking-widest mb-2">Heure</label>
                            <input
                                type="time"
                                value={formTime}
                                onChange={e => setFormTime(e.target.value)}
                                className="w-full bg-black/50 border border-white/10 px-4 py-3 text-white rounded"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs text-gray-500 uppercase tracking-widest mb-2">Lieu</label>
                        <input
                            type="text"
                            value={formLocation}
                            onChange={e => setFormLocation(e.target.value)}
                            className="w-full bg-black/50 border border-white/10 px-4 py-3 text-white rounded"
                            placeholder="Pillbox Hill Medical Center"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-gray-500 uppercase tracking-widest mb-2">Type</label>
                            <select
                                value={formType}
                                onChange={e => {
                                    setFormType(e.target.value)
                                    const type = EVENT_TYPES.find(t => t.value === e.target.value)
                                    if (type) setFormColor(type.color)
                                }}
                                className="w-full bg-black/50 border border-white/10 px-4 py-3 text-white rounded"
                            >
                                {EVENT_TYPES.map(t => (
                                    <option key={t.value} value={t.value}>{t.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 uppercase tracking-widest mb-2">Couleur</label>
                            <input
                                type="color"
                                value={formColor}
                                onChange={e => setFormColor(e.target.value)}
                                className="w-full h-12 bg-black/50 border border-white/10 rounded cursor-pointer"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs text-gray-500 uppercase tracking-widest mb-2">Description</label>
                        <textarea
                            value={formDescription}
                            onChange={e => setFormDescription(e.target.value)}
                            rows={3}
                            className="w-full bg-black/50 border border-white/10 px-4 py-3 text-white rounded"
                            placeholder="Détails de l'événement..."
                        />
                    </div>
                </div>
            </Modal>
        </div>
    )
}
