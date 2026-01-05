"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Book, Plus, Edit2, Trash2, Search, Loader2, ChevronRight, Save, X, Eye, GripVertical, History } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import { ConfirmModal } from "@/components/ui/ConfirmModal"
import { Breadcrumbs } from "@/components/ui/Breadcrumbs"
import { WikiEditor } from "@/components/intranet/wiki/WikiEditor"
import { WikiAssistant } from "@/components/intranet/wiki/WikiAssistant"
import { useToast } from "@/contexts/ToastContext"
import { usePermissions } from "@/components/intranet/ClientWrapper"
import { useConfirmAnimation } from "@/hooks/useConfirmAnimation"

interface WikiArticle {
    id: string
    title: string
    slug: string
    content: string
    category: string
    sort_order: number
    is_published: boolean
}

const CATEGORY_LABELS: Record<string, string> = {
    general: '📋 Général',
    procedures: '🏥 Procédures',
    rh: '👥 Ressources Humaines',
    formations: '🎓 Formations',
    urgences: '🚨 Urgences'
}

const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS).map(([key, label]) => ({
    value: key,
    label: label.replace(/^[^\s]+\s/, '')
}))

function WikiContent() {
    const searchParams = useSearchParams()
    const articleSlug = searchParams.get('article')

    const [articles, setArticles] = useState<WikiArticle[]>([])
    const [grouped, setGrouped] = useState<Record<string, WikiArticle[]>>({})
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")
    const [selectedArticle, setSelectedArticle] = useState<WikiArticle | null>(null)
    const toast = useToast()
    const { checkPermission } = usePermissions()
    const canEdit = checkPermission('wiki.edit')
    const { fireSuccess } = useConfirmAnimation()

    // Modal states
    const [isEditOpen, setIsEditOpen] = useState(false)
    const [editingArticle, setEditingArticle] = useState<WikiArticle | null>(null)
    const [formTitle, setFormTitle] = useState("")
    const [formSlug, setFormSlug] = useState("")
    const [formContent, setFormContent] = useState("")
    const [formCategory, setFormCategory] = useState("general")
    const [formPublished, setFormPublished] = useState(true)
    const [submitting, setSubmitting] = useState(false)

    // Popup tableau
    const [showTablePopup, setShowTablePopup] = useState(false)
    const [tableRows, setTableRows] = useState(3)
    const [tableCols, setTableCols] = useState(3)

    // Historique
    interface WikiHistory {
        id: string
        title: string
        content: string
        category: string
        modified_by_name: string
        modified_at: string
    }
    const [historyOpen, setHistoryOpen] = useState(false)
    const [historyData, setHistoryData] = useState<WikiHistory[]>([])
    const [historyLoading, setHistoryLoading] = useState(false)
    const [viewingHistory, setViewingHistory] = useState<WikiHistory | null>(null)
    const [deletingArticle, setDeletingArticle] = useState<WikiArticle | null>(null)

    useEffect(() => {
        fetchData()
    }, [])

    // Sélectionner l'article depuis l'URL après le chargement
    useEffect(() => {
        if (articleSlug && articles.length > 0) {
            const article = articles.find(a => a.slug === articleSlug)
            if (article) {
                setSelectedArticle(article)
            }
        }
    }, [articleSlug, articles])

    const fetchData = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/intranet/wiki')
            if (res.ok) {
                const data = await res.json()
                setArticles(data.articles || [])
                setGrouped(data.grouped || {})
                if (!selectedArticle && !articleSlug && data.articles?.length > 0) {
                    setSelectedArticle(data.articles[0])
                }
            }
        } catch (e) {
            toast.error("Erreur de chargement du wiki")
        } finally {
            setLoading(false)
        }
    }

    const generateSlug = (title: string) => {
        return title
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')
    }

    // Fonction de rendu markdown - TOUT en inline, seuls les <br/> créent des sauts de ligne
    const renderMarkdown = (content: string): string => {
        if (!content) return ''
        // Si ça ressemble à du HTML (TipTap), on le retourne tel quel
        if (content.trim().startsWith('<')) return content

        let html = content

        // Normaliser les retours chariot Windows (\r\n → \n) et Mac (\r → \n)
        html = html.replace(/\r\n/g, '\n')
        html = html.replace(/\r/g, '\n')

        // ÉTAPE 1: Convertir TOUS les sauts de ligne en br d'abord
        html = html.replace(/\n/g, '<br/>')

        // ÉTAPE 2: Remplacer les éléments markdown
        // Titres - doivent être au début ou après un <br/>
        // Utiliser une approche plus robuste : chercher # au début ou après br
        html = html.replace(/(<br\/>|^)### ([^<]+?)(<br\/>|$)/g, '$1<span style="font-size:1.125rem;font-weight:bold;color:white;">$2</span>$3')
        html = html.replace(/(<br\/>|^)## ([^<]+?)(<br\/>|$)/g, '$1<span style="font-size:1.25rem;font-weight:bold;color:white;">$2</span>$3')
        html = html.replace(/(<br\/>|^)# ([^<]+?)(<br\/>|$)/g, '$1<span style="font-size:1.5rem;font-weight:bold;color:white;">$2</span>$3')

        // Images
        html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%;" />')
        html = html.replace(/(https?:\/\/(?:i\.imgur\.com|goopics\.net|i\.redd\.it|cdn\.discordapp\.com)[^\s<]+\.(png|jpg|jpeg|gif|webp))/gi, '<img src="$1" style="max-width:100%;" />')

        // Listes (remplacer le tiret par une puce) - lookahead pour ne pas consommer le br de fin
        html = html.replace(/(<br\/>|^)- ([^<]+?)(?=<br\/>|$)/g, '$1• $2')

        // Tableaux markdown : | col1 | col2 | col3 |
        // Créer une grille alignée - lignes collées visuellement
        const tableLineRegex = /(<br\/>|^)\|([^<]+?)\|(?=<br\/>|$)/g
        let isFirstTableRow = true
        html = html.replace(tableLineRegex, (match, before, content) => {
            // Ignorer les lignes de séparation (contenant que des -)
            if (/^[\s\-\|]+$/.test('|' + content + '|')) {
                return '' // Supprimer complètement la ligne de séparation
            }
            const cells = content.split('|').map((c: string) => c.trim())
            const numCols = cells.length
            // Première ligne = bordure complète, autres lignes = pas de bordure top (margin -1px)
            const marginTop = isFirstTableRow ? '' : 'margin-top:-1px;'
            isFirstTableRow = false
            return `<span style="display:grid;grid-template-columns:repeat(${numCols}, minmax(100px, 1fr));background:#1a1a1a;border:1px solid #333;${marginTop}overflow:hidden;">` +
                cells.map((c: string) => `<span style="padding:0.5rem 0.75rem;border-right:1px solid #333;">${c}</span>`).join('') +
                '</span>'
        })

        // Gras et italique
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong style="color:white;">$1</strong>')
        html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')

        return html
    }

    const openNewArticle = () => {
        setEditingArticle(null)
        setFormTitle("")
        setFormSlug("")
        setFormContent("")
        setFormCategory("general")
        setFormPublished(true)
        setIsEditOpen(true)
    }

    const openEditArticle = (article: WikiArticle) => {
        setEditingArticle(article)
        setFormTitle(article.title)
        setFormSlug(article.slug)
        setFormContent(article.content)
        setFormCategory(article.category)
        setFormPublished(article.is_published)
        setIsEditOpen(true)
    }

    const handleSave = async () => {
        setSubmitting(true)
        try {
            const slug = formSlug || generateSlug(formTitle)
            if (editingArticle) {
                // Update
                const res = await fetch(`/api/intranet/wiki?id=${editingArticle.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: formTitle,
                        content: formContent,
                        category: formCategory,
                        is_published: formPublished
                    })
                })
                if (res.ok) {
                    const updated = await res.json()
                    fireSuccess()
                    toast.success("Article mis à jour")
                    setIsEditOpen(false)
                    // Mettre à jour l'article sélectionné immédiatement
                    setSelectedArticle({
                        ...editingArticle,
                        title: formTitle,
                        content: formContent,
                        category: formCategory,
                        is_published: formPublished
                    })
                    fetchData()
                } else {
                    const err = await res.json()
                    toast.error(err.error || "Erreur")
                }
            } else {
                // Create
                const res = await fetch('/api/intranet/wiki', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: formTitle,
                        slug,
                        content: formContent,
                        category: formCategory,
                        is_published: formPublished
                    })
                })
                if (res.ok) {
                    fireSuccess()
                    toast.success("Article créé")
                    setIsEditOpen(false)
                    fetchData()
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

    const handleDelete = async () => {
        if (!deletingArticle) return
        try {
            await fetch(`/api/intranet/wiki?id=${deletingArticle.id}`, { method: 'DELETE' })
            toast.success("Article supprimé")
            if (selectedArticle?.id === deletingArticle.id) {
                setSelectedArticle(null)
            }
            fetchData()
        } catch (e) {
            toast.error("Erreur suppression")
        } finally {
            setDeletingArticle(null)
        }
    }

    const fetchHistory = async (articleId: string) => {
        setHistoryLoading(true)
        setHistoryOpen(true)
        try {
            const res = await fetch(`/api/intranet/wiki/history?article_id=${articleId}`)
            if (res.ok) {
                const data = await res.json()
                setHistoryData(data)
            } else {
                toast.error("Erreur chargement historique")
            }
        } catch (e) {
            toast.error("Erreur réseau")
        } finally {
            setHistoryLoading(false)
        }
    }

    // Drag and drop state
    const [draggedArticle, setDraggedArticle] = useState<WikiArticle | null>(null)

    const handleDragStart = (article: WikiArticle) => {
        setDraggedArticle(article)
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
    }

    const handleDrop = async (targetArticle: WikiArticle) => {
        if (!draggedArticle || draggedArticle.id === targetArticle.id) {
            setDraggedArticle(null)
            return
        }

        // Réorganiser les articles de la même catégorie
        const categoryArticles = Object.values(grouped)
            .flat()
            .filter((a: WikiArticle) => a.category === draggedArticle.category)
            .sort((a: WikiArticle, b: WikiArticle) => a.sort_order - b.sort_order)

        const draggedIndex = categoryArticles.findIndex((a: WikiArticle) => a.id === draggedArticle.id)
        const targetIndex = categoryArticles.findIndex((a: WikiArticle) => a.id === targetArticle.id)

        if (draggedIndex === -1 || targetIndex === -1 || draggedArticle.category !== targetArticle.category) {
            setDraggedArticle(null)
            return
        }

        // Réordonner
        const newOrder = [...categoryArticles]
        newOrder.splice(draggedIndex, 1)
        newOrder.splice(targetIndex, 0, draggedArticle)

        // Mettre à jour les sort_order
        const updates = newOrder.map((article: WikiArticle, index: number) => ({
            id: article.id,
            sort_order: index
        }))

        try {
            const res = await fetch('/api/intranet/wiki/reorder', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ articles: updates })
            })
            if (res.ok) {
                toast.success('Articles réorganisés')
                fetchData()
            } else {
                toast.error('Erreur réorganisation')
            }
        } catch (e) {
            toast.error('Erreur réseau')
        }

        setDraggedArticle(null)
    }

    // Filtrer par recherche
    const filteredArticles = articles.filter(a =>
        a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.content.toLowerCase().includes(searchQuery.toLowerCase())
    )

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Loader2 className="w-8 h-8 animate-spin text-red-500" />
            </div>
        )
    }

    return (
        <div className="flex flex-col md:flex-row h-[calc(100vh-5rem)] md:h-[calc(100vh-2rem)]">
            {/* Sidebar Wiki - Masquée sur mobile quand un article est sélectionné */}
            <div className={`
                ${selectedArticle ? 'hidden md:flex' : 'flex'}
                w-full md:w-80 border-b md:border-b-0 md:border-r border-[#2a2a2a] flex-col
            `}>
                {/* Header */}
                <div className="p-4 border-b border-[#2a2a2a]">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Book className="w-6 h-6 text-red-500" />
                            <h1 className="font-display font-bold text-xl">Wiki</h1>
                        </div>
                        {canEdit && (
                            <button
                                onClick={openNewArticle}
                                className="p-2 bg-red-600 hover:bg-red-500 rounded transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Rechercher..."
                            className="w-full bg-[#141414] border border-[#2a2a2a] pl-9 pr-4 py-2 text-sm rounded focus:outline-none focus:border-red-500"
                        />
                    </div>
                </div>

                {/* Liste des articles */}
                <div className="flex-1 overflow-y-auto">
                    {Object.entries(grouped).map(([category, categoryArticles]) => {
                        const filtered = categoryArticles.filter(a =>
                            a.title.toLowerCase().includes(searchQuery.toLowerCase())
                        )
                        if (filtered.length === 0) return null
                        return (
                            <div key={category} className="py-2">
                                <div className="px-4 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                    {CATEGORY_LABELS[category] || category}
                                </div>
                                {filtered.map(article => (
                                    <div
                                        key={article.id}
                                        draggable={canEdit}
                                        onDragStart={() => handleDragStart(article)}
                                        onDragOver={handleDragOver}
                                        onDrop={() => handleDrop(article)}
                                        className={`
                                            flex items-center gap-2 px-2 py-2 text-sm cursor-pointer
                                            hover:bg-white/5 transition-colors
                                            ${selectedArticle?.id === article.id ? 'bg-red-500/10 text-red-400 border-r-2 border-red-500' : 'text-gray-400'}
                                            ${draggedArticle?.id === article.id ? 'opacity-50' : ''}
                                        `}
                                    >
                                        {canEdit && (
                                            <GripVertical className="w-4 h-4 text-gray-600 cursor-grab flex-shrink-0 hidden md:block" />
                                        )}
                                        <button
                                            onClick={() => setSelectedArticle(article)}
                                            className="flex-1 flex items-center justify-between text-left"
                                        >
                                            <span className="truncate">{article.title}</span>
                                            <ChevronRight className="w-4 h-4 flex-shrink-0 opacity-50" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Contenu article - Plein écran sur mobile */}
            <div className={`
                ${selectedArticle ? 'flex' : 'hidden md:flex'}
                flex-1 flex-col overflow-y-auto
            `}>
                {selectedArticle ? (
                    <div className="p-4 md:p-8">
                        {/* Bouton retour sur mobile */}
                        <button
                            onClick={() => setSelectedArticle(null)}
                            className="md:hidden flex items-center gap-2 text-gray-400 hover:text-white mb-4"
                        >
                            <ChevronRight className="w-4 h-4 rotate-180" />
                            <span className="text-sm">Retour à la liste</span>
                        </button>

                        <div className="flex flex-col md:flex-row md:items-start justify-between mb-4 md:mb-6 gap-4">
                            <div>
                                <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">
                                    {CATEGORY_LABELS[selectedArticle.category] || selectedArticle.category}
                                </div>
                                <h1 className="font-display text-2xl md:text-3xl font-bold">{selectedArticle.title}</h1>
                            </div>
                            {canEdit && (
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => fetchHistory(selectedArticle.id)}
                                        className="p-2 text-gray-400 hover:text-blue-400 hover:bg-white/10 rounded transition-colors"
                                        title="Historique des modifications"
                                    >
                                        <History className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => openEditArticle(selectedArticle)}
                                        className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => setDeletingArticle(selectedArticle)}
                                        className="p-2 text-gray-400 hover:text-red-400 hover:bg-white/10 rounded transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>
                        {/* Barre de séparation */}
                        <div className="h-1 w-24 bg-gradient-to-r from-red-600 to-red-400 rounded mb-4" />
                        <div
                            className="wiki-article-content text-gray-300 leading-normal"
                            dangerouslySetInnerHTML={{
                                __html: renderMarkdown(selectedArticle.content)
                            }}
                        />
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500">
                        <Book className="w-16 h-16 mb-4 opacity-50" />
                        <p>Sélectionnez un article</p>
                    </div>
                )}
            </div>

            {/* Modal édition */}
            <Modal
                isOpen={isEditOpen}
                onClose={() => setIsEditOpen(false)}
                title={editingArticle ? "Modifier l'article" : "Nouvel article"}
                className="max-w-6xl"
                footer={
                    <div className="flex justify-end gap-3">
                        <button onClick={() => setIsEditOpen(false)} className="px-4 py-2 text-gray-400 hover:text-white">
                            Annuler
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={submitting || !formTitle}
                            className="bg-red-600 hover:bg-red-500 text-white px-6 py-2 font-bold disabled:opacity-50 flex items-center gap-2"
                        >
                            <Save className="w-4 h-4" />
                            {submitting ? "Enregistrement..." : "Enregistrer"}
                        </button>
                    </div>
                }
            >
                <div className="flex flex-col h-[75vh] gap-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-gray-500 uppercase tracking-widest mb-2">Titre *</label>
                            <input
                                type="text"
                                value={formTitle}
                                onChange={e => {
                                    setFormTitle(e.target.value)
                                    if (!editingArticle) setFormSlug(generateSlug(e.target.value))
                                }}
                                className="w-full bg-black/50 border border-white/10 px-4 py-3 text-white focus:outline-none focus:border-red-500/50"
                                placeholder="Titre de l'article"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 uppercase tracking-widest mb-2">Catégorie</label>
                            <select
                                value={formCategory}
                                onChange={e => setFormCategory(e.target.value)}
                                className="w-full bg-black/50 border border-white/10 px-4 py-3 text-white focus:outline-none focus:border-red-500/50"
                            >
                                {CATEGORY_OPTIONS.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {!editingArticle && (
                        <div>
                            <label className="block text-xs text-gray-500 uppercase tracking-widest mb-2">Slug (URL)</label>
                            <input
                                type="text"
                                value={formSlug}
                                onChange={e => setFormSlug(e.target.value)}
                                className="w-full bg-black/50 border border-white/10 px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-red-500/50 opacity-70"
                                placeholder="slug-de-larticle"
                            />
                        </div>
                    )}

                    <div className="flex-1 flex flex-col min-h-0">
                        <label className="block text-xs text-gray-500 uppercase tracking-widest mb-2">Contenu</label>
                        <div className="flex-1 min-h-0 border border-white/10 rounded-lg overflow-hidden">
                            <WikiEditor
                                content={formContent}
                                onChange={setFormContent}
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            id="published"
                            checked={formPublished}
                            onChange={e => setFormPublished(e.target.checked)}
                            className="w-4 h-4 rounded border-gray-600 text-red-600 focus:ring-red-500"
                        />
                        <label htmlFor="published" className="text-sm text-gray-400">
                            Publié (visible par tous les employés)
                        </label>
                    </div>
                </div>
            </Modal>

            {/* Styles globaux pour le rendu des articles */}
            <style jsx global>{`
                .wiki-article-content h1 {
                    font-size: 2rem;
                    font-weight: 700;
                    color: white;
                    margin: 1rem 0 0.5rem 0;
                    line-height: 1.2;
                }
                .wiki-article-content h2 {
                    font-size: 1.5rem;
                    font-weight: 600;
                    color: white;
                    margin: 1rem 0 0.5rem 0;
                    line-height: 1.3;
                }
                .wiki-article-content h3 {
                    font-size: 1.25rem;
                    font-weight: 600;
                    color: white;
                    margin: 0.75rem 0 0.5rem 0;
                    line-height: 1.4;
                }
                .wiki-article-content table {
                    border-collapse: collapse;
                    width: 100%;
                    margin: 1rem 0;
                }
                .wiki-article-content td,
                .wiki-article-content th {
                    border: 1px solid #333;
                    padding: 0.5rem 0.75rem;
                    text-align: left;
                    background-color: #1a1a1a;
                }
                .wiki-article-content th {
                    font-weight: 600;
                    background-color: #252525;
                }
                .wiki-article-content ul {
                    list-style-type: disc;
                    padding-left: 1.5rem;
                    margin: 0.5rem 0;
                }
                .wiki-article-content ol {
                    list-style-type: decimal;
                    padding-left: 1.5rem;
                    margin: 0.5rem 0;
                }
                .wiki-article-content li {
                    margin: 0.25rem 0;
                }
                .wiki-article-content p {
                    margin: 0.5rem 0;
                }
                .wiki-article-content strong {
                    font-weight: 600;
                    color: white;
                }
                .wiki-article-content img {
                    max-width: 100%;
                    border-radius: 4px;
                    margin: 0.5rem 0;
                }
            `}</style>

            {/* Modal Historique */}
            <Modal
                isOpen={historyOpen}
                onClose={() => { setHistoryOpen(false); setViewingHistory(null); }}
                title={viewingHistory ? `Version du ${new Date(viewingHistory.modified_at).toLocaleString('fr-FR')}` : "Historique des modifications"}
            >
                {viewingHistory ? (
                    <div>
                        <button
                            onClick={() => setViewingHistory(null)}
                            className="flex items-center gap-2 text-gray-400 hover:text-white mb-4"
                        >
                            <ChevronRight className="w-4 h-4 rotate-180" />
                            Retour à la liste
                        </button>
                        <div className="border border-[#2a2a2a] p-4 bg-black/30 max-h-[50vh] overflow-y-auto">
                            <h3 className="font-bold text-lg mb-2">{viewingHistory.title}</h3>
                            <div
                                className="wiki-article-content text-gray-300 text-sm"
                                dangerouslySetInnerHTML={{ __html: renderMarkdown(viewingHistory.content) }}
                            />
                        </div>
                    </div>
                ) : (
                    <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                        {historyLoading ? (
                            <div className="flex justify-center py-8">
                                <Loader2 className="w-6 h-6 animate-spin text-red-500" />
                            </div>
                        ) : historyData.length === 0 ? (
                            <p className="text-gray-500 text-center py-8">Aucun historique disponible</p>
                        ) : (
                            historyData.map(h => (
                                <button
                                    key={h.id}
                                    onClick={() => setViewingHistory(h)}
                                    className="w-full flex items-center justify-between p-3 bg-black/30 border border-white/5 hover:border-red-500/30 transition-colors text-left"
                                >
                                    <div>
                                        <p className="font-bold text-white">{h.title}</p>
                                        <p className="text-xs text-gray-500">
                                            {new Date(h.modified_at).toLocaleString('fr-FR')} par {h.modified_by_name || 'Inconnu'}
                                        </p>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-gray-500" />
                                </button>
                            ))
                        )}
                    </div>
                )}
            </Modal>

            {/* Modal de confirmation suppression */}
            <ConfirmModal
                isOpen={!!deletingArticle}
                onClose={() => setDeletingArticle(null)}
                onConfirm={handleDelete}
                title={`Supprimer "${deletingArticle?.title}" ?`}
                message="Cette action est irréversible. L'article sera définitivement supprimé du wiki."
                confirmText="Supprimer"
                variant="danger"
            />
        </div>
    )
}

export default function WikiPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-[50vh]">
                <Loader2 className="w-8 h-8 animate-spin text-red-500" />
            </div>
        }>
            <WikiContent />
            <WikiAssistant />
        </Suspense>
    )
}

