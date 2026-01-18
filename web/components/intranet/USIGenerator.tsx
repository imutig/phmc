"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { FileCheck, Copy, Download, Check, Loader2, FileText, AlertCircle, Plus, Edit3, Trash2, Save, X, Clock, User } from "lucide-react"
import { toPng } from "html-to-image"

interface USI {
    id: string
    title: string
    html_content: string
    created_by_name: string | null
    created_at: string
    updated_at: string
}

interface USIGeneratorProps {
    patientId: string
    patientName: string
    patientAddress?: string
    autoCreate?: boolean
}

const STAFF_GRADES = [
    { value: "Ambulancier", label: "Ambulancier" },
    { value: "Infirmier", label: "Infirmier" },
    { value: "Médecin", label: "Médecin" },
    { value: "Chirurgien", label: "Chirurgien" },
    { value: "Direction", label: "Direction" },
]

export function USIGenerator({ patientId, patientName, patientAddress, autoCreate = false }: USIGeneratorProps) {
    // Liste des USI
    const [usiList, setUsiList] = useState<USI[]>([])
    const [isLoadingList, setIsLoadingList] = useState(true)

    // Mode création/édition - start in create mode if autoCreate
    const [mode, setMode] = useState<'list' | 'create' | 'edit' | 'view'>(autoCreate ? 'create' : 'list')
    const [selectedUsi, setSelectedUsi] = useState<USI | null>(null)

    // Mode manuel (sans IA)
    const [manualMode, setManualMode] = useState(false)

    // Formulaire de génération
    const [staffName, setStaffName] = useState("")
    const [staffGrade, setStaffGrade] = useState("Médecin")
    const [date, setDate] = useState(() => {
        const now = new Date()
        return `Le ${now.toLocaleDateString('fr-FR')} à ${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
    })
    const [notes, setNotes] = useState("")
    const [title, setTitle] = useState("")

    // État du contenu généré/édité
    const [generatedHtml, setGeneratedHtml] = useState("")
    const [editableHtml, setEditableHtml] = useState("")

    // États UI
    const [isGenerating, setIsGenerating] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [copied, setCopied] = useState(false)
    const [clarificationQuestions, setClarificationQuestions] = useState<string[]>([])
    const reportRef = useRef<HTMLDivElement>(null)
    const editorRef = useRef<HTMLDivElement>(null)
    const pngExportRef = useRef<HTMLDivElement>(null)

    // Charger les USI
    const fetchUsiList = useCallback(async () => {
        setIsLoadingList(true)
        try {
            const res = await fetch(`/api/patients/usi?patientId=${patientId}`)
            if (res.ok) {
                const data = await res.json()
                setUsiList(data.usiList || [])
            }
        } catch (e) {
            console.error('Erreur fetch USI:', e)
        } finally {
            setIsLoadingList(false)
        }
    }, [patientId])

    useEffect(() => {
        fetchUsiList()
    }, [fetchUsiList])

    const handleGenerate = async (forceGenerate = false) => {
        if (!notes.trim()) {
            setError("Veuillez entrer des notes brèves")
            return
        }

        setIsGenerating(true)
        setError(null)
        setClarificationQuestions([])

        try {
            const res = await fetch("/api/patients/generate-usi", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    patientName,
                    patientAddress,
                    date,
                    staffName,
                    staffGrade,
                    notes,
                    forceGenerate
                })
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || "Erreur lors de la génération")
            }

            const data = await res.json()

            // Vérifier si l'IA demande des clarifications (sauf si forceGenerate)
            if (!forceGenerate && data.needsClarification && data.questions && data.questions.length > 0) {
                setClarificationQuestions(data.questions)
                setGeneratedHtml("")
            } else if (data.html) {
                setGeneratedHtml(data.html)
                setEditableHtml(data.html)
                setTitle(`USI - ${patientName} - ${new Date().toLocaleDateString('fr-FR')}`)
                setClarificationQuestions([])
            }
        } catch (err: any) {
            setError(err.message)
        } finally {
            setIsGenerating(false)
        }
    }

    // Démarrer en mode manuel (sans IA)
    const startManualMode = () => {
        setManualMode(true)
        setGeneratedHtml(`
            <p><strong>Patient:</strong> ${patientName}</p>
            ${patientAddress ? `<p><strong>Adresse:</strong> ${patientAddress}</p>` : ''}
            <p><strong>Date:</strong> ${date}</p>
            <hr/>
            <p>Rédigez votre rapport ici...</p>
        `)
        setEditableHtml(`
            <p><strong>Patient:</strong> ${patientName}</p>
            ${patientAddress ? `<p><strong>Adresse:</strong> ${patientAddress}</p>` : ''}
            <p><strong>Date:</strong> ${date}</p>
            <hr/>
            <p>Rédigez votre rapport ici...</p>
        `)
        setTitle(`USI - ${patientName} - ${new Date().toLocaleDateString('fr-FR')}`)
    }

    const handleSaveUsi = async () => {
        const htmlContent = editorRef.current?.innerHTML || editableHtml

        if (!htmlContent.trim()) {
            setError("Contenu vide")
            return
        }

        setIsSaving(true)
        setError(null)

        try {
            if (mode === 'edit' && selectedUsi) {
                // Mise à jour
                const res = await fetch("/api/patients/usi", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        id: selectedUsi.id,
                        title,
                        htmlContent
                    })
                })
                if (!res.ok) throw new Error("Erreur lors de la mise à jour")
            } else {
                // Création
                const res = await fetch("/api/patients/usi", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        patientId,
                        title,
                        htmlContent
                    })
                })
                if (!res.ok) throw new Error("Erreur lors de la sauvegarde")
            }

            await fetchUsiList()
            resetForm()
            setMode('list')
        } catch (err: any) {
            setError(err.message)
        } finally {
            setIsSaving(false)
        }
    }

    const handleDeleteUsi = async (id: string) => {
        if (!confirm("Supprimer cet USI ?")) return

        try {
            await fetch(`/api/patients/usi?id=${id}`, { method: "DELETE" })
            await fetchUsiList()
            if (selectedUsi?.id === id) {
                resetForm()
                setMode('list')
            }
        } catch (e) {
            console.error('Erreur delete:', e)
        }
    }

    const handleViewUsi = (usi: USI) => {
        setSelectedUsi(usi)
        setTitle(usi.title)
        setEditableHtml(usi.html_content)
        setMode('view')
    }

    const handleEditUsi = (usi: USI) => {
        setSelectedUsi(usi)
        setTitle(usi.title)
        setEditableHtml(usi.html_content)
        setMode('edit')
    }

    const resetForm = () => {
        setNotes("")
        setGeneratedHtml("")
        setEditableHtml("")
        setTitle("")
        setSelectedUsi(null)
        setError(null)
        setClarificationQuestions([])
    }

    const handleCopy = async () => {
        const element = mode === 'create' ? reportRef.current : editorRef.current
        if (!element) return

        try {
            const htmlContent = element.innerHTML
            const blob = new Blob([htmlContent], { type: 'text/html' })
            const clipboardItem = new ClipboardItem({
                'text/html': blob,
                'text/plain': new Blob([element.innerText], { type: 'text/plain' })
            })
            await navigator.clipboard.write([clipboardItem])
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch {
            try {
                await navigator.clipboard.writeText(element.innerText)
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
            } catch {
                setError("Impossible de copier")
            }
        }
    }

    const handleDownloadPng = async () => {
        const contentElement = mode === 'create' ? reportRef.current : editorRef.current
        if (!contentElement) {
            setError("Contenu non trouvé pour l'export")
            return
        }

        // Créer un conteneur temporaire avec le template formel
        const container = document.createElement('div')
        container.style.position = 'absolute'
        container.style.left = '-9999px'
        container.style.width = '800px'
        container.innerHTML = `
            <div style="background: white; color: black; padding: 40px; font-family: Georgia, serif; min-height: 600px;">
                <!-- Header PHMC -->
                <div style="border-bottom: 3px solid #dc2626; padding-bottom: 16px; margin-bottom: 24px;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div>
                            <h1 style="font-size: 28px; font-weight: bold; color: #dc2626; text-transform: uppercase; letter-spacing: 2px; margin: 0;">PILLBOX HILL</h1>
                            <p style="font-size: 16px; color: #4b5563; font-weight: 600; margin: 4px 0;">Medical Center</p>
                            <p style="font-size: 12px; color: #9ca3af; margin: 0;">Los Santos, San Andreas</p>
                        </div>
                        <div style="text-align: right;">
                            <p style="font-size: 12px; color: #6b7280; margin: 0;">Date du rapport</p>
                            <p style="font-size: 16px; font-weight: bold; margin: 4px 0;">${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                        </div>
                    </div>
                </div>

                <!-- Titre du document -->
                <div style="text-align: center; margin-bottom: 32px;">
                    <h2 style="font-size: 20px; font-weight: bold; text-transform: uppercase; letter-spacing: 3px; border-bottom: 1px solid #d1d5db; display: inline-block; padding-bottom: 8px; margin: 0;">
                        Rapport USI
                    </h2>
                    <p style="color: #6b7280; font-style: italic; margin-top: 8px;">Unité de Soins Intensifs</p>
                </div>

                <!-- Patient Info -->
                <div style="background: #f9fafb; border: 1px solid #e5e7eb; padding: 16px; margin-bottom: 24px;">
                    <h3 style="font-size: 12px; font-weight: bold; color: #6b7280; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 12px 0; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px;">
                        Patient
                    </h3>
                    <p style="font-size: 18px; font-weight: bold; margin: 0;">${patientName}</p>
                </div>

                <!-- Contenu du rapport -->
                <div style="line-height: 1.8; font-size: 14px;">
                    ${contentElement.innerHTML}
                </div>

                <!-- Footer -->
                <div style="margin-top: 48px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
                    <p style="font-size: 10px; color: #9ca3af; text-align: center; margin: 0;">
                        Document généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} — PHMC Intranet
                    </p>
                </div>
            </div>
        `
        document.body.appendChild(container)

        try {
            const dataUrl = await toPng(container.firstElementChild as HTMLElement, {
                pixelRatio: 2,
                skipFonts: true
            })
            const link = document.createElement('a')
            link.download = `USI-${patientName.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.png`
            link.href = dataUrl
            link.click()
        } catch (err) {
            console.error('Erreur génération PNG:', err)
            setError("Impossible de générer l'image. Essayez de copier le rapport.")
        } finally {
            document.body.removeChild(container)
        }
    }

    // Rendu conditionnel basé sur le mode
    if (mode === 'list') {
        return (
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                        <FileText className="w-5 h-5 text-purple-400" />
                        Rapports USI
                    </h3>
                    <button
                        onClick={() => { resetForm(); setMode('create'); }}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Nouveau rapport
                    </button>
                </div>

                {/* Liste */}
                {isLoadingList ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                    </div>
                ) : usiList.length === 0 ? (
                    <div className="text-center py-12 text-gray-400 bg-zinc-900/50 border border-zinc-800 rounded-xl">
                        <FileText className="w-12 h-12 mx-auto mb-4 opacity-30" />
                        <p>Aucun rapport USI enregistré</p>
                        <p className="text-sm mt-1">Cliquez sur "Nouveau rapport" pour en créer un</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {usiList.map((usi) => (
                            <div
                                key={usi.id}
                                className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 hover:border-purple-500/30 transition-colors"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex-1 cursor-pointer" onClick={() => handleViewUsi(usi)}>
                                        <h4 className="font-medium text-white">{usi.title}</h4>
                                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-400">
                                            <span className="flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {new Date(usi.created_at).toLocaleDateString('fr-FR', { dateStyle: 'long' })}
                                            </span>
                                            {usi.created_by_name && (
                                                <span className="flex items-center gap-1">
                                                    <User className="w-3 h-3" />
                                                    {usi.created_by_name}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleEditUsi(usi)}
                                            className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
                                            title="Modifier"
                                        >
                                            <Edit3 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteUsi(usi.id)}
                                            className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
                                            title="Supprimer"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )
    }

    // Mode création
    if (mode === 'create') {
        return (
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Plus className="w-5 h-5 text-purple-400" />
                        Nouveau rapport USI
                    </h3>
                    <button
                        onClick={() => { resetForm(); setMode('list'); }}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Formulaire de génération */}
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-zinc-400 mb-1">Patient</label>
                            <input type="text" value={patientName} disabled className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-300" />
                        </div>
                        <div>
                            <label className="block text-sm text-zinc-400 mb-1">Date</label>
                            <input type="text" value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 focus:border-purple-500 focus:outline-none" />
                        </div>
                        <div>
                            <label className="block text-sm text-zinc-400 mb-1">Votre nom</label>
                            <input type="text" value={staffName} onChange={(e) => setStaffName(e.target.value)} placeholder="Dr. Jean Dupont" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 focus:border-purple-500 focus:outline-none" />
                        </div>
                        <div>
                            <label className="block text-sm text-zinc-400 mb-1">Grade</label>
                            <select value={staffGrade} onChange={(e) => setStaffGrade(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 focus:border-purple-500 focus:outline-none">
                                {STAFF_GRADES.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm text-zinc-400 mb-1">Notes brèves</label>
                        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex: Accident autoroute, saignement bras gauche, fracture radius..." rows={4} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 focus:border-purple-500 focus:outline-none resize-none" />
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                            <AlertCircle className="w-4 h-4" />
                            {error}
                        </div>
                    )}

                    <div className="flex gap-2">
                        <button onClick={() => handleGenerate()} disabled={isGenerating || !notes.trim()} className="flex-1 flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition-colors">
                            {isGenerating ? <><Loader2 className="w-5 h-5 animate-spin" />Génération...</> : <><FileCheck className="w-5 h-5" />Générer avec IA</>}
                        </button>
                        <button onClick={startManualMode} disabled={isGenerating} className="flex items-center justify-center gap-2 bg-zinc-700 hover:bg-zinc-600 disabled:bg-zinc-800 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors">
                            <Edit3 className="w-5 h-5" />
                            Manuel
                        </button>
                    </div>
                </div>

                {/* Questions de clarification de l'IA */}
                <AnimatePresence>
                    {clarificationQuestions.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 space-y-3"
                        >
                            <div className="flex items-center gap-2 text-amber-400 font-medium">
                                <AlertCircle className="w-5 h-5" />
                                L'IA a besoin de plus de précisions
                            </div>
                            <ul className="space-y-2 text-sm text-zinc-300">
                                {clarificationQuestions.map((q, idx) => (
                                    <li key={idx} className="flex items-start gap-2">
                                        <span className="text-amber-400 font-medium">{idx + 1}.</span>
                                        {q}
                                    </li>
                                ))}
                            </ul>
                            <div className="flex flex-col sm:flex-row gap-2 pt-2">
                                <p className="text-xs text-zinc-500 flex-1">
                                    Complétez vos notes ou générez quand même avec les infos actuelles.
                                </p>
                                <button
                                    onClick={() => handleGenerate(true)}
                                    disabled={isGenerating}
                                    className="flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
                                >
                                    <FileCheck className="w-4 h-4" />
                                    Générer quand même
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Résultat généré */}
                <AnimatePresence>
                    {generatedHtml && (
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-4">
                            <div>
                                <label className="block text-sm text-zinc-400 mb-1">Titre du rapport</label>
                                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 focus:border-purple-500 focus:outline-none" />
                            </div>

                            <div className="flex items-center gap-3">
                                <button onClick={handleCopy} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors">
                                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                    {copied ? "Copié !" : "Copier"}
                                </button>
                                <button onClick={handleDownloadPng} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors">
                                    <Download className="w-4 h-4" />
                                    PNG
                                </button>
                                <button onClick={handleSaveUsi} disabled={isSaving} className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors ml-auto">
                                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    Enregistrer
                                </button>
                            </div>

                            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
                                <div className="bg-zinc-800/50 px-4 py-2 border-b border-zinc-700 flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-purple-400" />
                                    <span className="text-sm font-medium">Aperçu (modifiable)</span>
                                </div>
                                <div
                                    ref={reportRef}
                                    contentEditable
                                    suppressContentEditableWarning
                                    className="p-6 prose prose-invert max-w-none focus:outline-none [&_p]:my-2 [&_strong]:font-bold [&_ul]:my-3 [&_li]:ml-4 [&_hr]:my-4 [&_hr]:border-zinc-700"
                                    dangerouslySetInnerHTML={{ __html: generatedHtml }}
                                    onBlur={(e) => setEditableHtml(e.currentTarget.innerHTML)}
                                />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        )
    }

    // Mode view/edit
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    {mode === 'edit' ? <Edit3 className="w-5 h-5 text-purple-400" /> : <FileText className="w-5 h-5 text-purple-400" />}
                    {mode === 'edit' ? "Modifier le rapport" : "Détail du rapport"}
                </h3>
                <button onClick={() => { resetForm(); setMode('list'); }} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                    <X className="w-5 h-5" />
                </button>
            </div>

            {mode === 'edit' && (
                <div>
                    <label className="block text-sm text-zinc-400 mb-1">Titre</label>
                    <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 focus:border-purple-500 focus:outline-none" />
                </div>
            )}

            {error && (
                <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                </div>
            )}

            <div className="flex items-center gap-3">
                <button onClick={handleCopy} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors">
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? "Copié !" : "Copier"}
                </button>
                <button onClick={handleDownloadPng} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors">
                    <Download className="w-4 h-4" />
                    PNG
                </button>
                {mode === 'view' && (
                    <button onClick={() => setMode('edit')} className="flex items-center gap-2 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg transition-colors">
                        <Edit3 className="w-4 h-4" />
                        Modifier
                    </button>
                )}
                {mode === 'edit' && (
                    <button onClick={handleSaveUsi} disabled={isSaving} className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors ml-auto">
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Enregistrer
                    </button>
                )}
            </div>

            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
                <div className="bg-zinc-800/50 px-4 py-2 border-b border-zinc-700 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-purple-400" />
                    <span className="text-sm font-medium">{selectedUsi?.title}</span>
                </div>
                <div
                    ref={editorRef}
                    contentEditable={mode === 'edit'}
                    suppressContentEditableWarning
                    className={`p-6 prose prose-invert max-w-none [&_p]:my-2 [&_strong]:font-bold [&_ul]:my-3 [&_li]:ml-4 [&_hr]:my-4 [&_hr]:border-zinc-700 ${mode === 'edit' ? 'focus:outline-none bg-zinc-800/30' : ''}`}
                    dangerouslySetInnerHTML={{ __html: editableHtml }}
                    onBlur={mode === 'edit' ? (e) => setEditableHtml(e.currentTarget.innerHTML) : undefined}
                />
            </div>
        </div>
    )
}
