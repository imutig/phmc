"use client"

import { motion } from "framer-motion"
import { FileQuestion, Search, Calendar, Pill, DollarSign, Users, Book, Clock } from "lucide-react"
import { ReactNode } from "react"

type EmptyStateType = 'default' | 'search' | 'calendar' | 'medications' | 'tarifs' | 'users' | 'wiki' | 'services'

interface EmptyStateProps {
    type?: EmptyStateType
    title?: string
    description?: string
    action?: ReactNode
}

const icons: Record<EmptyStateType, typeof FileQuestion> = {
    default: FileQuestion,
    search: Search,
    calendar: Calendar,
    medications: Pill,
    tarifs: DollarSign,
    users: Users,
    wiki: Book,
    services: Clock
}

const defaultMessages: Record<EmptyStateType, { title: string; description: string }> = {
    default: {
        title: "Aucun élément",
        description: "Il n'y a rien à afficher pour le moment."
    },
    search: {
        title: "Aucun résultat",
        description: "Essayez de modifier votre recherche ou vos filtres."
    },
    calendar: {
        title: "Aucun événement",
        description: "Il n'y a pas d'événements programmés pour cette période."
    },
    medications: {
        title: "Aucun médicament",
        description: "La base de données est vide. Ajoutez un premier médicament."
    },
    tarifs: {
        title: "Aucun soin",
        description: "Aucun soin n'a été ajouté à cette catégorie."
    },
    users: {
        title: "Aucun utilisateur",
        description: "Aucun membre ne correspond aux critères."
    },
    wiki: {
        title: "Aucun article",
        description: "Le wiki est vide. Créez un premier article pour commencer."
    },
    services: {
        title: "Aucun service",
        description: "Vous n'avez pas encore enregistré de service cette semaine."
    }
}

export function EmptyState({ type = 'default', title, description, action }: EmptyStateProps) {
    const Icon = icons[type]
    const messages = defaultMessages[type]

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-12 px-4 text-center"
        >
            <div className="w-16 h-16 rounded-full bg-gray-800/50 flex items-center justify-center mb-4">
                <Icon className="w-8 h-8 text-gray-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-300 mb-2">
                {title || messages.title}
            </h3>
            <p className="text-sm text-gray-500 max-w-sm mb-4">
                {description || messages.description}
            </p>
            {action && (
                <div className="mt-2">
                    {action}
                </div>
            )}
        </motion.div>
    )
}
