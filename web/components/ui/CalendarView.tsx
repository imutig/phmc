"use client"

import { useState, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronLeft, ChevronRight, Plus } from "lucide-react"

interface CalendarEvent {
    id: string
    title: string
    event_date: string
    color: string
}

interface CalendarViewProps {
    events: CalendarEvent[]
    onEventClick?: (event: CalendarEvent) => void
    onDayClick?: (date: Date) => void
    canEdit?: boolean
}

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const MONTHS = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
]

export function CalendarView({ events, onEventClick, onDayClick, canEdit }: CalendarViewProps) {
    const [currentDate, setCurrentDate] = useState(new Date())

    const { weeks, month, year } = useMemo(() => {
        const year = currentDate.getFullYear()
        const month = currentDate.getMonth()

        // Premier jour du mois
        const firstDay = new Date(year, month, 1)
        // Dernier jour du mois
        const lastDay = new Date(year, month + 1, 0)

        // Ajuster pour commencer le lundi (0 = dimanche dans JS)
        let startDay = firstDay.getDay() - 1
        if (startDay === -1) startDay = 6

        // Créer les semaines
        const weeks: (Date | null)[][] = []
        let currentWeek: (Date | null)[] = []

        // Jours vides au début
        for (let i = 0; i < startDay; i++) {
            currentWeek.push(null)
        }

        // Jours du mois
        for (let day = 1; day <= lastDay.getDate(); day++) {
            currentWeek.push(new Date(year, month, day))
            if (currentWeek.length === 7) {
                weeks.push(currentWeek)
                currentWeek = []
            }
        }

        // Jours vides à la fin
        while (currentWeek.length > 0 && currentWeek.length < 7) {
            currentWeek.push(null)
        }
        if (currentWeek.length > 0) {
            weeks.push(currentWeek)
        }

        return { weeks, month, year }
    }, [currentDate])

    const getEventsForDay = (date: Date | null): CalendarEvent[] => {
        if (!date) return []
        return events.filter(event => {
            const eventDate = new Date(event.event_date)
            return eventDate.toDateString() === date.toDateString()
        })
    }

    const isToday = (date: Date | null): boolean => {
        if (!date) return false
        return date.toDateString() === new Date().toDateString()
    }

    const prevMonth = () => {
        setCurrentDate(new Date(year, month - 1, 1))
    }

    const nextMonth = () => {
        setCurrentDate(new Date(year, month + 1, 1))
    }

    const goToToday = () => {
        setCurrentDate(new Date())
    }

    return (
        <div className="bg-[#141414] border border-[#2a2a2a] rounded-lg overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-3 md:p-4 border-b border-[#2a2a2a]">
                <div className="flex items-center gap-2 md:gap-4">
                    <button
                        onClick={prevMonth}
                        className="p-1.5 md:p-2 hover:bg-white/10 rounded transition-colors"
                    >
                        <ChevronLeft className="w-4 h-4 md:w-5 md:h-5" />
                    </button>
                    <h2 className="font-display font-bold text-sm md:text-lg min-w-[120px] md:min-w-[180px] text-center capitalize">
                        {MONTHS[month]} {year}
                    </h2>
                    <button
                        onClick={nextMonth}
                        className="p-1.5 md:p-2 hover:bg-white/10 rounded transition-colors"
                    >
                        <ChevronRight className="w-4 h-4 md:w-5 md:h-5" />
                    </button>
                </div>
                <button
                    onClick={goToToday}
                    className="px-2 md:px-3 py-1 md:py-1.5 text-xs md:text-sm text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
                >
                    Aujourd'hui
                </button>
            </div>

            {/* Jours de la semaine */}
            <div className="grid grid-cols-7 border-b border-[#2a2a2a]">
                {DAYS.map(day => (
                    <div key={day} className="p-1 md:p-2 text-center text-[10px] md:text-xs text-gray-500 uppercase tracking-wider font-medium">
                        {day}
                    </div>
                ))}
            </div>

            {/* Grille du calendrier */}
            <div className="divide-y divide-[#2a2a2a]">
                {weeks.map((week, weekIndex) => (
                    <div key={weekIndex} className="grid grid-cols-7 divide-x divide-[#2a2a2a]">
                        {week.map((date, dayIndex) => {
                            const dayEvents = getEventsForDay(date)
                            const today = isToday(date)

                            return (
                                <div
                                    key={dayIndex}
                                    className={`
                                        min-h-[60px] md:min-h-[100px] p-0.5 md:p-1 transition-colors
                                        ${date ? 'hover:bg-white/5 cursor-pointer' : 'bg-black/30'}
                                    `}
                                    onClick={() => date && onDayClick?.(date)}
                                >
                                    {date && (
                                        <>
                                            <div className={`
                                                w-5 h-5 md:w-7 md:h-7 flex items-center justify-center text-[10px] md:text-sm mb-0.5 md:mb-1 rounded-full mx-auto md:mx-0
                                                ${today ? 'bg-red-500 text-white font-bold' : 'text-gray-400'}
                                            `}>
                                                {date.getDate()}
                                            </div>

                                            <div className="space-y-0.5 md:space-y-1">
                                                {dayEvents.slice(0, 2).map(event => (
                                                    <motion.div
                                                        key={event.id}
                                                        initial={{ opacity: 0, scale: 0.9 }}
                                                        animate={{ opacity: 1, scale: 1 }}
                                                        className="text-[8px] md:text-xs px-0.5 md:px-1.5 py-0 md:py-0.5 rounded truncate cursor-pointer hover:opacity-80"
                                                        style={{ backgroundColor: event.color + '30', color: event.color }}
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            onEventClick?.(event)
                                                        }}
                                                        title={event.title}
                                                    >
                                                        <span className="hidden md:inline">{event.title}</span>
                                                        <span className="md:hidden">{event.title.slice(0, 3)}...</span>
                                                    </motion.div>
                                                ))}
                                                {dayEvents.length > 2 && (
                                                    <div className="text-[8px] md:text-xs text-gray-500 px-0.5 md:px-1">
                                                        +{dayEvents.length - 2}
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                ))}
            </div>
        </div>
    )
}
