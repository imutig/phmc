"use client"

import { useState, useEffect, useRef } from "react"
import { motion } from "framer-motion"
import { FileText, Plus, Trash2, Loader2, Copy, Check, Printer, Download, History, X } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import { Breadcrumbs } from "@/components/ui/Breadcrumbs"
import { useToast } from "@/contexts/ToastContext"
import { useConfirmAnimation } from "@/hooks/useConfirmAnimation"
import { toPng } from 'html-to-image'
import Image from "next/image"

interface Medication {
    id: string
    name: string
    dosage?: string
    duration?: string
}

interface SelectedMedication {
    medication: Medication
    customDosage: string
    customDuration: string
}

interface Prescription {
    id: string
    patient_name?: string
    image_url: string
    created_at: string
}

export default function OrdonnancePage() {
    const [medications, setMedications] = useState<Medication[]>([])
    const [selected, setSelected] = useState<SelectedMedication[]>([])
    const [patientName, setPatientName] = useState("")
    const [patientInfo, setPatientInfo] = useState("")
    const [notes, setNotes] = useState("")
    const [loading, setLoading] = useState(true)
    const [generating, setGenerating] = useState(false)
    const [generatedUrl, setGeneratedUrl] = useState<string | null>(null)
    const [copied, setCopied] = useState(false)
    const [history, setHistory] = useState<Prescription[]>([])
    const [showHistory, setShowHistory] = useState(false)
    const [doctorName, setDoctorName] = useState("")

    const prescriptionRef = useRef<HTMLDivElement>(null)
    const toast = useToast()
    const { fireSuccess } = useConfirmAnimation()

    useEffect(() => {
        fetchMedications()
        fetchHistory()
    }, [])

    const fetchMedications = async () => {
        try {
            const res = await fetch('/api/intranet/medications')
            if (res.ok) {
                const data = await res.json()
                setMedications(data.medications || data || [])
            }
        } catch (e) {
            toast.error("Erreur chargement médicaments")
        } finally {
            setLoading(false)
        }
    }

    const fetchHistory = async () => {
        try {
            const res = await fetch('/api/intranet/prescriptions')
            if (res.ok) {
                const data = await res.json()
                setHistory(data)
            }
        } catch (e) { }
    }

    const addMedication = (med: Medication) => {
        if (selected.find(s => s.medication.id === med.id)) {
            toast.info("Médicament déjà ajouté")
            return
        }
        setSelected([...selected, {
            medication: med,
            customDosage: med.dosage || "",
            customDuration: med.duration || ""
        }])
    }

    const removeMedication = (medId: string) => {
        setSelected(selected.filter(s => s.medication.id !== medId))
    }

    const updateSelected = (medId: string, field: 'customDosage' | 'customDuration', value: string) => {
        setSelected(selected.map(s =>
            s.medication.id === medId ? { ...s, [field]: value } : s
        ))
    }

    const generatePrescription = async () => {
        if (selected.length === 0) {
            toast.error("Ajoutez au moins un médicament")
            return
        }

        setGenerating(true)

        try {
            // Générer l'image depuis le DOM
            if (!prescriptionRef.current) throw new Error("Référence manquante")

            const dataUrl = await toPng(prescriptionRef.current, {
                quality: 1,
                pixelRatio: 2,
                backgroundColor: '#ffffff',
                skipFonts: true
            })

            // Convertir data URL en Blob
            const response = await fetch(dataUrl)
            const blob = await response.blob()

            // Créer le FormData
            const formData = new FormData()
            formData.append('image', blob, 'ordonnance.png')
            formData.append('patient_name', patientName)
            formData.append('patient_info', patientInfo)
            formData.append('medications', JSON.stringify(selected.map(s => ({
                medication_id: s.medication.id,
                name: s.medication.name,
                dosage: s.customDosage,
                duration: s.customDuration
            }))))
            formData.append('notes', notes)

            // Upload
            const uploadRes = await fetch('/api/intranet/prescriptions', {
                method: 'POST',
                body: formData
            })

            if (!uploadRes.ok) {
                const error = await uploadRes.json()
                throw new Error(error.error || "Erreur upload")
            }

            const result = await uploadRes.json()
            setGeneratedUrl(result.image_url)
            fireSuccess()
            toast.success("Ordonnance générée !")
            fetchHistory()

        } catch (error: any) {
            console.error(error)
            toast.error(error.message || "Erreur génération")
        } finally {
            setGenerating(false)
        }
    }

    const copyLink = async () => {
        if (!generatedUrl) return
        await navigator.clipboard.writeText(generatedUrl)
        setCopied(true)
        toast.success("Lien copié !")
        setTimeout(() => setCopied(false), 2000)
    }

    const today = new Date().toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    })

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Loader2 className="w-8 h-8 animate-spin text-red-500" />
            </div>
        )
    }

    return (
        <div className="py-4 md:p-8">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-6"
            >
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <FileText className="w-6 md:w-8 h-6 md:h-8 text-red-500" />
                        <h1 className="font-display text-2xl md:text-3xl font-bold uppercase tracking-tight">
                            Ordonnance
                        </h1>
                    </div>
                    <p className="text-gray-400 font-sans text-sm md:text-base">
                        Générez des ordonnances médicales avec lien de partage
                    </p>
                </div>
                <button
                    onClick={() => setShowHistory(true)}
                    className="flex items-center gap-2 px-3 py-2 border border-[#2a2a2a] hover:border-red-500/50 text-gray-400 hover:text-white transition-colors"
                >
                    <History className="w-4 h-4" />
                    Historique
                </button>
            </motion.div>

            <div className="grid lg:grid-cols-2 gap-6">
                {/* Formulaire */}
                <div className="space-y-6">
                    {/* Infos patient */}
                    <div className="p-4 border border-[#2a2a2a] bg-[#141414]">
                        <h3 className="font-display font-bold text-sm uppercase tracking-wider mb-4 text-gray-300">
                            Patient (optionnel)
                        </h3>
                        <div className="grid gap-3">
                            <input
                                type="text"
                                value={patientName}
                                onChange={e => setPatientName(e.target.value)}
                                placeholder="Nom du patient"
                                className="w-full bg-black/50 border border-white/10 px-4 py-2 text-white text-sm"
                            />
                            <input
                                type="text"
                                value={patientInfo}
                                onChange={e => setPatientInfo(e.target.value)}
                                placeholder="Informations (âge, téléphone...)"
                                className="w-full bg-black/50 border border-white/10 px-4 py-2 text-white text-sm"
                            />
                        </div>
                    </div>

                    {/* Sélection médicaments */}
                    <div className="p-4 border border-[#2a2a2a] bg-[#141414]">
                        <h3 className="font-display font-bold text-sm uppercase tracking-wider mb-4 text-gray-300">
                            Médicaments
                        </h3>

                        {/* Liste des médicaments sélectionnés */}
                        {selected.length > 0 && (
                            <div className="space-y-3 mb-4">
                                {selected.map(s => (
                                    <div key={s.medication.id} className="p-3 bg-black/30 border border-white/5">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="font-bold text-white">{s.medication.name}</span>
                                            <button
                                                onClick={() => removeMedication(s.medication.id)}
                                                className="text-gray-500 hover:text-red-400"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <div className="grid gap-2">
                                            <input
                                                type="text"
                                                value={s.customDosage}
                                                onChange={e => updateSelected(s.medication.id, 'customDosage', e.target.value)}
                                                placeholder="Posologie"
                                                className="w-full bg-black/50 border border-white/10 px-3 py-1.5 text-sm text-white"
                                            />
                                            <input
                                                type="text"
                                                value={s.customDuration}
                                                onChange={e => updateSelected(s.medication.id, 'customDuration', e.target.value)}
                                                placeholder="Durée"
                                                className="w-full bg-black/50 border border-white/10 px-3 py-1.5 text-sm text-white"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Dropdown ajouter */}
                        <div className="relative">
                            <select
                                onChange={e => {
                                    const med = medications.find(m => m.id === e.target.value)
                                    if (med) addMedication(med)
                                    e.target.value = ""
                                }}
                                className="w-full bg-black/50 border border-white/10 px-4 py-2 text-gray-400 text-sm appearance-none cursor-pointer"
                            >
                                <option value="">+ Ajouter un médicament...</option>
                                {medications.map(med => (
                                    <option key={med.id} value={med.id}>{med.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Notes */}
                    <div className="p-4 border border-[#2a2a2a] bg-[#141414]">
                        <h3 className="font-display font-bold text-sm uppercase tracking-wider mb-4 text-gray-300">
                            Notes / Instructions
                        </h3>
                        <textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder="Instructions particulières..."
                            className="w-full bg-black/50 border border-white/10 px-4 py-2 text-white text-sm h-20 resize-none mb-3"
                        />
                        <input
                            type="text"
                            value={doctorName}
                            onChange={e => setDoctorName(e.target.value)}
                            placeholder="Nom du médecin (signature)"
                            className="w-full bg-black/50 border border-white/10 px-4 py-2 text-white text-sm"
                        />
                    </div>

                    {/* Bouton générer */}
                    <button
                        onClick={generatePrescription}
                        disabled={generating || selected.length === 0}
                        className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-display font-bold uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {generating ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Génération...
                            </>
                        ) : (
                            <>
                                <FileText className="w-4 h-4" />
                                Générer l'ordonnance
                            </>
                        )}
                    </button>

                    {/* Lien généré */}
                    {generatedUrl && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-4 bg-green-500/10 border border-green-500/30"
                        >
                            <p className="text-green-400 text-sm font-bold mb-2">✓ Ordonnance générée !</p>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={generatedUrl}
                                    readOnly
                                    className="flex-1 bg-black/50 border border-white/10 px-3 py-2 text-white text-xs font-mono truncate"
                                />
                                <button
                                    onClick={copyLink}
                                    className="px-3 py-2 bg-green-600 hover:bg-green-500 text-white"
                                >
                                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                </button>
                            </div>
                        </motion.div>
                    )}
                </div>

                {/* Prévisualisation */}
                <div className="p-4 border border-[#2a2a2a] bg-[#0a0a0a]">
                    <h3 className="font-display font-bold text-sm uppercase tracking-wider mb-4 text-gray-300">
                        Prévisualisation
                    </h3>

                    {/* Zone de rendu (sera convertie en image) */}
                    <div
                        ref={prescriptionRef}
                        className="bg-white text-black p-6 min-h-[400px]"
                        style={{ fontFamily: 'Georgia, serif' }}
                    >
                        {/* En-tête PHMC */}
                        <div className="border-b-2 border-red-600 pb-4 mb-4">
                            <div className="flex items-start justify-between">
                                <div>
                                    <h1 className="text-2xl font-bold text-red-600">PILLBOX HILL</h1>
                                    <p className="text-sm text-gray-600">Medical Center</p>
                                    <p className="text-xs text-gray-500 mt-1">Los Santos, San Andreas</p>
                                </div>
                                <div className="text-right text-sm text-gray-600">
                                    <p>Date: {today}</p>
                                </div>
                            </div>
                        </div>

                        {/* Patient */}
                        {(patientName || patientInfo) && (
                            <div className="mb-4 pb-4 border-b border-gray-200">
                                <p className="text-sm text-gray-500 uppercase tracking-wider mb-1">Patient</p>
                                {patientName && <p className="font-bold">{patientName}</p>}
                                {patientInfo && <p className="text-sm text-gray-600">{patientInfo}</p>}
                            </div>
                        )}

                        {/* Ordonnance titre */}
                        <h2 className="text-center text-xl font-bold mb-4 uppercase tracking-wider">
                            Ordonnance Médicale
                        </h2>

                        {/* Médicaments */}
                        <div className="space-y-3 mb-6">
                            {selected.length === 0 ? (
                                <p className="text-gray-400 text-center italic">Aucun médicament sélectionné</p>
                            ) : (
                                selected.map((s, i) => (
                                    <div key={s.medication.id} className="flex gap-3">
                                        <span className="font-bold">{i + 1}.</span>
                                        <div>
                                            <p className="font-bold">{s.medication.name}</p>
                                            {s.customDosage && <p className="text-sm">{s.customDosage}</p>}
                                            {s.customDuration && <p className="text-sm text-gray-600">Durée: {s.customDuration}</p>}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Notes */}
                        {notes && (
                            <div className="border-t border-gray-200 pt-4 mb-4">
                                <p className="text-sm text-gray-500 uppercase tracking-wider mb-1">Notes</p>
                                <p className="text-sm">{notes}</p>
                            </div>
                        )}

                        {/* Signature */}
                        <div className="mt-8 pt-4 border-t border-gray-200">
                            <div className="text-right">
                                <p className="text-sm text-gray-500 mb-1">Signature du médecin</p>
                                {doctorName && <p className="font-bold text-lg">{doctorName}</p>}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="mt-6 text-center text-xs text-gray-400">
                            <p>Document généré par le système PHMC • Ne pas reproduire</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal Historique */}
            <Modal
                isOpen={showHistory}
                onClose={() => setShowHistory(false)}
                title="Historique des ordonnances"
            >
                <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                    {history.length === 0 ? (
                        <p className="text-gray-500 text-center py-8">Aucune ordonnance générée</p>
                    ) : (
                        history.map(p => (
                            <div key={p.id} className="flex items-center justify-between p-3 bg-black/30 border border-white/5">
                                <div>
                                    <p className="font-bold text-white">{p.patient_name || 'Sans nom'}</p>
                                    <p className="text-xs text-gray-500">
                                        {new Date(p.created_at).toLocaleString('fr-FR')}
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(p.image_url)
                                            toast.success("Lien copié")
                                        }}
                                        className="p-2 text-gray-400 hover:text-white"
                                    >
                                        <Copy className="w-4 h-4" />
                                    </button>
                                    <a
                                        href={p.image_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-2 text-gray-400 hover:text-white"
                                    >
                                        <Download className="w-4 h-4" />
                                    </a>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </Modal>
        </div>
    )
}
