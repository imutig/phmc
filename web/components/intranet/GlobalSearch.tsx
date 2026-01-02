"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Search, X, FileText, Pill, DollarSign, BookOpen, Clock, Settings, ArrowRight, Command, User } from "lucide-react"
import { useRouter } from "next/navigation"

interface SearchResult {
    id: string
    type: 'page' | 'medication' | 'tarif' | 'wiki' | 'action'
    title: string
    description?: string
    href?: string
    action?: () => void
    icon: any
    category: string
}

// Pages et actions disponibles
const PAGES: SearchResult[] = [
    { id: 'home', type: 'page', title: 'Accueil', description: 'Page d\'accueil intranet', href: '/intranet', icon: Search, category: 'Pages' },
    { id: 'services', type: 'page', title: 'Mes services', description: 'Historique de vos prises de service', href: '/intranet/services', icon: Clock, category: 'Pages' },
    { id: 'ordonnance', type: 'page', title: 'Créer ordonnance', description: 'Générer une nouvelle ordonnance', href: '/intranet/ordonnance', icon: FileText, category: 'Actions' },
    { id: 'tarifs', type: 'page', title: 'Tarifs', description: 'Grille tarifaire des soins', href: '/intranet/tarifs', icon: DollarSign, category: 'Pages' },
    { id: 'medicaments', type: 'page', title: 'Médicaments', description: 'Base de données médicaments', href: '/intranet/medicaments', icon: Pill, category: 'Pages' },
    { id: 'wiki', type: 'page', title: 'Wiki', description: 'Documentation interne', href: '/intranet/wiki', icon: BookOpen, category: 'Pages' },
    { id: 'planning', type: 'page', title: 'Planning', description: 'Calendrier des événements', href: '/intranet/planning', icon: Clock, category: 'Pages' },
    { id: 'reglement', type: 'page', title: 'Règlement', description: 'Règlement interne', href: '/intranet/reglement', icon: FileText, category: 'Pages' },
    { id: 'permissions', type: 'page', title: 'Permissions', description: 'Gestion des permissions', href: '/intranet/permissions', icon: Settings, category: 'Administration' },
    { id: 'dashboard', type: 'page', title: 'Dashboard', description: 'Statistiques et analyses', href: '/intranet/dashboard', icon: Settings, category: 'Administration' },
]

export function GlobalSearch() {
    const [isOpen, setIsOpen] = useState(false)
    const [query, setQuery] = useState("")
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [medications, setMedications] = useState<any[]>([])
    const [tarifs, setTarifs] = useState<any[]>([])
    const [patients, setPatients] = useState<any[]>([])
    const inputRef = useRef<HTMLInputElement>(null)
    const router = useRouter()

    // Écouter Cmd+K ou Ctrl+K
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault()
                setIsOpen(true)
            }
            if (e.key === 'Escape') {
                setIsOpen(false)
            }
        }

        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [])

    // Focus input à l'ouverture
    useEffect(() => {
        if (isOpen) {
            inputRef.current?.focus()
            // Charger les données dynamiques
            fetchDynamicData()
        } else {
            setQuery("")
            setSelectedIndex(0)
            setPatients([])
        }
    }, [isOpen])

    // Rechercher les patients
    useEffect(() => {
        if (!query.trim()) {
            setPatients([])
            return
        }

        const timer = setTimeout(async () => {
            try {
                const res = await fetch(`/api/patients?search=${encodeURIComponent(query)}&limit=5`)
                if (res.ok) {
                    const data = await res.json()
                    setPatients(data.patients || [])
                }
            } catch (e) { }
        }, 300)

        return () => clearTimeout(timer)
    }, [query])

    const fetchDynamicData = async () => {
        try {
            const [medsRes, tarifsRes] = await Promise.all([
                fetch('/api/intranet/medications'),
                fetch('/api/intranet/tarifs')
            ])

            if (medsRes.ok) {
                const data = await medsRes.json()
                setMedications(data.medications || data || [])
            }

            if (tarifsRes.ok) {
                const data = await tarifsRes.json()
                setTarifs(data.tarifs || data || [])
            }
        } catch (e) { }
    }

    // Filtrer les résultats
    const results = useMemo(() => {
        if (!query.trim()) return PAGES.slice(0, 6)

        const q = query.toLowerCase()
        const matches: SearchResult[] = []

        // Chercher dans les pages
        for (const page of PAGES) {
            if (page.title.toLowerCase().includes(q) || page.description?.toLowerCase().includes(q)) {
                matches.push(page)
            }
        }

        // Ajouter les patients trouvés
        for (const patient of patients) {
            matches.push({
                id: `patient-${patient.id}`,
                type: 'action',
                title: `${patient.last_name.toUpperCase()} ${patient.first_name}`,
                description: `Patient #${patient.fingerprint || '?'} - ${patient.phone || 'Sans téléphone'}`,
                href: `/intranet/patients/${patient.id}`,
                icon: User,
                category: 'Patients'
            })
        }

        // Ajouter l'action de création si recherche active
        if (query.trim()) {
            matches.push({
                id: 'new-patient',
                type: 'action',
                title: `Créer le patient "${query}"`,
                description: 'Ouvrir le formulaire de création',
                href: `/intranet/patients?action=new`,
                icon: User,
                category: 'Actions Rapides'
            })
        }

        // Chercher dans les médicaments
        for (const med of medications) {
            if (med.name?.toLowerCase().includes(q) || med.effects?.toLowerCase().includes(q)) {
                matches.push({
                    id: `med-${med.id}`,
                    type: 'medication',
                    title: med.name,
                    description: med.effects?.slice(0, 50) + '...',
                    href: '/intranet/medicaments',
                    icon: Pill,
                    category: 'Médicaments'
                })
            }
        }

        // Chercher dans les tarifs
        for (const tarif of tarifs) {
            if (tarif.name?.toLowerCase().includes(q) || tarif.category?.toLowerCase().includes(q)) {
                matches.push({
                    id: `tarif-${tarif.id}`,
                    type: 'tarif',
                    title: tarif.name,
                    description: `${tarif.price}$ - ${tarif.category}`,
                    href: '/intranet/tarifs',
                    icon: DollarSign,
                    category: 'Tarifs'
                })
            }
        }

        return matches.slice(0, 10)
    }, [query, medications, tarifs])

    // Navigation clavier
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return

            if (e.key === 'ArrowDown') {
                e.preventDefault()
                setSelectedIndex(i => Math.min(i + 1, results.length - 1))
            } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setSelectedIndex(i => Math.max(i - 1, 0))
            } else if (e.key === 'Enter') {
                e.preventDefault()
                const selected = results[selectedIndex]
                if (selected) {
                    if (selected.href) {
                        router.push(selected.href)
                    } else if (selected.action) {
                        selected.action()
                    }
                    setIsOpen(false)
                }
            }
        }

        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [isOpen, results, selectedIndex, router])

    // Reset selection on query change
    useEffect(() => {
        setSelectedIndex(0)
    }, [query])

    const handleSelect = (result: SearchResult) => {
        if (result.href) {
            router.push(result.href)
        } else if (result.action) {
            result.action()
        }
        setIsOpen(false)
    }

    // Grouper par catégorie
    const groupedResults = useMemo(() => {
        const groups: Record<string, SearchResult[]> = {}
        for (const result of results) {
            if (!groups[result.category]) {
                groups[result.category] = []
            }
            groups[result.category].push(result)
        }
        return groups
    }, [results])

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsOpen(false)}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -20 }}
                        className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-xl z-50"
                    >
                        <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl shadow-2xl overflow-hidden">
                            {/* Search input */}
                            <div className="flex items-center gap-3 px-4 py-3 border-b border-[#2a2a2a]">
                                <Search className="w-5 h-5 text-gray-500" />
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Rechercher..."
                                    className="flex-1 bg-transparent text-white placeholder-gray-500 outline-none text-lg"
                                />
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="p-1 hover:bg-[#2a2a2a] rounded"
                                >
                                    <X className="w-4 h-4 text-gray-500" />
                                </button>
                            </div>

                            {/* Results */}
                            <div className="max-h-[400px] overflow-y-auto">
                                {Object.entries(groupedResults).map(([category, items]) => (
                                    <div key={category}>
                                        <div className="px-4 py-2 text-xs text-gray-500 uppercase tracking-wider bg-[#1a1a1a]">
                                            {category}
                                        </div>
                                        {items.map((result, i) => {
                                            const globalIndex = results.indexOf(result)
                                            return (
                                                <button
                                                    key={result.id}
                                                    onClick={() => handleSelect(result)}
                                                    onMouseEnter={() => setSelectedIndex(globalIndex)}
                                                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${globalIndex === selectedIndex
                                                        ? 'bg-red-500/10'
                                                        : 'hover:bg-[#1a1a1a]'
                                                        }`}
                                                >
                                                    <result.icon className={`w-5 h-5 ${globalIndex === selectedIndex ? 'text-red-400' : 'text-gray-500'
                                                        }`} />
                                                    <div className="flex-1 min-w-0">
                                                        <p className={`font-medium truncate ${globalIndex === selectedIndex ? 'text-white' : 'text-gray-300'
                                                            }`}>
                                                            {result.title}
                                                        </p>
                                                        {result.description && (
                                                            <p className="text-xs text-gray-500 truncate">
                                                                {result.description}
                                                            </p>
                                                        )}
                                                    </div>
                                                    {globalIndex === selectedIndex && (
                                                        <ArrowRight className="w-4 h-4 text-red-400" />
                                                    )}
                                                </button>
                                            )
                                        })}
                                    </div>
                                ))}

                                {results.length === 0 && (
                                    <div className="px-4 py-8 text-center text-gray-500">
                                        <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                        <p>Aucun résultat pour "{query}"</p>
                                    </div>
                                )}
                            </div>

                            {/* Footer hints */}
                            <div className="px-4 py-2 border-t border-[#2a2a2a] bg-[#0a0a0a] flex items-center justify-between text-xs text-gray-500">
                                <div className="flex items-center gap-4">
                                    <span className="flex items-center gap-1">
                                        <kbd className="px-1.5 py-0.5 bg-[#2a2a2a] rounded">↑</kbd>
                                        <kbd className="px-1.5 py-0.5 bg-[#2a2a2a] rounded">↓</kbd>
                                        naviguer
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <kbd className="px-1.5 py-0.5 bg-[#2a2a2a] rounded">↵</kbd>
                                        sélectionner
                                    </span>
                                </div>
                                <span className="flex items-center gap-1">
                                    <kbd className="px-1.5 py-0.5 bg-[#2a2a2a] rounded">esc</kbd>
                                    fermer
                                </span>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}
