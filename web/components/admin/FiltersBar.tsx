"use client"

import { Filter, Search } from "lucide-react"

interface FiltersBarProps {
    searchQuery: string
    onSearchChange: (value: string) => void
    filterStatus: string
    onStatusChange: (value: string) => void
    filterService: string
    onServiceChange: (value: string) => void
}

export function FiltersBar({
    searchQuery,
    onSearchChange,
    filterStatus,
    onStatusChange,
    filterService,
    onServiceChange
}: FiltersBarProps) {
    return (
        <div className="flex flex-wrap gap-4 mb-6 p-4 border border-white/10 bg-white/[0.02] backdrop-blur-sm">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-gray-500" />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder="Rechercher par nom ou pseudo..."
                    className="flex-1 bg-transparent border-none text-white text-sm focus:outline-none placeholder:text-gray-600"
                />
            </div>
            <div className="h-6 w-px bg-white/10" />
            <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-400">Filtres:</span>
            </div>
            <select
                value={filterStatus}
                onChange={(e) => onStatusChange(e.target.value)}
                className="bg-black/50 border border-white/10 px-3 py-1.5 text-sm text-white focus:outline-none hover:bg-white/5 transition-colors cursor-pointer"
            >
                <option value="all">Tous les statuts</option>
                <option value="pending">En attente</option>
                <option value="reviewing">En examen</option>
                <option value="interview_scheduled">Entretien planifié</option>
                <option value="interview_passed">Entretien réussi</option>
                <option value="interview_failed">Entretien échoué</option>
                <option value="training">Formation</option>
                <option value="recruited">Recruté</option>
                <option value="rejected">Refusé</option>
            </select>
            <select
                value={filterService}
                onChange={(e) => onServiceChange(e.target.value)}
                className="bg-black/50 border border-white/10 px-3 py-1.5 text-sm text-white focus:outline-none hover:bg-white/5 transition-colors cursor-pointer"
            >
                <option value="all">Tous les services</option>
                <option value="EMS">EMS</option>
            </select>
        </div>
    )
}
