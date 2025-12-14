"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Search, X, Loader2, Book, Pill, DollarSign, FileText, ChevronRight } from "lucide-react"
import Link from "next/link"
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts"

interface SearchResult {
    id: string
    type: 'wiki' | 'medication' | 'care' | 'other'
    title: string
    subtitle?: string
    url: string
}

interface GlobalSearchProps {
    isOpen: boolean
    onClose: () => void
}

const typeIcons = {
    wiki: Book,
    medication: Pill,
    care: DollarSign,
    other: FileText
}

const typeLabels = {
    wiki: 'Wiki',
    medication: 'Médicament',
    care: 'Soin',
    other: 'Autre'
}

const typeColors = {
    wiki: 'text-blue-400',
    medication: 'text-green-400',
    care: 'text-yellow-400',
    other: 'text-gray-400'
}

export function GlobalSearch({ isOpen, onClose }: GlobalSearchProps) {
    const [query, setQuery] = useState("")
    const [results, setResults] = useState<SearchResult[]>([])
    const [loading, setLoading] = useState(false)
    const [selectedIndex, setSelectedIndex] = useState(0)
    const inputRef = useRef<HTMLInputElement>(null)
    const debounceRef = useRef<NodeJS.Timeout | null>(null)

    // Focus input when opened
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 100)
        } else {
            setQuery("")
            setResults([])
            setSelectedIndex(0)
        }
    }, [isOpen])

    // Search with debounce
    const search = useCallback(async (searchQuery: string) => {
        if (searchQuery.length < 2) {
            setResults([])
            return
        }

        setLoading(true)
        try {
            const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`)
            if (response.ok) {
                const data = await response.json()
                setResults(data.results || [])
                setSelectedIndex(0)
            }
        } catch (error) {
            console.error('Search error:', error)
        } finally {
            setLoading(false)
        }
    }, [])

    const handleInputChange = (value: string) => {
        setQuery(value)
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => search(value), 300)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault()
            setSelectedIndex(i => Math.min(i + 1, results.length - 1))
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setSelectedIndex(i => Math.max(i - 1, 0))
        } else if (e.key === 'Enter' && results[selectedIndex]) {
            window.location.href = results[selectedIndex].url
            onClose()
        }
    }

    // Escape to close
    useKeyboardShortcuts({
        shortcuts: [{ key: 'Escape', action: onClose }],
        enabled: isOpen
    })

    if (!isOpen) return null

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start justify-center pt-[15vh]"
                onClick={(e) => e.target === e.currentTarget && onClose()}
            >
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -20 }}
                    className="w-full max-w-2xl mx-4 bg-[#141414] border border-white/10 rounded-lg shadow-2xl overflow-hidden"
                >
                    {/* Search input */}
                    <div className="flex items-center gap-3 px-4 py-4 border-b border-white/10">
                        <Search className="w-5 h-5 text-gray-500" />
                        <input
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={e => handleInputChange(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Rechercher dans Wiki, Médicaments, Tarifs..."
                            className="flex-1 bg-transparent text-white placeholder-gray-500 outline-none text-lg"
                        />
                        {loading && <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />}
                        <button onClick={onClose} className="p-1 hover:bg-white/10 rounded">
                            <X className="w-5 h-5 text-gray-500" />
                        </button>
                    </div>

                    {/* Results */}
                    <div className="max-h-[400px] overflow-y-auto">
                        {query.length < 2 ? (
                            <div className="p-8 text-center text-gray-500">
                                <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                <p>Tapez au moins 2 caractères pour rechercher</p>
                                <p className="text-xs mt-2 text-gray-600">
                                    Astuce : <kbd className="px-1 py-0.5 bg-gray-800 rounded text-gray-400">Ctrl+K</kbd> pour ouvrir
                                </p>
                            </div>
                        ) : results.length === 0 && !loading ? (
                            <div className="p-8 text-center text-gray-500">
                                <p>Aucun résultat pour "{query}"</p>
                            </div>
                        ) : (
                            <div className="py-2">
                                {results.map((result, index) => {
                                    const Icon = typeIcons[result.type]
                                    return (
                                        <Link
                                            key={result.id}
                                            href={result.url}
                                            onClick={onClose}
                                            className={`flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors ${index === selectedIndex ? 'bg-white/10' : ''
                                                }`}
                                        >
                                            <div className={`p-2 rounded-lg bg-white/5 ${typeColors[result.type]}`}>
                                                <Icon className="w-4 h-4" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-white font-medium truncate">{result.title}</div>
                                                {result.subtitle && (
                                                    <div className="text-sm text-gray-500 truncate">{result.subtitle}</div>
                                                )}
                                            </div>
                                            <span className={`text-xs px-2 py-1 rounded ${typeColors[result.type]} bg-white/5`}>
                                                {typeLabels[result.type]}
                                            </span>
                                            <ChevronRight className="w-4 h-4 text-gray-600" />
                                        </Link>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    )
}
