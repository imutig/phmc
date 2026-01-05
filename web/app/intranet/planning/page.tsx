"use client"

import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Calendar, Plus, ChevronLeft, ChevronRight, X, Save, Trash2 } from "lucide-react"
import { Breadcrumbs } from "@/components/ui/Breadcrumbs"
import { useToast } from "@/contexts/ToastContext"

interface EventParticipant {
    user_discord_id: string
    user_name: string | null
}

interface Event {
    id: string
    title: string
    description: string | null
    event_date: string
    start_time: string | null
    end_time: string | null
    location: string | null
    event_type: string
    event_size: string
    color: string
    is_published: boolean
    participants_all: boolean
    created_by: string
    created_by_name?: string
    event_participants: EventParticipant[]
}

const EVENT_TYPES = [
    { value: 'rdv', label: 'RDV Patient', color: '#059669', size: 'minor' },
    { value: 'reunion', label: 'Réunion', color: '#2563eb', size: 'minor' },
    { value: 'formation', label: 'Formation', color: '#7c3aed', size: 'minor' },
    { value: 'ceremonie', label: 'Cérémonie', color: '#d97706', size: 'major' },
    { value: 'fete', label: 'Fête / Bal', color: '#dc2626', size: 'major' },
    { value: 'autre', label: 'Autre', color: '#4b5563', size: 'minor' },
    { value: 'general', label: 'Général', color: '#6366f1', size: 'minor' },
]

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
const DAYS_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

const HOUR_HEIGHT = 48
const SNAP_MINUTES = 5 // Snapping aux intervalles de 5 min

export default function PlanningPage() {
    const toast = useToast()
    const [events, setEvents] = useState<Event[]>([])
    const [loading, setLoading] = useState(true)
    const [week, setWeek] = useState(0)
    const [year, setYear] = useState(0)
    const [showModal, setShowModal] = useState(false)
    const [editingEvent, setEditingEvent] = useState<Event | null>(null)
    const [saving, setSaving] = useState(false)

    // États pour le drag & resize
    const [dragState, setDragState] = useState<{
        type: 'drag' | 'resize-top' | 'resize-bottom' | null
        eventId: string
        startY: number
        startX: number
        startTop: number
        startHeight: number
        dayIndex: number
        originalDayIndex: number
        hasMoved: boolean // Pour distinguer clic de drag
    } | null>(null)
    const [editingTitle, setEditingTitle] = useState<string | null>(null)
    const [tempTitle, setTempTitle] = useState('')
    const [hoveredEvent, setHoveredEvent] = useState<{ event: Event; x: number; y: number } | null>(null)
    const [contextMenu, setContextMenu] = useState<{ event: Event; x: number; y: number } | null>(null)
    const [deleteConfirm, setDeleteConfirm] = useState<{ eventId: string; title: string } | null>(null)
    const gridRef = useRef<HTMLDivElement>(null)

    // Form state
    const [formData, setFormData] = useState({
        title: '',
        event_type: 'rdv',
        event_date: '',
        start_time: '09:00',
        end_time: '10:00',
        description: '',
        location: ''
    })

    // Initialiser la semaine courante
    useEffect(() => {
        const { week: w, year: y } = getISOWeekNumber(new Date())
        setWeek(w)
        setYear(y)
    }, [])

    useEffect(() => {
        if (week === 0 || year === 0) return
        fetchEvents()
    }, [week, year])

    async function fetchEvents() {
        setLoading(true)
        try {
            const res = await fetch(`/api/intranet/events?week=${week}&year=${year}`)
            if (res.ok) {
                const data = await res.json()
                setEvents(data.events || [])
            }
        } catch (e) {
            console.error('Error fetching events:', e)
        }
        setLoading(false)
    }

    function getISOWeekNumber(date: Date): { week: number; year: number } {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
        const dayNum = d.getUTCDay() || 7
        d.setUTCDate(d.getUTCDate() + 4 - dayNum)
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
        const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
        return { week: weekNo, year: d.getUTCFullYear() }
    }

    const weekDates = useMemo(() => {
        if (week === 0 || year === 0) return []
        const jan4 = new Date(year, 0, 4)
        const dayOfWeek = jan4.getDay() || 7
        const monday = new Date(jan4)
        monday.setDate(jan4.getDate() - dayOfWeek + 1 + (week - 1) * 7)
        return Array.from({ length: 7 }, (_, i) => {
            const date = new Date(monday)
            date.setDate(monday.getDate() + i)
            return date
        })
    }, [week, year])

    function formatDateLocal(date: Date): string {
        return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`
    }

    function getEventsForDay(dayIndex: number): Event[] {
        if (weekDates.length === 0) return []
        const date = weekDates[dayIndex]
        const dateStr = formatDateLocal(date)

        return events.filter(event => {
            const eventDate = event.event_date.split('T')[0]

            // Si cet événement est en cours de drag
            if (dragState?.type === 'drag' && dragState.eventId === event.id) {
                // L'afficher dans le dayIndex courant du drag
                return dayIndex === dragState.dayIndex
            }

            // Sinon, afficher normalement par date
            return eventDate === dateStr
        })
    }

    // Convertir position Y en minutes (avec snapping)
    function yToMinutes(y: number): number {
        const rawMinutes = (y / HOUR_HEIGHT) * 60
        return Math.round(rawMinutes / SNAP_MINUTES) * SNAP_MINUTES
    }

    function minutesToTime(minutes: number): string {
        const h = Math.floor(minutes / 60)
        const m = minutes % 60
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
    }

    function timeToMinutes(time: string): number {
        const parts = time.split(':')
        return parseInt(parts[0]) * 60 + parseInt(parts[1] || '0')
    }

    function getEventStyle(event: Event, overlappingCount: number, overlapIndex: number) {
        const startMinutes = timeToMinutes(event.start_time?.slice(0, 5) || '00:00')
        const endMinutes = timeToMinutes(event.end_time?.slice(0, 5) || '01:00')
        const top = (startMinutes / 60) * HOUR_HEIGHT
        const height = Math.max(((endMinutes - startMinutes) / 60) * HOUR_HEIGHT, 20)
        const width = overlappingCount > 1 ? `${100 / overlappingCount}%` : '100%'
        const left = overlappingCount > 1 ? `${(overlapIndex * 100) / overlappingCount}%` : '0'
        return { top, height, width, left }
    }

    function getOverlappingEvents(events: Event[]): Map<string, { count: number; index: number }> {
        const result = new Map<string, { count: number; index: number }>()
        events.forEach((event, i) => {
            const startA = timeToMinutes(event.start_time?.slice(0, 5) || '00:00')
            const endA = timeToMinutes(event.end_time?.slice(0, 5) || '01:00')
            let overlapGroup: Event[] = [event]
            events.forEach((other, j) => {
                if (i === j) return
                const startB = timeToMinutes(other.start_time?.slice(0, 5) || '00:00')
                const endB = timeToMinutes(other.end_time?.slice(0, 5) || '01:00')
                if (startA < endB && endA > startB) overlapGroup.push(other)
            })
            const sortedGroup = overlapGroup.sort((a, b) =>
                timeToMinutes(a.start_time?.slice(0, 5) || '00:00') - timeToMinutes(b.start_time?.slice(0, 5) || '00:00')
            )
            result.set(event.id, { count: overlapGroup.length, index: sortedGroup.findIndex(e => e.id === event.id) })
        })
        return result
    }

    // Mise à jour d'un événement via API
    async function updateEventTime(eventId: string, startTime: string, endTime: string, newDate?: string) {
        const event = events.find(e => e.id === eventId)
        if (!event) return

        try {
            const res = await fetch(`/api/intranet/events?id=${eventId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    start_time: startTime,
                    end_time: endTime,
                    event_date: newDate || event.event_date.split('T')[0]
                })
            })
            if (res.ok) {
                fetchEvents()
            } else {
                toast.error("Erreur lors de la mise à jour")
            }
        } catch (e) {
            toast.error("Erreur de connexion")
        }
    }

    async function updateEventTitle(eventId: string, title: string) {
        try {
            const res = await fetch(`/api/intranet/events?id=${eventId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title })
            })
            if (res.ok) {
                fetchEvents()
            }
        } catch (e) {
            console.error(e)
        }
    }

    async function updateEventType(eventId: string, eventType: string) {
        const eventTypeInfo = EVENT_TYPES.find(t => t.value === eventType)
        try {
            const res = await fetch(`/api/intranet/events?id=${eventId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    event_type: eventType,
                    event_size: eventTypeInfo?.size || 'minor',
                    color: eventTypeInfo?.color || '#6b7280'
                })
            })
            if (res.ok) {
                toast.success("Type modifié")
                fetchEvents()
            }
        } catch (e) {
            toast.error("Erreur")
        }
        setContextMenu(null)
    }

    async function deleteEvent(eventId: string) {
        // Trouver l'événement pour le titre
        const event = events.find(e => e.id === eventId)
        setDeleteConfirm({ eventId, title: event?.title || 'Événement' })
        setContextMenu(null)
    }

    async function confirmDeleteEvent() {
        if (!deleteConfirm) return
        try {
            const res = await fetch(`/api/intranet/events?id=${deleteConfirm.eventId}`, { method: 'DELETE' })
            if (res.ok) {
                toast.success("Événement supprimé")
                fetchEvents()
            } else {
                const error = await res.json()
                toast.error(error.error || "Erreur")
            }
        } catch (e) {
            toast.error("Erreur de connexion")
        }
        setDeleteConfirm(null)
    }

    function handleContextMenu(e: React.MouseEvent, event: Event) {
        e.preventDefault()
        e.stopPropagation()
        setHoveredEvent(null)
        setContextMenu({ event, x: e.clientX, y: e.clientY })
    }

    // Gestion du drag & resize
    const handleMouseDown = useCallback((
        e: React.MouseEvent,
        eventId: string,
        type: 'drag' | 'resize-top' | 'resize-bottom',
        dayIndex: number,
        top: number,
        height: number
    ) => {
        // Ignorer le clic droit (pour laisser passer le context menu)
        if (e.button !== 0) return

        e.preventDefault()
        e.stopPropagation()
        setHoveredEvent(null)
        setContextMenu(null)
        setDragState({
            type,
            eventId,
            startY: e.clientY,
            startX: e.clientX,
            startTop: top,
            startHeight: height,
            dayIndex,
            originalDayIndex: dayIndex,
            hasMoved: false
        })
    }, [])

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!dragState || !gridRef.current) return

        const deltaY = e.clientY - dragState.startY
        const deltaX = e.clientX - dragState.startX
        const event = events.find(ev => ev.id === dragState.eventId)
        if (!event) return

        const startMinutes = timeToMinutes(event.start_time?.slice(0, 5) || '00:00')
        const endMinutes = timeToMinutes(event.end_time?.slice(0, 5) || '01:00')
        const duration = endMinutes - startMinutes

        // Seuil minimum de mouvement (5px) pour considérer un drag
        const MIN_MOVE = 5
        const totalMove = Math.abs(deltaX) + Math.abs(deltaY)
        if (!dragState.hasMoved && totalMove >= MIN_MOVE) {
            setDragState(prev => prev ? { ...prev, hasMoved: true } : null)
        }

        // Ne pas modifier si pas assez de mouvement
        if (totalMove < MIN_MOVE) return

        if (dragState.type === 'drag') {
            const newTop = Math.max(0, dragState.startTop + deltaY)
            const newStartMinutes = yToMinutes(newTop)
            const newEndMinutes = newStartMinutes + duration

            // Calculer le jour basé sur le mouvement horizontal
            const gridRect = gridRef.current.getBoundingClientRect()
            const colWidth = (gridRect.width - 60) / 7 // 60px pour la colonne des heures
            const dayOffset = Math.round(deltaX / colWidth)
            const newDayIndex = Math.max(0, Math.min(6, dragState.originalDayIndex + dayOffset))

            if (newEndMinutes <= 24 * 60) {
                setEvents(prev => prev.map(ev =>
                    ev.id === dragState.eventId
                        ? { ...ev, start_time: minutesToTime(newStartMinutes), end_time: minutesToTime(newEndMinutes) }
                        : ev
                ))
                // Mettre à jour le dayIndex courant
                if (newDayIndex !== dragState.dayIndex) {
                    setDragState(prev => prev ? { ...prev, dayIndex: newDayIndex } : null)
                }
            }
        } else if (dragState.type === 'resize-bottom') {
            const newHeight = Math.max(HOUR_HEIGHT / 3, dragState.startHeight + deltaY)
            const newEndMinutes = yToMinutes(dragState.startTop + newHeight)

            if (newEndMinutes > startMinutes && newEndMinutes <= 24 * 60) {
                setEvents(prev => prev.map(ev =>
                    ev.id === dragState.eventId
                        ? { ...ev, end_time: minutesToTime(newEndMinutes) }
                        : ev
                ))
            }
        } else if (dragState.type === 'resize-top') {
            const newTop = Math.max(0, dragState.startTop + deltaY)
            const newStartMinutes = yToMinutes(newTop)

            if (newStartMinutes < endMinutes && newStartMinutes >= 0) {
                setEvents(prev => prev.map(ev =>
                    ev.id === dragState.eventId
                        ? { ...ev, start_time: minutesToTime(newStartMinutes) }
                        : ev
                ))
            }
        }
    }, [dragState, events])

    const handleMouseUp = useCallback(() => {
        if (!dragState) return

        const event = events.find(ev => ev.id === dragState.eventId)

        // Ne sauvegarder que si on a vraiment bougé
        if (event && dragState.hasMoved) {
            let newDate: string | undefined
            if (dragState.dayIndex !== dragState.originalDayIndex && weekDates[dragState.dayIndex]) {
                const targetDate = weekDates[dragState.dayIndex]
                newDate = formatDateLocal(targetDate)
            }
            updateEventTime(dragState.eventId, event.start_time || '00:00', event.end_time || '01:00', newDate)
        }

        setDragState(null)
    }, [dragState, events, weekDates])

    useEffect(() => {
        if (dragState) {
            window.addEventListener('mousemove', handleMouseMove)
            window.addEventListener('mouseup', handleMouseUp)
            return () => {
                window.removeEventListener('mousemove', handleMouseMove)
                window.removeEventListener('mouseup', handleMouseUp)
            }
        }
    }, [dragState, handleMouseMove, handleMouseUp])

    // Créer un événement au clic
    function handleGridClick(dayIndex: number, e: React.MouseEvent<HTMLDivElement>) {
        if (dragState) return
        const rect = e.currentTarget.getBoundingClientRect()
        const y = e.clientY - rect.top
        const startMinutes = yToMinutes(y)
        const endMinutes = startMinutes + 60

        const date = weekDates[dayIndex]
        if (!date) return

        setFormData({
            title: '',
            event_type: 'rdv',
            event_date: formatDateLocal(date),
            start_time: minutesToTime(startMinutes),
            end_time: minutesToTime(Math.min(endMinutes, 24 * 60 - 1)),
            description: '',
            location: ''
        })
        setEditingEvent(null)
        setShowModal(true)
    }

    // Édition inline du titre
    function handleTitleDoubleClick(eventId: string, currentTitle: string) {
        setEditingTitle(eventId)
        setTempTitle(currentTitle)
    }

    function handleTitleBlur() {
        if (editingTitle && tempTitle.trim()) {
            updateEventTitle(editingTitle, tempTitle.trim())
        }
        setEditingTitle(null)
        setTempTitle('')
    }

    function handleTitleKeyDown(e: React.KeyboardEvent) {
        if (e.key === 'Enter') {
            handleTitleBlur()
        } else if (e.key === 'Escape') {
            setEditingTitle(null)
            setTempTitle('')
        }
    }

    // Navigation
    function goToPreviousWeek() {
        if (week === 1) { setWeek(52); setYear(year - 1) }
        else { setWeek(week - 1) }
    }

    function goToNextWeek() {
        if (week >= 52) { setWeek(1); setYear(year + 1) }
        else { setWeek(week + 1) }
    }

    function goToCurrentWeek() {
        const { week: w, year: y } = getISOWeekNumber(new Date())
        setWeek(w)
        setYear(y)
    }

    function openEditEvent(event: Event) {
        const formatTime = (time: string | null) => time ? time.slice(0, 5) : '09:00'
        setFormData({
            title: event.title,
            event_type: event.event_type,
            event_date: event.event_date.split('T')[0],
            start_time: formatTime(event.start_time),
            end_time: formatTime(event.end_time),
            description: event.description || '',
            location: event.location || ''
        })
        setEditingEvent(event)
        setShowModal(true)
    }

    async function handleSave() {
        if (!formData.title.trim()) {
            toast.error("Le titre est requis")
            return
        }
        setSaving(true)
        try {
            const eventType = EVENT_TYPES.find(t => t.value === formData.event_type)
            const payload = {
                ...formData,
                event_size: eventType?.size || 'minor',
                color: eventType?.color || '#6b7280',
                is_published: true,
                participants_all: true
            }
            const url = editingEvent ? `/api/intranet/events?id=${editingEvent.id}` : '/api/intranet/events'
            const res = await fetch(url, {
                method: editingEvent ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
            if (res.ok) {
                toast.success(editingEvent ? "Événement modifié" : "Événement créé")
                setShowModal(false)
                fetchEvents()
            } else {
                const error = await res.json()
                toast.error(error.error || "Erreur lors de la sauvegarde")
            }
        } catch (e) {
            toast.error("Erreur de connexion")
        }
        setSaving(false)
    }

    async function handleDelete() {
        if (!editingEvent) return
        setDeleteConfirm({ eventId: editingEvent.id, title: editingEvent.title })
        setShowModal(false)
    }

    return (
        <div className="py-4 md:py-8 space-y-6">
            <Breadcrumbs items={[
                { label: 'Intranet', href: '/intranet' },
                { label: 'Planning', href: '/intranet/planning' }
            ]} />

            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
            >
                <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                        <Calendar className="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                        <h1 className="font-display text-2xl md:text-3xl font-bold text-white">
                            Emploi du temps
                        </h1>
                        <p className="text-gray-500 text-sm">Semaine {week} • {year}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button onClick={goToCurrentWeek} className="px-4 py-2 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-gray-300 hover:text-white hover:border-blue-500/50 transition-colors text-sm">
                        Aujourd'hui
                    </button>
                    <div className="flex items-center gap-1">
                        <button onClick={goToPreviousWeek} className="p-2 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-gray-400 hover:text-white transition-colors">
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button onClick={goToNextWeek} className="p-2 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-gray-400 hover:text-white transition-colors">
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                    <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 transition-colors">
                        <Plus className="w-4 h-4" />
                        Ajouter
                    </button>
                </div>
            </motion.div>

            {/* Grille */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl bg-[#141414] border border-[#2a2a2a] overflow-hidden"
            >
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
                    </div>
                ) : (
                    <div className="overflow-x-auto" ref={gridRef}>
                        <div className="min-w-[900px]">
                            {/* Header jours */}
                            <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-[#2a2a2a]">
                                <div className="p-2"></div>
                                {DAYS.map((day, i) => {
                                    const date = weekDates[i]
                                    const isToday = date && date.toDateString() === new Date().toDateString()
                                    return (
                                        <div key={day} className="p-2 text-center border-l border-[#2a2a2a]">
                                            <div className={`text-xs font-medium ${isToday ? 'text-blue-400' : 'text-gray-400'}`}>{DAYS_SHORT[i]}</div>
                                            <div className={`text-lg font-bold ${isToday ? 'text-blue-400' : 'text-white'}`}>{date?.getDate()}</div>
                                        </div>
                                    )
                                })}
                            </div>

                            {/* Corps grille */}
                            <div className="grid grid-cols-[60px_repeat(7,1fr)]">
                                <div>
                                    {HOURS.map(hour => (
                                        <div key={hour} className="text-xs text-gray-500 text-right pr-2 border-b border-[#1a1a1a]" style={{ height: HOUR_HEIGHT }}>
                                            {hour.toString().padStart(2, '0')}:00
                                        </div>
                                    ))}
                                </div>

                                {DAYS.map((_, dayIndex) => {
                                    const dayEvents = getEventsForDay(dayIndex)
                                    const overlaps = getOverlappingEvents(dayEvents)

                                    return (
                                        <div
                                            key={dayIndex}
                                            className="relative border-l border-[#2a2a2a] cursor-crosshair"
                                            style={{ height: HOURS.length * HOUR_HEIGHT }}
                                            onClick={(e) => handleGridClick(dayIndex, e)}
                                        >
                                            {/* Lignes heures */}
                                            {HOURS.map(hour => (
                                                <div
                                                    key={hour}
                                                    className="absolute w-full border-b border-[#1a1a1a] pointer-events-none"
                                                    style={{ top: hour * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                                                />
                                            ))}

                                            {/* Événements */}
                                            {dayEvents.map(event => {
                                                const overlap = overlaps.get(event.id) || { count: 1, index: 0 }
                                                const style = getEventStyle(event, overlap.count, overlap.index)
                                                const isEditing = editingTitle === event.id
                                                const isDragging = dragState?.eventId === event.id
                                                // Utiliser la couleur du type en priorité
                                                const eventType = EVENT_TYPES.find(t => t.value === event.event_type)
                                                const eventColor = eventType?.color || event.color || '#6b7280'

                                                return (
                                                    <div
                                                        key={event.id}
                                                        className={`absolute rounded overflow-hidden select-none ${isDragging ? 'opacity-80 shadow-lg' : ''}`}
                                                        style={{
                                                            top: style.top,
                                                            height: style.height,
                                                            width: `calc(${style.width} - 2px)`,
                                                            left: `calc(${style.left} + 1px)`,
                                                            backgroundColor: eventColor,
                                                            zIndex: isDragging ? 100 : 10 + overlap.index,
                                                            cursor: isDragging ? 'grabbing' : 'grab'
                                                        }}
                                                        onClick={(e) => e.stopPropagation()}
                                                        onContextMenu={(e) => handleContextMenu(e, event)}
                                                        onMouseEnter={(e) => {
                                                            if (!dragState) {
                                                                const rect = e.currentTarget.getBoundingClientRect()
                                                                setHoveredEvent({ event, x: rect.right + 10, y: rect.top })
                                                            }
                                                        }}
                                                        onMouseLeave={() => setHoveredEvent(null)}
                                                    >
                                                        {/* Poignée resize haut */}
                                                        <div
                                                            className="absolute top-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-white/20"
                                                            onMouseDown={(e) => handleMouseDown(e, event.id, 'resize-top', dayIndex, style.top, style.height)}
                                                        />

                                                        {/* Contenu */}
                                                        <div
                                                            className="px-1.5 py-1 h-full flex flex-col text-white"
                                                            onMouseDown={(e) => handleMouseDown(e, event.id, 'drag', dayIndex, style.top, style.height)}
                                                            onDoubleClick={() => openEditEvent(event)}
                                                        >
                                                            {isEditing ? (
                                                                <input
                                                                    type="text"
                                                                    value={tempTitle}
                                                                    onChange={(e) => setTempTitle(e.target.value)}
                                                                    onBlur={handleTitleBlur}
                                                                    onKeyDown={handleTitleKeyDown}
                                                                    className="bg-transparent border-b border-white/50 outline-none text-sm font-medium w-full"
                                                                    autoFocus
                                                                    onClick={(e) => e.stopPropagation()}
                                                                />
                                                            ) : (
                                                                <div
                                                                    className="font-medium text-sm truncate leading-tight cursor-text"
                                                                    onDoubleClick={(e) => { e.stopPropagation(); handleTitleDoubleClick(event.id, event.title) }}
                                                                >
                                                                    {event.title}
                                                                </div>
                                                            )}
                                                            {style.height > 35 && (
                                                                <div className="text-[10px] opacity-80 truncate mt-0.5">
                                                                    {(event.start_time || '').slice(0, 5)} - {(event.end_time || '').slice(0, 5)}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Poignée resize bas */}
                                                        <div
                                                            className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-white/20"
                                                            onMouseDown={(e) => handleMouseDown(e, event.id, 'resize-bottom', dayIndex, style.top, style.height)}
                                                        />
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </motion.div>

            {/* Légende */}
            <div className="flex flex-wrap gap-4 text-xs">
                {EVENT_TYPES.map(type => (
                    <div key={type.value} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded" style={{ backgroundColor: type.color }} />
                        <span className="text-gray-400">{type.label}</span>
                    </div>
                ))}
                <div className="ml-auto text-gray-500 text-[10px]">
                    Double-clic: modifier • Glisser: déplacer • Bords: redimensionner
                </div>
            </div>

            {/* Tooltip personnalisé */}
            <AnimatePresence>
                {hoveredEvent && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.1 }}
                        className="fixed z-[200] pointer-events-none"
                        style={{
                            left: Math.min(hoveredEvent.x, window.innerWidth - 250),
                            top: Math.max(10, Math.min(hoveredEvent.y, window.innerHeight - 150))
                        }}
                    >
                        <div className="bg-[#1a1a1a] border border-[#3a3a3a] rounded-lg shadow-xl p-3 min-w-[200px] max-w-[250px]">
                            <div className="font-medium text-white text-sm mb-2">{hoveredEvent.event.title}</div>
                            <div className="space-y-1 text-xs text-gray-400">
                                <div className="flex items-center gap-2">
                                    <span className="text-gray-500">Horaire:</span>
                                    <span>{(hoveredEvent.event.start_time || '').slice(0, 5)} - {(hoveredEvent.event.end_time || '').slice(0, 5)}</span>
                                </div>
                                {hoveredEvent.event.location && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-gray-500">Lieu:</span>
                                        <span>{hoveredEvent.event.location}</span>
                                    </div>
                                )}
                                {hoveredEvent.event.description && (
                                    <div className="mt-2 text-gray-500 italic">{hoveredEvent.event.description}</div>
                                )}
                                {hoveredEvent.event.created_by_name && (
                                    <div className="flex items-center gap-2 mt-2">
                                        <span className="text-gray-500">Créé par:</span>
                                        <span>{hoveredEvent.event.created_by_name}</span>
                                    </div>
                                )}
                            </div>
                            <div className="mt-3 pt-2 border-t border-[#2a2a2a] text-[10px] text-gray-500">
                                💡 Double-cliquer pour modifier • Clic droit pour options
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Menu contextuel */}
            <AnimatePresence>
                {contextMenu && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.1 }}
                        className="fixed z-[300]"
                        style={{
                            left: Math.min(contextMenu.x, window.innerWidth - 200),
                            top: Math.min(contextMenu.y, window.innerHeight - 300)
                        }}
                    >
                        <div
                            className="bg-[#1a1a1a] border border-[#3a3a3a] rounded-lg shadow-xl overflow-hidden min-w-[180px]"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className="px-3 py-2 border-b border-[#2a2a2a] bg-[#0a0a0a]">
                                <div className="text-xs text-gray-400 truncate">{contextMenu.event.title}</div>
                            </div>

                            {/* Changer le type */}
                            <div className="px-2 py-1.5 border-b border-[#2a2a2a]">
                                <div className="text-[10px] text-gray-500 px-1 mb-1">Changer le type</div>
                                <div className="grid grid-cols-2 gap-1">
                                    {EVENT_TYPES.filter(t => t.value !== 'general').map(type => (
                                        <button
                                            key={type.value}
                                            onClick={() => updateEventType(contextMenu.event.id, type.value)}
                                            className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs text-left hover:bg-[#2a2a2a] transition-colors ${contextMenu.event.event_type === type.value ? 'bg-[#2a2a2a]' : ''}`}
                                        >
                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: type.color }} />
                                            <span className="text-gray-300 truncate">{type.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="py-1">
                                <button
                                    onClick={() => { openEditEvent(contextMenu.event); setContextMenu(null) }}
                                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-300 hover:bg-[#2a2a2a] transition-colors text-left"
                                >
                                    ✏️ Modifier
                                </button>
                                <button
                                    onClick={() => deleteEvent(contextMenu.event.id)}
                                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors text-left"
                                >
                                    🗑️ Supprimer
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Overlay pour fermer le menu contextuel */}
            {contextMenu && (
                <div
                    className="fixed inset-0 z-[250]"
                    onClick={() => setContextMenu(null)}
                />
            )}

            <AnimatePresence>
                {showModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => setShowModal(false)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-[#141414] border border-[#2a2a2a] rounded-xl w-full max-w-md overflow-hidden"
                        >
                            <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a]">
                                <h3 className="font-display font-bold text-lg text-white">
                                    {editingEvent ? 'Modifier l\'événement' : 'Nouvel événement'}
                                </h3>
                                <button onClick={() => setShowModal(false)} className="p-1 text-gray-400 hover:text-white transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="px-6 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">Catégorie *</label>
                                    <select
                                        value={formData.event_type}
                                        onChange={(e) => setFormData({ ...formData, event_type: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-white focus:outline-none focus:border-blue-500/50"
                                    >
                                        {EVENT_TYPES.map(type => (
                                            <option key={type.value} value={type.value}>{type.label}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">Titre *</label>
                                    <input
                                        type="text"
                                        value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                        placeholder="Ex: RDV avec M. Dupont"
                                        className="w-full px-3 py-2 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">Date *</label>
                                    <input
                                        type="date"
                                        value={formData.event_date}
                                        onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-white focus:outline-none focus:border-blue-500/50"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-2">Début *</label>
                                        <input
                                            type="time"
                                            value={formData.start_time}
                                            onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                                            className="w-full px-3 py-2 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-white focus:outline-none focus:border-blue-500/50"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-2">Fin *</label>
                                        <input
                                            type="time"
                                            value={formData.end_time}
                                            onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                                            className="w-full px-3 py-2 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-white focus:outline-none focus:border-blue-500/50"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">Lieu (optionnel)</label>
                                    <input
                                        type="text"
                                        value={formData.location}
                                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                        placeholder="Ex: Bureau médical"
                                        className="w-full px-3 py-2 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">Description (optionnel)</label>
                                    <textarea
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        rows={2}
                                        placeholder="Notes..."
                                        className="w-full px-3 py-2 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 resize-none"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-between px-6 py-4 border-t border-[#2a2a2a] bg-[#0a0a0a]">
                                <div>
                                    {editingEvent && (
                                        <button onClick={handleDelete} className="flex items-center gap-2 px-3 py-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors text-sm">
                                            <Trash2 className="w-4 h-4" />
                                            Supprimer
                                        </button>
                                    )}
                                </div>
                                <div className="flex items-center gap-3">
                                    <button onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-400 hover:text-white transition-colors text-sm">
                                        Annuler
                                    </button>
                                    <button
                                        onClick={handleSave}
                                        disabled={saving}
                                        className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg disabled:opacity-50 transition-colors text-sm"
                                    >
                                        <Save className="w-4 h-4" />
                                        {saving ? 'Sauvegarde...' : 'Sauvegarder'}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
            {/* Delete Confirmation Modal */}
            <AnimatePresence>
                {deleteConfirm && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
                        onClick={() => setDeleteConfirm(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-6 max-w-md w-full"
                        >
                            <h3 className="font-display text-xl font-bold text-white mb-2">
                                Supprimer l'événement ?
                            </h3>
                            <p className="text-gray-400 mb-6">
                                Êtes-vous sûr de vouloir supprimer <span className="text-white font-medium">"{deleteConfirm.title}"</span> ?
                                Cette action est irréversible.
                            </p>
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => setDeleteConfirm(null)}
                                    className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                                >
                                    Annuler
                                </button>
                                <button
                                    onClick={confirmDeleteEvent}
                                    className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Supprimer
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
