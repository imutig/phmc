"use client"

import { useState, useEffect, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { DollarSign, Plus, Edit2, Trash2, Calculator, X, Loader2, ChevronDown, ChevronUp, Search, Star } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import { Breadcrumbs } from "@/components/ui/Breadcrumbs"
import { Tooltip } from "@/components/ui/Tooltip"
import { useToast } from "@/contexts/ToastContext"

interface CareType {
    id: string
    name: string
    price: number
    description?: string
    category_id: string
}

interface CareCategory {
    id: string
    name: string
    description?: string
    sort_order: number
    care_types: CareType[]
}

interface CartItem {
    careType: CareType
    quantity: number
}

export default function TarifsPage() {
    const [categories, setCategories] = useState<CareCategory[]>([])
    const [loading, setLoading] = useState(true)
    const [cart, setCart] = useState<CartItem[]>([])
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
    const [searchQuery, setSearchQuery] = useState("")
    const [favorites, setFavorites] = useState<Set<string>>(new Set())
    const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
    const toast = useToast()

    // Permissions : seuls direction/supervision peuvent éditer
    const [canEdit, setCanEdit] = useState(false)

    // Modals
    const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false)
    const [isAddCareOpen, setIsAddCareOpen] = useState(false)
    const [editingCategory, setEditingCategory] = useState<CareCategory | null>(null)
    const [editingCareType, setEditingCareType] = useState<CareType | null>(null)
    const [selectedCategoryId, setSelectedCategoryId] = useState<string>("")

    // Form states
    const [formName, setFormName] = useState("")
    const [formDescription, setFormDescription] = useState("")
    const [formPrice, setFormPrice] = useState("")

    useEffect(() => {
        fetchCategories()
        fetchPermissions()
        fetchFavorites()
    }, [])

    const fetchFavorites = async () => {
        try {
            const res = await fetch('/api/intranet/care-favorites')
            if (res.ok) {
                const data = await res.json()
                setFavorites(new Set(data.favorites || []))
            }
        } catch (error) {
            console.error('Erreur favoris:', error)
        }
    }

    const toggleFavorite = async (careTypeId: string) => {
        try {
            const res = await fetch('/api/intranet/care-favorites', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ care_type_id: careTypeId })
            })
            if (res.ok) {
                const data = await res.json()
                if (data.action === 'added') {
                    setFavorites(prev => new Set([...prev, careTypeId]))
                    toast.success('Ajouté aux favoris')
                } else {
                    setFavorites(prev => {
                        const newSet = new Set(prev)
                        newSet.delete(careTypeId)
                        return newSet
                    })
                    toast.info('Retiré des favoris')
                }
            }
        } catch (error) {
            toast.error('Erreur favorite')
        }
    }

    const fetchPermissions = async () => {
        try {
            const res = await fetch('/api/user/roles')
            if (res.ok) {
                const data = await res.json()
                // Seuls direction et supervision peuvent éditer
                setCanEdit(data.roles?.includes('direction') || data.roles?.includes('supervision'))
            }
        } catch (error) {
            console.error('Erreur récupération permissions:', error)
        }
    }

    const fetchCategories = async () => {
        try {
            const res = await fetch('/api/intranet/care-categories')
            if (res.ok) {
                const data = await res.json()
                setCategories(data)
                // Expand all by default
                setExpandedCategories(new Set(data.map((c: CareCategory) => c.id)))
            }
        } catch (error) {
            console.error('Erreur:', error)
        } finally {
            setLoading(false)
        }
    }

    const total = useMemo(() => {
        return cart.reduce((sum, item) => sum + (item.careType.price * item.quantity), 0)
    }, [cart])

    const addToCart = (careType: CareType) => {
        setCart(prev => {
            const existing = prev.find(item => item.careType.id === careType.id)
            if (existing) {
                return prev.map(item =>
                    item.careType.id === careType.id
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                )
            }
            return [...prev, { careType, quantity: 1 }]
        })
    }

    const updateQuantity = (careTypeId: string, quantity: number) => {
        if (quantity <= 0) {
            setCart(prev => prev.filter(item => item.careType.id !== careTypeId))
        } else {
            setCart(prev => prev.map(item =>
                item.careType.id === careTypeId ? { ...item, quantity } : item
            ))
        }
    }

    const toggleCategory = (categoryId: string) => {
        setExpandedCategories(prev => {
            const next = new Set(prev)
            if (next.has(categoryId)) {
                next.delete(categoryId)
            } else {
                next.add(categoryId)
            }
            return next
        })
    }

    const handleAddCategory = async () => {
        const res = await fetch('/api/intranet/care-categories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: formName, description: formDescription })
        })
        if (res.ok) {
            fetchCategories()
            setIsAddCategoryOpen(false)
            resetForm()
        }
    }

    const handleEditCategory = async () => {
        if (!editingCategory) return
        const res = await fetch(`/api/intranet/care-categories/${editingCategory.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: formName, description: formDescription })
        })
        if (res.ok) {
            fetchCategories()
            setEditingCategory(null)
            resetForm()
        }
    }

    const handleDeleteCategory = async (id: string) => {
        if (!confirm('Supprimer cette catégorie et tous ses soins ?')) return
        await fetch(`/api/intranet/care-categories/${id}`, { method: 'DELETE' })
        fetchCategories()
    }

    const handleAddCareType = async () => {
        const res = await fetch('/api/intranet/care-types', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                category_id: selectedCategoryId,
                name: formName,
                price: parseInt(formPrice) || 0,
                description: formDescription
            })
        })
        if (res.ok) {
            fetchCategories()
            setIsAddCareOpen(false)
            resetForm()
        }
    }

    const handleEditCareType = async () => {
        if (!editingCareType) return
        const res = await fetch(`/api/intranet/care-types/${editingCareType.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: formName,
                price: parseInt(formPrice) || 0,
                description: formDescription
            })
        })
        if (res.ok) {
            fetchCategories()
            setEditingCareType(null)
            resetForm()
        }
    }

    const handleDeleteCareType = async (id: string) => {
        if (!confirm('Supprimer ce type de soin ?')) return
        await fetch(`/api/intranet/care-types/${id}`, { method: 'DELETE' })
        fetchCategories()
    }

    const resetForm = () => {
        setFormName("")
        setFormDescription("")
        setFormPrice("")
        setSelectedCategoryId("")
    }

    const openEditCategory = (category: CareCategory) => {
        setFormName(category.name)
        setFormDescription(category.description || "")
        setEditingCategory(category)
    }

    const openEditCareType = (careType: CareType) => {
        setFormName(careType.name)
        setFormDescription(careType.description || "")
        setFormPrice(careType.price.toString())
        setEditingCareType(careType)
    }

    const openAddCare = (categoryId: string) => {
        setSelectedCategoryId(categoryId)
        setIsAddCareOpen(true)
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Loader2 className="w-8 h-8 animate-spin text-red-500" />
            </div>
        )
    }

    // Filtrer les catégories et soins par recherche
    const filteredCategories = categories.map(cat => ({
        ...cat,
        care_types: cat.care_types?.filter(care =>
            care.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (care.description && care.description.toLowerCase().includes(searchQuery.toLowerCase()))
        ) || []
    })).filter(cat =>
        cat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cat.care_types.length > 0
    )

    return (
        <div className="p-8">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-between items-start mb-6"
            >
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <DollarSign className="w-8 h-8 text-red-500" />
                        <h1 className="font-display text-3xl font-bold uppercase tracking-tight">
                            Grille Tarifaire
                        </h1>
                    </div>
                    <p className="text-gray-400 font-sans">
                        Calculez le montant de la facture patient
                    </p>
                </div>
                {canEdit && (
                    <button
                        onClick={() => setIsAddCategoryOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-display font-bold text-sm uppercase tracking-widest transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Catégorie
                    </button>
                )}
            </motion.div>

            {/* Barre de recherche */}
            <div className="relative mb-6">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Rechercher un soin..."
                    className="w-full bg-[#141414] border border-[#2a2a2a] pl-12 pr-4 py-3 text-white focus:border-red-500/50 transition-colors"
                />
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
                {/* Soins List */}
                <div className="lg:col-span-2 space-y-4">
                    {filteredCategories.length === 0 ? (
                        <div className="text-center py-12 border border-[#2a2a2a] bg-[#141414]">
                            <DollarSign className="w-12 h-12 mx-auto text-gray-600 mb-4" />
                            <p className="text-gray-500">
                                {searchQuery ? "Aucun résultat trouvé" : "Aucune catégorie de soins"}
                            </p>
                        </div>
                    ) : (
                        filteredCategories.map(category => (
                            <motion.div
                                key={category.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="border border-[#2a2a2a] bg-[#141414]"
                            >
                                {/* Category Header */}
                                <div
                                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-[#1a1a1a]"
                                    onClick={() => toggleCategory(category.id)}
                                >
                                    <div className="flex items-center gap-3">
                                        {expandedCategories.has(category.id) ? (
                                            <ChevronUp className="w-5 h-5 text-gray-500" />
                                        ) : (
                                            <ChevronDown className="w-5 h-5 text-gray-500" />
                                        )}
                                        <h3 className="font-display font-bold text-lg uppercase">{category.name}</h3>
                                        <span className="text-xs text-gray-500">({category.care_types?.length || 0})</span>
                                    </div>
                                    {canEdit && (
                                        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                            <button
                                                onClick={() => openAddCare(category.id)}
                                                className="p-2 text-red-400 hover:bg-red-500/20 rounded transition-colors"
                                                title="Ajouter un soin"
                                            >
                                                <Plus className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => openEditCategory(category)}
                                                className="p-2 text-gray-400 hover:bg-white/10 rounded transition-colors"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteCategory(category.id)}
                                                className="p-2 text-red-400 hover:bg-red-500/20 rounded transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Care Types */}
                                <AnimatePresence>
                                    {expandedCategories.has(category.id) && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: "auto", opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="border-t border-[#2a2a2a] overflow-hidden"
                                        >
                                            {category.care_types?.length === 0 ? (
                                                <p className="p-4 text-gray-500 text-sm italic">Aucun soin dans cette catégorie</p>
                                            ) : (
                                                <div className="divide-y divide-[#2a2a2a]">
                                                    {[...(category.care_types || [])].sort((a, b) => {
                                                        const aFav = favorites.has(a.id) ? 0 : 1
                                                        const bFav = favorites.has(b.id) ? 0 : 1
                                                        return aFav - bFav
                                                    }).map(care => (
                                                        <div key={care.id} className="flex items-center justify-between p-4 hover:bg-[#1a1a1a]">
                                                            <div className="flex items-center gap-3 flex-1">
                                                                <button
                                                                    onClick={() => toggleFavorite(care.id)}
                                                                    className={`p-1 rounded transition-colors ${favorites.has(care.id)
                                                                        ? 'text-yellow-400 hover:text-yellow-300'
                                                                        : 'text-gray-600 hover:text-gray-400'
                                                                        }`}
                                                                    title={favorites.has(care.id) ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                                                                >
                                                                    <Star className={`w-4 h-4 ${favorites.has(care.id) ? 'fill-current' : ''}`} />
                                                                </button>
                                                                <div>
                                                                    <p className="font-sans font-medium">{care.name}</p>
                                                                    {care.description && (
                                                                        <p className="text-sm text-gray-500">{care.description}</p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-4">
                                                                <span className="font-mono text-red-400 font-bold">${care.price}</span>
                                                                <button
                                                                    onClick={() => addToCart(care)}
                                                                    className="px-3 py-1 bg-red-600/20 text-red-400 text-sm font-bold hover:bg-red-600/30 transition-colors"
                                                                >
                                                                    + Ajouter
                                                                </button>
                                                                {canEdit && (
                                                                    <>
                                                                        <button
                                                                            onClick={() => openEditCareType(care)}
                                                                            className="p-1 text-gray-400 hover:text-white"
                                                                        >
                                                                            <Edit2 className="w-4 h-4" />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleDeleteCareType(care.id)}
                                                                            className="p-1 text-gray-400 hover:text-red-400"
                                                                        >
                                                                            <Trash2 className="w-4 h-4" />
                                                                        </button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        ))
                    )}
                </div>

                {/* Calculator */}
                <div className="lg:col-span-1">
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="sticky top-8 border border-red-500/30 bg-red-500/5 p-6 rounded-lg"
                    >
                        <div className="flex items-center gap-2 mb-4">
                            <Calculator className="w-5 h-5 text-red-400" />
                            <h2 className="font-display font-bold uppercase">Facture</h2>
                        </div>

                        {cart.length === 0 ? (
                            <p className="text-gray-500 text-sm italic">Aucun soin sélectionné</p>
                        ) : (
                            <div className="space-y-3 mb-4">
                                {cart.map(item => (
                                    <div key={item.careType.id} className="flex items-center justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm truncate">{item.careType.name}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => updateQuantity(item.careType.id, item.quantity - 1)}
                                                className="w-6 h-6 flex items-center justify-center bg-white/10 hover:bg-white/20 text-sm"
                                            >
                                                -
                                            </button>
                                            <span className="w-8 text-center font-mono">{item.quantity}</span>
                                            <button
                                                onClick={() => updateQuantity(item.careType.id, item.quantity + 1)}
                                                className="w-6 h-6 flex items-center justify-center bg-white/10 hover:bg-white/20 text-sm"
                                            >
                                                +
                                            </button>
                                            <span className="font-mono text-red-400 w-16 text-right">
                                                ${item.careType.price * item.quantity}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="border-t border-red-500/30 pt-4 mt-4">
                            <div className="flex justify-between items-center">
                                <span className="font-display font-bold uppercase">Total</span>
                                <div className="flex items-center gap-2">
                                    <span className="font-mono text-2xl text-red-400 font-bold">${total}</span>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(total.toString())
                                            // Feedback visuel temporaire
                                            const btn = document.getElementById('copy-total-btn')
                                            if (btn) {
                                                btn.textContent = '✓'
                                                setTimeout(() => btn.textContent = '📋', 1500)
                                            }
                                        }}
                                        id="copy-total-btn"
                                        className="p-1.5 text-gray-500 hover:text-white hover:bg-white/10 rounded transition-colors text-sm"
                                        title="Copier le montant"
                                    >
                                        📋
                                    </button>
                                </div>
                            </div>
                        </div>

                        {cart.length > 0 && (
                            <button
                                onClick={() => setCart([])}
                                className="mt-4 w-full flex items-center justify-center gap-2 py-2 border border-white/20 text-gray-400 hover:text-white hover:bg-white/5 transition-colors text-sm"
                            >
                                <X className="w-4 h-4" />
                                Vider la facture
                            </button>
                        )}
                    </motion.div>
                </div>
            </div>

            {/* Modal Ajouter Catégorie */}
            <Modal
                isOpen={isAddCategoryOpen}
                onClose={() => { setIsAddCategoryOpen(false); resetForm(); }}
                title="Ajouter une catégorie"
                footer={
                    <div className="flex justify-end gap-3">
                        <button onClick={() => { setIsAddCategoryOpen(false); resetForm(); }} className="px-4 py-2 text-gray-400 hover:text-white">
                            Annuler
                        </button>
                        <button onClick={handleAddCategory} className="bg-red-600 hover:bg-red-500 text-white px-6 py-2 font-bold">
                            Créer
                        </button>
                    </div>
                }
            >
                <div className="space-y-4">
                    <input
                        type="text"
                        value={formName}
                        onChange={e => setFormName(e.target.value)}
                        placeholder="Nom de la catégorie"
                        className="w-full bg-black/50 border border-white/10 px-4 py-3 text-white"
                    />
                    <textarea
                        value={formDescription}
                        onChange={e => setFormDescription(e.target.value)}
                        placeholder="Description (optionnel)"
                        className="w-full bg-black/50 border border-white/10 px-4 py-3 text-white h-24 resize-none"
                    />
                </div>
            </Modal>

            {/* Modal Modifier Catégorie */}
            <Modal
                isOpen={!!editingCategory}
                onClose={() => { setEditingCategory(null); resetForm(); }}
                title="Modifier la catégorie"
                footer={
                    <div className="flex justify-end gap-3">
                        <button onClick={() => { setEditingCategory(null); resetForm(); }} className="px-4 py-2 text-gray-400 hover:text-white">
                            Annuler
                        </button>
                        <button onClick={handleEditCategory} className="bg-red-600 hover:bg-red-500 text-white px-6 py-2 font-bold">
                            Enregistrer
                        </button>
                    </div>
                }
            >
                <div className="space-y-4">
                    <input
                        type="text"
                        value={formName}
                        onChange={e => setFormName(e.target.value)}
                        placeholder="Nom de la catégorie"
                        className="w-full bg-black/50 border border-white/10 px-4 py-3 text-white"
                    />
                    <textarea
                        value={formDescription}
                        onChange={e => setFormDescription(e.target.value)}
                        placeholder="Description (optionnel)"
                        className="w-full bg-black/50 border border-white/10 px-4 py-3 text-white h-24 resize-none"
                    />
                </div>
            </Modal>

            {/* Modal Ajouter Soin */}
            <Modal
                isOpen={isAddCareOpen}
                onClose={() => { setIsAddCareOpen(false); resetForm(); }}
                title="Ajouter un soin"
                footer={
                    <div className="flex justify-end gap-3">
                        <button onClick={() => { setIsAddCareOpen(false); resetForm(); }} className="px-4 py-2 text-gray-400 hover:text-white">
                            Annuler
                        </button>
                        <button onClick={handleAddCareType} className="bg-red-600 hover:bg-red-500 text-white px-6 py-2 font-bold">
                            Créer
                        </button>
                    </div>
                }
            >
                <div className="space-y-4">
                    <input
                        type="text"
                        value={formName}
                        onChange={e => setFormName(e.target.value)}
                        placeholder="Nom du soin"
                        className="w-full bg-black/50 border border-white/10 px-4 py-3 text-white"
                    />
                    <input
                        type="number"
                        value={formPrice}
                        onChange={e => setFormPrice(e.target.value)}
                        placeholder="Prix ($)"
                        className="w-full bg-black/50 border border-white/10 px-4 py-3 text-white"
                    />
                    <textarea
                        value={formDescription}
                        onChange={e => setFormDescription(e.target.value)}
                        placeholder="Description (optionnel)"
                        className="w-full bg-black/50 border border-white/10 px-4 py-3 text-white h-24 resize-none"
                    />
                </div>
            </Modal>

            {/* Modal Modifier Soin */}
            <Modal
                isOpen={!!editingCareType}
                onClose={() => { setEditingCareType(null); resetForm(); }}
                title="Modifier le soin"
                footer={
                    <div className="flex justify-end gap-3">
                        <button onClick={() => { setEditingCareType(null); resetForm(); }} className="px-4 py-2 text-gray-400 hover:text-white">
                            Annuler
                        </button>
                        <button onClick={handleEditCareType} className="bg-red-600 hover:bg-red-500 text-white px-6 py-2 font-bold">
                            Enregistrer
                        </button>
                    </div>
                }
            >
                <div className="space-y-4">
                    <input
                        type="text"
                        value={formName}
                        onChange={e => setFormName(e.target.value)}
                        placeholder="Nom du soin"
                        className="w-full bg-black/50 border border-white/10 px-4 py-3 text-white"
                    />
                    <input
                        type="number"
                        value={formPrice}
                        onChange={e => setFormPrice(e.target.value)}
                        placeholder="Prix ($)"
                        className="w-full bg-black/50 border border-white/10 px-4 py-3 text-white"
                    />
                    <textarea
                        value={formDescription}
                        onChange={e => setFormDescription(e.target.value)}
                        placeholder="Description (optionnel)"
                        className="w-full bg-black/50 border border-white/10 px-4 py-3 text-white h-24 resize-none"
                    />
                </div>
            </Modal>
        </div>
    )
}
