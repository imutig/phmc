"use client";

import { useState, useEffect, use } from "react";
import { motion } from "framer-motion";
import {
    ArrowLeft, ArrowRight, Save, Loader2, CheckCircle, User, Heart,
    Stethoscope, FileText, Download, Image as ImageIcon
} from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';

interface Patient {
    id: string;
    first_name: string;
    last_name: string;
    birth_date: string | null;
    phone: string | null;
    address: string | null;
    discord_id: string;
}

interface MedicalExam {
    id: string;
    patient_id: string;
    patients?: Patient;
    created_by: string;
    created_by_name: string | null;
    created_at: string;
    updated_at: string;
    status: 'draft' | 'completed';
    visit_date: string | null;
    visit_type: string | null;
    profession: string | null;
    employer: string | null;
    personal_history: string | null;
    family_history: string | null;
    allergies: boolean;
    allergies_details: string | null;
    current_treatment: string | null;
    tobacco: boolean;
    alcohol: boolean;
    sleep_quality: string | null;
    height_cm: number | null;
    weight_kg: number | null;
    blood_pressure_systolic: number | null;
    blood_pressure_diastolic: number | null;
    heart_rate_bpm: number | null;
    hearing: string | null;
    respiratory: string | null;
    cardiovascular: string | null;
    nervous_system: string | null;
    musculoskeletal: string | null;
    skin: string | null;
    blood_test: string | null;
    other_observations: string | null;
    no_contraindication: boolean;
    conclusion_date: string | null;
    examiner_signature: string | null;
}

const VISIT_TYPES = [
    { value: 'embauche', label: "Visite d'embauche" },
    { value: 'periodique', label: 'Visite périodique' },
    { value: 'reprise', label: 'Visite de reprise' },
    { value: 'prereprise', label: 'Visite de préreprise' },
    { value: 'demande', label: 'Visite à la demande' }
];

const STEPS = [
    { id: 1, title: 'Informations', icon: User },
    { id: 2, title: 'Antécédents', icon: Heart },
    { id: 3, title: 'Examen clinique', icon: Stethoscope },
    { id: 4, title: 'Conclusion', icon: FileText }
];

export default function MedicalExamPage({ params }: { params: Promise<{ id: string; examId: string }> }) {
    const resolvedParams = use(params);
    const router = useRouter();
    const searchParams = useSearchParams();
    const { data: session } = useSession();

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [currentStep, setCurrentStep] = useState(1);
    const [exam, setExam] = useState<MedicalExam | null>(null);
    const [patient, setPatient] = useState<Patient | null>(null);
    const [error, setError] = useState<string | null>(null);

    const isNewExam = resolvedParams.examId === 'new';

    // Form data
    const [formData, setFormData] = useState({
        visit_date: new Date().toISOString().split('T')[0],
        visit_type: '',
        profession: '',
        employer: '',
        personal_history: '',
        family_history: '',
        allergies: false,
        allergies_details: '',
        current_treatment: '',
        tobacco: false,
        alcohol: false,
        sleep_quality: 'satisfaisant',
        height_cm: '',
        weight_kg: '',
        blood_pressure_systolic: '',
        blood_pressure_diastolic: '',
        heart_rate_bpm: '',
        hearing: 'normal',
        respiratory: 'normal',
        cardiovascular: 'normal',
        nervous_system: 'normal',
        musculoskeletal: 'normal',
        skin: 'normal',
        blood_test: 'normal',
        other_observations: '',
        no_contraindication: false,
        examiner_signature: ''
    });

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                // Fetch patient
                const patientRes = await fetch(`/api/patients/${resolvedParams.id}`);
                if (patientRes.ok) {
                    const patientData = await patientRes.json();
                    setPatient(patientData.patient);
                }

                if (isNewExam) {
                    // Create new exam
                    const createRes = await fetch(`/api/patients/${resolvedParams.id}/medical-exams`, {
                        method: 'POST'
                    });
                    if (createRes.ok) {
                        const newExam = await createRes.json();
                        router.replace(`/intranet/patients/${resolvedParams.id}/medical-exam/${newExam.id}`);
                        return;
                    } else {
                        setError("Erreur lors de la création de l'examen");
                    }
                } else {
                    // Fetch existing exam
                    const examRes = await fetch(`/api/medical-exams/${resolvedParams.examId}`);
                    if (examRes.ok) {
                        const examData = await examRes.json();
                        setExam(examData);
                        // Populate form with existing data
                        setFormData({
                            visit_date: examData.visit_date || new Date().toISOString().split('T')[0],
                            visit_type: examData.visit_type || '',
                            profession: examData.profession || '',
                            employer: examData.employer || '',
                            personal_history: examData.personal_history || '',
                            family_history: examData.family_history || '',
                            allergies: examData.allergies || false,
                            allergies_details: examData.allergies_details || '',
                            current_treatment: examData.current_treatment || '',
                            tobacco: examData.tobacco || false,
                            alcohol: examData.alcohol || false,
                            sleep_quality: examData.sleep_quality || 'satisfaisant',
                            height_cm: examData.height_cm?.toString() || '',
                            weight_kg: examData.weight_kg?.toString() || '',
                            blood_pressure_systolic: examData.blood_pressure_systolic?.toString() || '',
                            blood_pressure_diastolic: examData.blood_pressure_diastolic?.toString() || '',
                            heart_rate_bpm: examData.heart_rate_bpm?.toString() || '',
                            hearing: examData.hearing || 'normal',
                            respiratory: examData.respiratory || 'normal',
                            cardiovascular: examData.cardiovascular || 'normal',
                            nervous_system: examData.nervous_system || 'normal',
                            musculoskeletal: examData.musculoskeletal || 'normal',
                            skin: examData.skin || 'normal',
                            blood_test: examData.blood_test || 'normal',
                            other_observations: examData.other_observations || '',
                            no_contraindication: examData.no_contraindication || false,
                            examiner_signature: examData.examiner_signature || ''
                        });
                        if (examData.status === 'completed') {
                            setCurrentStep(5); // Show final view
                        }
                    } else {
                        setError("Examen introuvable");
                    }
                }
            } catch (err) {
                console.error(err);
                setError("Erreur lors du chargement");
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [resolvedParams.id, resolvedParams.examId, isNewExam, router]);

    const saveProgress = async (data: Partial<typeof formData>, complete = false) => {
        if (!exam) return;
        setIsSaving(true);
        try {
            const updateData: Record<string, unknown> = { ...data };

            // Convert string numbers to actual numbers
            if (data.height_cm) updateData.height_cm = parseInt(data.height_cm);
            if (data.weight_kg) updateData.weight_kg = parseFloat(data.weight_kg);
            if (data.blood_pressure_systolic) updateData.blood_pressure_systolic = parseInt(data.blood_pressure_systolic);
            if (data.blood_pressure_diastolic) updateData.blood_pressure_diastolic = parseInt(data.blood_pressure_diastolic);
            if (data.heart_rate_bpm) updateData.heart_rate_bpm = parseInt(data.heart_rate_bpm);

            if (complete) {
                updateData.status = 'completed';
                updateData.conclusion_date = new Date().toISOString().split('T')[0];
            }

            await fetch(`/api/medical-exams/${exam.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData)
            });
        } catch (err) {
            console.error('Save error:', err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleNext = async () => {
        await saveProgress(formData);
        if (currentStep < 4) {
            setCurrentStep(currentStep + 1);
        } else {
            // Complete the exam
            await saveProgress(formData, true);
            setCurrentStep(5);
        }
    };

    const handlePrev = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
        }
    };

    const handleDownloadPDF = async () => {
        const element = document.getElementById('medical-report');
        if (!element || !patient) return;

        try {
            const dataUrl = await toPng(element, {
                backgroundColor: '#ffffff',
                skipFonts: true,
            });

            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            const imgProps = pdf.getImageProperties(dataUrl);
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

            pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`visite-medicale-${patient.last_name}-${formData.visit_date}.pdf`);
        } catch (err) {
            console.error('Error generating PDF:', err);
        }
    };

    const handleDownloadImage = async () => {
        const element = document.getElementById('medical-report');
        if (!element || !patient) return;

        try {
            const dataUrl = await toPng(element, {
                backgroundColor: '#ffffff',
                skipFonts: true,
            });

            const link = document.createElement('a');
            link.download = `visite-medicale-${patient.last_name}-${formData.visit_date}.png`;
            link.href = dataUrl;
            link.click();
        } catch (err) {
            console.error('Error generating image:', err);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-red-400 mb-4">{error}</p>
                    <Link href={`/intranet/patients/${resolvedParams.id}`} className="text-emerald-400 hover:underline">
                        Retour au dossier patient
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 p-6">
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <Link
                        href={`/intranet/patients/${resolvedParams.id}?tab=exams`}
                        className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-white" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-white">
                            {currentStep === 5 ? 'Rapport de visite médicale' : 'Visite médicale'}
                        </h1>
                        {patient && (
                            <p className="text-gray-400">
                                Patient: {patient.first_name} {patient.last_name}
                            </p>
                        )}
                    </div>
                    {isSaving && (
                        <div className="ml-auto flex items-center gap-2 text-sm text-gray-400">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Sauvegarde...
                        </div>
                    )}
                </div>

                {/* Progress Steps */}
                {currentStep <= 4 && (
                    <div className="flex items-center justify-between bg-zinc-900/50 border border-white/10 rounded-xl p-4">
                        {STEPS.map((step, index) => (
                            <div key={step.id} className="flex items-center">
                                <div
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${currentStep === step.id
                                        ? 'bg-emerald-600 text-white'
                                        : currentStep > step.id
                                            ? 'bg-emerald-600/20 text-emerald-400'
                                            : 'bg-zinc-800 text-gray-400'
                                        }`}
                                >
                                    {currentStep > step.id ? (
                                        <CheckCircle className="w-5 h-5" />
                                    ) : (
                                        <step.icon className="w-5 h-5" />
                                    )}
                                    <span className="text-sm font-medium hidden sm:inline">{step.title}</span>
                                </div>
                                {index < STEPS.length - 1 && (
                                    <div className={`w-8 h-0.5 mx-2 ${currentStep > step.id ? 'bg-emerald-500' : 'bg-zinc-700'}`} />
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Form Content */}
                <motion.div
                    key={currentStep}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="bg-zinc-900/50 border border-white/10 rounded-xl p-6"
                >
                    {/* Step 1: Administrative Info */}
                    {currentStep === 1 && (
                        <div className="space-y-6">
                            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                                <User className="w-5 h-5 text-emerald-400" />
                                Informations administratives
                            </h2>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">Date de la visite</label>
                                    <input
                                        type="date"
                                        value={formData.visit_date}
                                        onChange={(e) => setFormData({ ...formData, visit_date: e.target.value })}
                                        className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">Type de visite</label>
                                    <select
                                        value={formData.visit_type}
                                        onChange={(e) => setFormData({ ...formData, visit_type: e.target.value })}
                                        className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white"
                                    >
                                        <option value="">Sélectionner...</option>
                                        {VISIT_TYPES.map((type) => (
                                            <option key={type.value} value={type.value}>{type.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">Profession / Fonction</label>
                                    <input
                                        type="text"
                                        value={formData.profession}
                                        onChange={(e) => setFormData({ ...formData, profession: e.target.value })}
                                        placeholder="Ex: Joueur de football"
                                        className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">Employeur / Service</label>
                                    <input
                                        type="text"
                                        value={formData.employer}
                                        onChange={(e) => setFormData({ ...formData, employer: e.target.value })}
                                        placeholder="Ex: Los Santos Eagles"
                                        className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Medical History */}
                    {currentStep === 2 && (
                        <div className="space-y-6">
                            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                                <Heart className="w-5 h-5 text-emerald-400" />
                                Antécédents médicaux
                            </h2>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">Antécédents personnels</label>
                                    <textarea
                                        value={formData.personal_history}
                                        onChange={(e) => setFormData({ ...formData, personal_history: e.target.value })}
                                        rows={3}
                                        className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white resize-none"
                                        placeholder="Maladies, opérations, hospitalisations..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">Antécédents familiaux</label>
                                    <textarea
                                        value={formData.family_history}
                                        onChange={(e) => setFormData({ ...formData, family_history: e.target.value })}
                                        rows={3}
                                        className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white resize-none"
                                        placeholder="Maladies héréditaires, cancers..."
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="flex items-center gap-3 text-white cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={formData.allergies}
                                                onChange={(e) => setFormData({ ...formData, allergies: e.target.checked })}
                                                className="w-5 h-5 rounded border-white/20 bg-black/50 text-emerald-500"
                                            />
                                            Allergies connues
                                        </label>
                                        {formData.allergies && (
                                            <input
                                                type="text"
                                                value={formData.allergies_details}
                                                onChange={(e) => setFormData({ ...formData, allergies_details: e.target.value })}
                                                placeholder="Préciser les allergies..."
                                                className="w-full mt-2 bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white"
                                            />
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-2">Traitement en cours</label>
                                        <input
                                            type="text"
                                            value={formData.current_treatment}
                                            onChange={(e) => setFormData({ ...formData, current_treatment: e.target.value })}
                                            placeholder="Médicaments actuels..."
                                            className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white"
                                        />
                                    </div>
                                </div>

                                <div className="bg-black/30 rounded-lg p-4">
                                    <h3 className="text-white font-medium mb-3">Habitudes de vie</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <label className="flex items-center gap-3 text-white cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={formData.tobacco}
                                                onChange={(e) => setFormData({ ...formData, tobacco: e.target.checked })}
                                                className="w-5 h-5 rounded"
                                            />
                                            Tabac
                                        </label>
                                        <label className="flex items-center gap-3 text-white cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={formData.alcohol}
                                                onChange={(e) => setFormData({ ...formData, alcohol: e.target.checked })}
                                                className="w-5 h-5 rounded"
                                            />
                                            Alcool
                                        </label>
                                        <div>
                                            <label className="block text-sm text-gray-400 mb-1">Sommeil</label>
                                            <select
                                                value={formData.sleep_quality}
                                                onChange={(e) => setFormData({ ...formData, sleep_quality: e.target.value })}
                                                className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm"
                                            >
                                                <option value="satisfaisant">Satisfaisant</option>
                                                <option value="insuffisant">Insuffisant</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Clinical Exam */}
                    {currentStep === 3 && (
                        <div className="space-y-6">
                            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                                <Stethoscope className="w-5 h-5 text-emerald-400" />
                                Examen clinique
                            </h2>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">Taille (cm)</label>
                                    <input
                                        type="number"
                                        value={formData.height_cm}
                                        onChange={(e) => setFormData({ ...formData, height_cm: e.target.value })}
                                        className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">Poids (kg)</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={formData.weight_kg}
                                        onChange={(e) => setFormData({ ...formData, weight_kg: e.target.value })}
                                        className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">Tension (mmHg)</label>
                                    <div className="flex gap-1">
                                        <input
                                            type="number"
                                            value={formData.blood_pressure_systolic}
                                            onChange={(e) => setFormData({ ...formData, blood_pressure_systolic: e.target.value })}
                                            placeholder="Sys"
                                            className="w-full bg-black/50 border border-white/10 rounded-lg px-2 py-2 text-white text-center"
                                        />
                                        <span className="text-gray-400 self-center">/</span>
                                        <input
                                            type="number"
                                            value={formData.blood_pressure_diastolic}
                                            onChange={(e) => setFormData({ ...formData, blood_pressure_diastolic: e.target.value })}
                                            placeholder="Dia"
                                            className="w-full bg-black/50 border border-white/10 rounded-lg px-2 py-2 text-white text-center"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">Fréquence cardiaque</label>
                                    <input
                                        type="number"
                                        value={formData.heart_rate_bpm}
                                        onChange={(e) => setFormData({ ...formData, heart_rate_bpm: e.target.value })}
                                        placeholder="bpm"
                                        className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white"
                                    />
                                </div>
                            </div>

                            <div className="bg-black/30 rounded-lg overflow-hidden">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-white/10">
                                            <th className="text-left text-gray-400 text-sm py-3 px-4">Paramètre</th>
                                            <th className="text-center text-gray-400 text-sm py-3 px-4">Normal</th>
                                            <th className="text-center text-gray-400 text-sm py-3 px-4">Altéré/Anormal</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[
                                            { key: 'hearing', label: 'Audition', altLabel: 'altered' },
                                            { key: 'respiratory', label: 'Appareil respiratoire', altLabel: 'abnormal' },
                                            { key: 'cardiovascular', label: 'Appareil cardiovasculaire', altLabel: 'abnormal' },
                                            { key: 'nervous_system', label: 'Système nerveux', altLabel: 'abnormal' },
                                            { key: 'musculoskeletal', label: 'Appareil locomoteur', altLabel: 'abnormal' },
                                            { key: 'skin', label: 'Peau / muqueuses', altLabel: 'abnormal' },
                                            { key: 'blood_test', label: 'Test sanguin (24h)', altLabel: 'abnormal' }
                                        ].map((item) => (
                                            <tr key={item.key} className="border-b border-white/5">
                                                <td className="text-white py-3 px-4">{item.label}</td>
                                                <td className="text-center py-3 px-4">
                                                    <input
                                                        type="radio"
                                                        name={item.key}
                                                        checked={formData[item.key as keyof typeof formData] === 'normal'}
                                                        onChange={() => setFormData({ ...formData, [item.key]: 'normal' })}
                                                        className="w-5 h-5 text-emerald-500"
                                                    />
                                                </td>
                                                <td className="text-center py-3 px-4">
                                                    <input
                                                        type="radio"
                                                        name={item.key}
                                                        checked={formData[item.key as keyof typeof formData] === item.altLabel}
                                                        onChange={() => setFormData({ ...formData, [item.key]: item.altLabel })}
                                                        className="w-5 h-5 text-red-500"
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div>
                                <label className="block text-sm text-gray-400 mb-2">Autres observations</label>
                                <textarea
                                    value={formData.other_observations}
                                    onChange={(e) => setFormData({ ...formData, other_observations: e.target.value })}
                                    rows={3}
                                    className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white resize-none"
                                />
                            </div>
                        </div>
                    )}

                    {/* Step 4: Conclusion */}
                    {currentStep === 4 && (
                        <div className="space-y-6">
                            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                                <FileText className="w-5 h-5 text-emerald-400" />
                                Conclusion
                            </h2>

                            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4">
                                <label className="flex items-start gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.no_contraindication}
                                        onChange={(e) => setFormData({ ...formData, no_contraindication: e.target.checked })}
                                        className="w-5 h-5 mt-1 rounded text-emerald-500"
                                    />
                                    <span className="text-white">
                                        Aucune contre-indication médicale n&apos;a été constatée à ce jour à la pratique du football américain au niveau professionnel, y compris en compétition officielle organisée par la Major Football League (MFL).
                                    </span>
                                </label>
                            </div>

                            <div>
                                <label className="block text-sm text-gray-400 mb-2">Signature du médecin examinateur</label>
                                <input
                                    type="text"
                                    value={formData.examiner_signature}
                                    onChange={(e) => setFormData({ ...formData, examiner_signature: e.target.value })}
                                    placeholder="Dr. Prénom Nom"
                                    className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white"
                                />
                            </div>

                            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                                <p className="text-yellow-400 text-sm">
                                    ⚠️ En cliquant sur &quot;Finaliser&quot;, l&apos;examen sera marqué comme terminé et ne pourra plus être modifié.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Step 5: Final View */}
                    {currentStep === 5 && exam && patient && (
                        <div className="space-y-6">
                            {/* Document Preview Container */}
                            <div
                                id="medical-report"
                                className="bg-white text-black p-8 shadow-xl rounded-sm min-h-[800px]"
                                style={{ fontFamily: 'Georgia, serif' }}
                            >
                                {/* Header PHMC */}
                                <div className="border-b-2 border-red-600 pb-4 mb-6">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h1 className="text-3xl font-bold text-red-600 uppercase tracking-wider">PILLBOX HILL</h1>
                                            <p className="text-lg text-gray-600 font-semibold">Medical Center</p>
                                            <p className="text-sm text-gray-500 mt-1">Los Santos, San Andreas</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm text-gray-600">Date du rapport</p>
                                            <p className="font-bold text-lg">
                                                {new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Titre du document */}
                                <div className="text-center mb-8">
                                    <h2 className="text-2xl font-bold uppercase tracking-widest border-b border-gray-300 inline-block pb-1">
                                        Compte Rendu de Visite Médicale
                                    </h2>
                                    <p className="text-gray-500 italic mt-2">
                                        {VISIT_TYPES.find(t => t.value === formData.visit_type)?.label || 'Visite médicale'}
                                    </p>
                                </div>

                                {/* Informations Patient */}
                                <div className="bg-gray-50 border border-gray-200 p-4 mb-6">
                                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 border-b border-gray-200 pb-1">
                                        Patient
                                    </h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-sm text-gray-500">Nom / Prénom</p>
                                            <p className="font-bold text-lg">{patient.first_name} {patient.last_name}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-500">Date de naissance</p>
                                            <p className="font-medium">
                                                {patient.birth_date ? new Date(patient.birth_date).toLocaleDateString('fr-FR') : 'N/A'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-500">Profession</p>
                                            <p className="font-medium">{formData.profession || 'Non renseigné'}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-500">Employeur</p>
                                            <p className="font-medium">{formData.employer || 'Non renseigné'}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Contenu Médical */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
                                    {/* Colonne Gauche: Constantes & Antécédents */}
                                    <div>
                                        <div className="mb-6">
                                            <h3 className="text-sm font-bold text-red-600 uppercase tracking-wider mb-2 border-b border-red-100 pb-1">
                                                Constantes Vitales
                                            </h3>
                                            <ul className="space-y-1 text-sm">
                                                <li className="flex justify-between border-b border-dotted border-gray-300 py-1">
                                                    <span>Taille</span>
                                                    <span className="font-bold">{formData.height_cm ? `${formData.height_cm} cm` : '-'}</span>
                                                </li>
                                                <li className="flex justify-between border-b border-dotted border-gray-300 py-1">
                                                    <span>Poids</span>
                                                    <span className="font-bold">{formData.weight_kg ? `${formData.weight_kg} kg` : '-'}</span>
                                                </li>
                                                <li className="flex justify-between border-b border-dotted border-gray-300 py-1">
                                                    <span>Tension</span>
                                                    <span className="font-bold">
                                                        {formData.blood_pressure_systolic && formData.blood_pressure_diastolic
                                                            ? `${formData.blood_pressure_systolic}/${formData.blood_pressure_diastolic} mmHg`
                                                            : '-'}
                                                    </span>
                                                </li>
                                                <li className="flex justify-between border-b border-dotted border-gray-300 py-1">
                                                    <span>Pouls</span>
                                                    <span className="font-bold">{formData.heart_rate_bpm ? `${formData.heart_rate_bpm} bpm` : '-'}</span>
                                                </li>
                                            </ul>
                                        </div>

                                        <div className="mb-6">
                                            <h3 className="text-sm font-bold text-red-600 uppercase tracking-wider mb-2 border-b border-red-100 pb-1">
                                                Antécédents & Habitudes
                                            </h3>
                                            <div className="text-sm space-y-2">
                                                {formData.allergies && (
                                                    <p><span className="font-bold text-red-500">Allergies:</span> {formData.allergies_details}</p>
                                                )}
                                                {formData.current_treatment && (
                                                    <p><span className="font-bold">Traitement:</span> {formData.current_treatment}</p>
                                                )}
                                                <div className="flex gap-4 mt-2 text-gray-600 text-xs">
                                                    <span className={formData.tobacco ? "text-red-500 font-bold" : ""}>
                                                        Tabac: {formData.tobacco ? "Oui" : "Non"}
                                                    </span>
                                                    <span className={formData.alcohol ? "text-red-500 font-bold" : ""}>
                                                        Alcool: {formData.alcohol ? "Oui" : "Non"}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Colonne Droite: Examen Clinique */}
                                    <div>
                                        <h3 className="text-sm font-bold text-red-600 uppercase tracking-wider mb-2 border-b border-red-100 pb-1">
                                            Examen Clinique
                                        </h3>
                                        <table className="w-full text-sm">
                                            <tbody>
                                                {[
                                                    { key: 'hearing', label: 'Audition' },
                                                    { key: 'respiratory', label: 'Respiratoire' },
                                                    { key: 'cardiovascular', label: 'Cardiovasculaire' },
                                                    { key: 'nervous_system', label: 'Système nerveux' },
                                                    { key: 'musculoskeletal', label: 'Locomoteur' },
                                                    { key: 'skin', label: 'Peau / Muqueuses' },
                                                    { key: 'blood_test', label: 'Biologie' }
                                                ].map((item) => {
                                                    const status = formData[item.key as keyof typeof formData];
                                                    const isNormal = status === 'normal';
                                                    return (
                                                        <tr key={item.key} className="border-b border-gray-100">
                                                            <td className="py-1">{item.label}</td>
                                                            <td className={`py-1 text-right font-bold ${isNormal ? 'text-green-600' : 'text-red-600'}`}>
                                                                {isNormal ? 'Normal' : 'Anormal'}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                        {formData.other_observations && (
                                            <div className="mt-4 bg-yellow-50 p-2 border border-yellow-100 text-sm">
                                                <p className="font-bold text-yellow-800 text-xs uppercase mb-1">Observations</p>
                                                <p className="italic text-gray-700">{formData.other_observations}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Conclusion */}
                                <div className="border-t-2 border-gray-200 pt-6 mb-8">
                                    <h3 className="text-center font-bold text-lg uppercase tracking-wider mb-4">Conclusion Médicale</h3>

                                    {formData.no_contraindication ? (
                                        <div className="bg-green-50 border border-green-200 p-4 text-center rounded">
                                            <p className="text-green-800 font-serif text-lg">
                                                "Aucune contre-indication médicale n'a été constatée à ce jour à la pratique du football américain au niveau professionnel."
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="bg-red-50 border border-red-200 p-4 text-center rounded">
                                            <p className="text-red-800 font-bold">
                                                APTITUDE NON VALIDÉE / RÉSERVES ÉMISES
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Signature */}
                                <div className="flex justify-end mt-12">
                                    <div className="text-center w-64">
                                        <p className="text-sm text-gray-500 mb-8">Signature et Cachet du Médecin</p>
                                        <div className="border-t border-gray-300 pt-2">
                                            <p className="font-bold text-lg">{formData.examiner_signature || 'Dr. ________________'}</p>
                                            <p className="text-xs text-gray-400 uppercase mt-1">Médecin Agrée PHMC</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="mt-12 pt-4 border-t border-gray-100 text-center">
                                    <p className="text-xs text-gray-400">
                                        Pillbox Hill Medical Center • Document confidentiel • Généré le {new Date().toLocaleDateString('fr-FR')}
                                    </p>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex justify-center gap-4 pt-4">
                                <button
                                    onClick={handleDownloadPDF}
                                    className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors shadow-lg"
                                >
                                    <Download className="w-5 h-5" />
                                    Télécharger PDF
                                </button>
                                <button
                                    onClick={handleDownloadImage}
                                    className="flex items-center gap-2 px-6 py-3 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg transition-colors shadow-lg"
                                >
                                    <ImageIcon className="w-5 h-5" />
                                    Télécharger Image
                                </button>
                            </div>
                        </div>
                    )}
                </motion.div>

                {/* Navigation Buttons */}
                {currentStep <= 4 && (
                    <div className="flex justify-between">
                        <button
                            onClick={handlePrev}
                            disabled={currentStep === 1}
                            className="flex items-center gap-2 px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ArrowLeft className="w-5 h-5" />
                            Précédent
                        </button>
                        <button
                            onClick={handleNext}
                            disabled={isSaving}
                            className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors"
                        >
                            {isSaving ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : currentStep === 4 ? (
                                <>
                                    <CheckCircle className="w-5 h-5" />
                                    Finaliser
                                </>
                            ) : (
                                <>
                                    Suivant
                                    <ArrowRight className="w-5 h-5" />
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
