"use client";

import { useState, useEffect, use } from "react";
import { motion } from "framer-motion";
import {
    ArrowLeft, ArrowRight, Save, Loader2, CheckCircle, User, Heart,
    Stethoscope, FileText, Download, Image as ImageIcon, Trash2, Copy, FileCheck
} from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';
import { AnimatedDeleteButton } from "@/components/ui/AnimatedButtons";
import { useToast } from "@/contexts/ToastContext";

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
    psycho_favorable?: boolean;
    psycho_data?: Record<string, string>;
}

const VISIT_TYPES = [
    { value: 'medical_classic', label: 'Visite médicale (classique)' },
    { value: 'medical_mfl', label: 'Visite médicale (MFL)' },
    { value: 'psycho_test', label: 'Test psychotechnique' }
];

// Psychotechnique - Questions d'évaluation d'agressivité
const PSYCHO_AGGRESSION_QUESTIONS = [
    { id: 'self_defense', question: 'Vous défendriez-vous si vous étiez agressé ?', note: 'Instinctivement la personne répond "oui", c\'est accepté tant que la défense est à la hauteur de l\'agression.' },
    { id: 'lose_calm', question: 'Perdez-vous facilement votre calme ?', note: 'Évaluons les limites de la personne et jaugeons son agressivité.' },
    { id: 'obey_order', question: 'Obéissez-vous à un ordre qui va à l\'encontre de vos principes ?', note: 'La personne est-elle capable d\'outrepasser ses principes pour atteindre un objectif ?' },
    { id: 'aggressive_behavior', question: 'Pensez-vous qu\'un comportement agressif est parfois nécessaire pour obtenir ce que l\'on veut ?', note: 'Toujours privilégier le dialogue et la diplomatie.' }
];

// Psychotechnique - Mises en situation
const PSYCHO_SCENARIOS = [
    {
        id: 'scenario_1',
        situation: 'Vous allez au niveau du barrage en vélo. Soudain vous voyez un groupe d\'hommes armés et masqués s\'approcher de vous pour vous dire de déguerpir. Que faites-vous ?',
        good_answer: 'Vous partez sans faire d\'histoire. Une fois à l\'abri plus loin, vous appelez la LSPD pour les avertir de ce qu\'il vient de se passer.',
        bad_answer: 'Je braque les personnes en face de moi et je leur dis de baisser d\'un ton.'
    },
    {
        id: 'scenario_2',
        situation: 'Vous vous promenez à Mirror Park, il est 22h. Écouteurs et musique à fond, vous ne faites pas attention autour de vous mais vous avez votre arme dans votre holster. Soudain, vous sentez une main vous agripper par l\'épaule et insister pour que vous vous retourniez. Vous ne savez pas qui est cette personne. Que faites-vous ?',
        good_answer: 'Je m\'éloigne d\'un pas sec afin de m\'éloigner pour me retourner, une main sur le holster car nous ne connaissons pas le danger.',
        bad_answer: 'Je sors mon arme, je braque directement la personne en lui demandant de lever ses mains. Cette personne pourrait être une personne âgée égarée.'
    },
    {
        id: 'scenario_3',
        situation: 'Vos proches se font agresser / prendre en otage devant vous, et vous êtes armé. Que faites-vous ?',
        good_answer: 'Je reste calme et rappelle de sécuriser ma propre sécurité et celle des blessés. J\'appelle au plus vite les EMS et la LSPD.',
        bad_answer: 'Je sors mon arme et je tire sur les agresseurs.'
    }
];

// Dynamic steps based on visit type
const getStepsForType = (visitType: string) => {
    if (visitType === 'psycho_test') {
        return [
            { id: 1, title: 'Informations', icon: User },
            { id: 2, title: 'Évaluation', icon: Heart },
            { id: 3, title: 'Mises en situation', icon: Stethoscope },
            { id: 4, title: 'Conclusion', icon: FileText }
        ];
    }
    return [
        { id: 1, title: 'Informations', icon: User },
        { id: 2, title: 'Antécédents', icon: Heart },
        { id: 3, title: 'Examen clinique', icon: Stethoscope },
        { id: 4, title: 'Conclusion', icon: FileText }
    ];
};

export default function MedicalExamPage({ params }: { params: Promise<{ id: string; examId: string }> }) {
    const resolvedParams = use(params);
    const router = useRouter();
    const searchParams = useSearchParams();
    const { data: session } = useSession();
    const toast = useToast();

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
        examiner_signature: '',
        // Psycho test specific fields
        psycho_favorable: false,
        psycho_data: {} as Record<string, string>
    });

    // Get steps based on visit type
    const currentSteps = getStepsForType(formData.visit_type);

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
                    // New visit - no draft creation, just stay on form
                    // Data will be saved only on finalization
                    setIsLoading(false);
                    return;
                } else {
                    // Fetch existing completed exam for viewing
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
                            examiner_signature: examData.examiner_signature || '',
                            // Psycho test specific fields
                            psycho_favorable: examData.psycho_favorable || false,
                            psycho_data: examData.psycho_data || {}
                        });
                        // Always show final view for completed exams
                        setCurrentStep(5);
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


    const handleNext = async () => {
        if (currentStep < 4) {
            setCurrentStep(currentStep + 1);
        } else {
            // Finalize: Create the visit directly with status 'completed'
            setIsSaving(true);
            try {
                const createData: Record<string, unknown> = { ...formData };

                // Convert string numbers to actual numbers
                if (formData.height_cm) createData.height_cm = parseInt(formData.height_cm);
                if (formData.weight_kg) createData.weight_kg = parseFloat(formData.weight_kg);
                if (formData.blood_pressure_systolic) createData.blood_pressure_systolic = parseInt(formData.blood_pressure_systolic);
                if (formData.blood_pressure_diastolic) createData.blood_pressure_diastolic = parseInt(formData.blood_pressure_diastolic);
                if (formData.heart_rate_bpm) createData.heart_rate_bpm = parseInt(formData.heart_rate_bpm);

                createData.status = 'completed';
                createData.conclusion_date = new Date().toISOString().split('T')[0];

                const res = await fetch(`/api/patients/${resolvedParams.id}/medical-exams`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(createData)
                });

                if (res.ok) {
                    const newExam = await res.json();
                    setExam(newExam);
                    setCurrentStep(5);
                    // Update URL to reflect the new exam ID
                    router.replace(`/intranet/patients/${resolvedParams.id}/medical-exam/${newExam.id}`);
                } else {
                    const errorData = await res.json();
                    setError(errorData.error || "Erreur lors de la création de la visite");
                }
            } catch (err) {
                console.error('Create error:', err);
                setError("Erreur lors de la création de la visite");
            } finally {
                setIsSaving(false);
            }
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



    // Générer le rapport au format texte (copy-paste) - Format compact pour fenêtres étroites in-game
    const generateTextReport = () => {
        if (!patient) return '';
        const visitTypeLabel = VISIT_TYPES.find(t => t.value === formData.visit_type)?.label || formData.visit_type;
        const checkBox = (val: boolean) => val ? '☑' : '☐';
        const statusText = (val: string | null) => val === 'normal' ? 'OK' : 'Anormal';

        let text = `═══════════════════════\n`;
        text += `  PILLBOX HILL MC\n`;
        text += `   RAPPORT VISITE\n`;
        text += `═══════════════════════\n\n`;

        text += `► PATIENT\n`;
        text += `───────────────────\n`;
        text += `Nom: ${patient.last_name.toUpperCase()}\n`;
        text += `Prénom: ${patient.first_name}\n`;
        text += `Naissance: ${patient.birth_date ? new Date(patient.birth_date).toLocaleDateString('fr-FR') : 'N/C'}\n`;
        text += `Tél: ${patient.phone || 'N/C'}\n\n`;

        text += `► VISITE\n`;
        text += `───────────────────\n`;
        text += `Type: ${visitTypeLabel}\n`;
        text += `Date: ${formData.visit_date ? new Date(formData.visit_date).toLocaleDateString('fr-FR') : 'N/C'}\n\n`;

        if (formData.visit_type === 'psycho_test') {
            // Rapport psychotechnique
            text += `► ÉVAL. AGRESSIVITÉ\n`;
            text += `───────────────────\n`;
            PSYCHO_AGGRESSION_QUESTIONS.forEach(q => {
                const response = formData.psycho_data[q.id] || 'N/C';
                text += `Q: ${q.question}\n`;
                text += `R: ${response}\n\n`;
            });

            text += `► MISES EN SITUATION\n`;
            text += `───────────────────\n`;
            PSYCHO_SCENARIOS.forEach((scenario, index) => {
                const response = formData.psycho_data[scenario.id] || 'N/C';
                text += `Scénario ${index + 1}:\n`;
                text += `${scenario.situation}\n`;
                text += `→ ${response}\n\n`;
            });

            text += `► CONCLUSION\n`;
            text += `───────────────────\n`;
            if (formData.psycho_favorable || formData.no_contraindication) {
                text += `${checkBox(true)} AVIS FAVORABLE\n`;
                text += `Test psychotechnique\n`;
                text += `réussi - RAS.\n`;
            } else {
                text += `${checkBox(false)} AVIS DÉFAVORABLE\n`;
                text += `Critères non satisfaits.\n`;
            }
        } else {
            // Rapport médical (classique ou MFL)
            text += `► ANTÉCÉDENTS\n`;
            text += `───────────────────\n`;
            text += `Allergies: ${formData.allergies ? formData.allergies_details || 'Oui' : 'Aucune'}\n`;
            text += `Traitement: ${formData.current_treatment || 'Aucun'}\n`;
            text += `${checkBox(formData.tobacco)} Tabac\n`;
            text += `${checkBox(formData.alcohol)} Alcool\n\n`;

            text += `► EXAMEN CLINIQUE\n`;
            text += `───────────────────\n`;
            if (formData.height_cm && formData.weight_kg) {
                const imc = parseFloat(formData.weight_kg) / Math.pow(parseFloat(formData.height_cm) / 100, 2);
                text += `Taille: ${formData.height_cm}cm\n`;
                text += `Poids: ${formData.weight_kg}kg\n`;
                text += `IMC: ${imc.toFixed(1)}\n`;
            }
            if (formData.blood_pressure_systolic && formData.blood_pressure_diastolic) {
                text += `TA: ${formData.blood_pressure_systolic}/${formData.blood_pressure_diastolic}\n`;
            }
            if (formData.heart_rate_bpm) {
                text += `FC: ${formData.heart_rate_bpm} bpm\n`;
            }
            text += `\n`;
            text += `Audition: ${statusText(formData.hearing)}\n`;
            text += `Respi: ${statusText(formData.respiratory)}\n`;
            text += `Cardio: ${statusText(formData.cardiovascular)}\n`;
            text += `Neuro: ${statusText(formData.nervous_system)}\n`;
            text += `Locomoteur: ${statusText(formData.musculoskeletal)}\n`;
            text += `Peau: ${statusText(formData.skin)}\n`;
            text += `Bio: ${statusText(formData.blood_test)}\n`;
            if (formData.other_observations) {
                text += `Obs: ${formData.other_observations}\n`;
            }
            text += `\n`;

            text += `► CONCLUSION\n`;
            text += `───────────────────\n`;
            if (formData.no_contraindication) {
                if (formData.visit_type === 'medical_mfl') {
                    text += `${checkBox(true)} APTE MFL\n`;
                    text += `Aucune contre-indication.\n`;
                } else {
                    text += `${checkBox(true)} APTE\n`;
                    text += `Aucune contre-indication.\n`;
                }
            } else {
                text += `${checkBox(true)} INAPTE\n`;
                text += `Réserves émises.\n`;
            }
        }
        text += `\n`;

        text += `Médecin: ${formData.examiner_signature || 'Non signé'}\n`;
        text += `Date: ${new Date().toLocaleDateString('fr-FR')}\n`;
        text += `───────────────────\n`;
        text += `Confidentiel - PHMC\n`;

        return text;
    };

    // Générer le certificat patient (sans infos médicales détaillées)
    const generatePatientCertificate = () => {
        if (!patient) return '';
        const visitTypeLabel = VISIT_TYPES.find(t => t.value === formData.visit_type)?.label || formData.visit_type;

        let text = `══════════════════════════════════════════════════\n`;
        text += `         PILLBOX HILL MEDICAL CENTER\n`;
        text += `            CERTIFICAT MÉDICAL\n`;
        text += `══════════════════════════════════════════════════\n\n`;

        text += `Je soussigné(e), Dr. ${formData.examiner_signature || '___________'},\n`;
        text += `médecin agréé au Pillbox Hill Medical Center,\n\n`;

        text += `Certifie avoir examiné ce jour:\n\n`;
        text += `Nom: ${patient.last_name.toUpperCase()} ${patient.first_name}\n`;
        text += `Date de naissance: ${patient.birth_date ? new Date(patient.birth_date).toLocaleDateString('fr-FR') : 'Non renseignée'}\n\n`;

        text += `Dans le cadre de: ${visitTypeLabel}\n`;
        text += `Date de l'examen: ${formData.visit_date ? new Date(formData.visit_date).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR')}\n\n`;

        if (formData.no_contraindication) {
            if (formData.visit_type === 'psycho_test') {
                text += `AVIS: FAVORABLE\n\n`;
                text += `Le patient a passé avec succès le test psychotechnique\n`;
                text += `et ne présente aucune contre-indication au port d'arme.\n`;
            } else if (formData.visit_type === 'medical_mfl') {
                text += `AVIS: APTE\n\n`;
                text += `Aucune contre-indication médicale n'a été constatée\n`;
                text += `à ce jour à la pratique du football américain\n`;
                text += `au niveau professionnel.\n`;
            } else {
                text += `AVIS: APTE\n\n`;
                text += `Aucune contre-indication médicale n'a été constatée.\n`;
            }
        } else {
            text += `AVIS: INAPTE / RÉSERVES\n\n`;
            text += `Des réserves ont été émises concernant l'aptitude.\n`;
        }

        text += `\n\nFait à Los Santos, le ${new Date().toLocaleDateString('fr-FR')}\n\n`;
        text += `Signature: _______________________\n`;
        text += `Dr. ${formData.examiner_signature || '___________'}\n`;
        text += `Médecin agréé PHMC\n\n`;
        text += `──────────────────────────────────────────────────\n`;
        text += `Ce document est délivré pour servir et valoir\n`;
        text += `ce que de droit.\n`;

        return text;
    };

    const handleCopyText = async () => {
        if (!patient) return;

        const visitTypeLabel = VISIT_TYPES.find(t => t.value === formData.visit_type)?.label || formData.visit_type;
        const checkBox = (val: boolean) => val ? '☑' : '☐';
        const statusText = (val: string | null) => val === 'normal' ? 'Normal' : 'Anormal';

        // Generate HTML with bold tags for Google Docs
        let html = `<div style="font-family: Arial, sans-serif; white-space: pre-wrap;">`;
        html += `══════════════════════════════════════════════════<br>`;
        html += `         PILLBOX HILL MEDICAL CENTER<br>`;
        html += `            RAPPORT DE VISITE<br>`;
        html += `══════════════════════════════════════════════════<br><br>`;

        html += `▶ INFORMATIONS PATIENT<br>`;
        html += `─────────────────────────<br>`;
        html += `<b>Nom:</b> ${patient.last_name.toUpperCase()} ${patient.first_name}<br>`;
        html += `<b>Date de naissance:</b> ${patient.birth_date ? new Date(patient.birth_date).toLocaleDateString('fr-FR') : 'Non renseignée'}<br>`;
        html += `<b>Téléphone:</b> ${patient.phone || 'Non renseigné'}<br>`;
        html += `<b>Profession:</b> ${formData.profession || 'Non renseignée'}<br><br>`;

        html += `▶ VISITE<br>`;
        html += `─────────────────────────<br>`;
        html += `<b>Type:</b> ${visitTypeLabel}<br>`;
        html += `<b>Date:</b> ${formData.visit_date ? new Date(formData.visit_date).toLocaleDateString('fr-FR') : 'Non datée'}<br><br>`;

        if (formData.visit_type === 'psycho_test') {
            html += `▶ ÉVALUATION DE L'AGRESSIVITÉ<br>`;
            html += `─────────────────────────<br>`;
            PSYCHO_AGGRESSION_QUESTIONS.forEach(q => {
                const response = formData.psycho_data[q.id] || 'Non renseigné';
                html += `<b>Q:</b> ${q.question}<br>`;
                html += `<b>R:</b> ${response}<br><br>`;
            });

            html += `▶ MISES EN SITUATION<br>`;
            html += `─────────────────────────<br>`;
            PSYCHO_SCENARIOS.forEach((scenario, index) => {
                const response = formData.psycho_data[scenario.id] || 'Non renseigné';
                html += `<b>Scénario ${index + 1}:</b><br>`;
                html += `${scenario.situation}<br>`;
                html += `<b>Réponse:</b> ${response}<br><br>`;
            });

            html += `▶ CONCLUSION<br>`;
            html += `─────────────────────────<br>`;
            if (formData.psycho_favorable || formData.no_contraindication) {
                html += `${checkBox(true)} <b>AVIS FAVORABLE</b><br>`;
                html += `Le patient a passé avec succès le test psychotechnique<br>`;
                html += `et ne présente aucune contre-indication au port d'arme.<br>`;
            } else {
                html += `${checkBox(false)} <b>AVIS DÉFAVORABLE</b><br>`;
                html += `Le patient n'a pas satisfait aux critères du test psychotechnique.<br>`;
            }
        } else {
            html += `▶ ANTÉCÉDENTS<br>`;
            html += `─────────────────────────<br>`;
            html += `<b>Allergies:</b> ${formData.allergies ? formData.allergies_details || 'Oui' : 'Aucune'}<br>`;
            html += `<b>Traitement actuel:</b> ${formData.current_treatment || 'Aucun'}<br>`;
            html += `${checkBox(formData.tobacco)} Tabac<br>`;
            html += `${checkBox(formData.alcohol)} Alcool<br><br>`;

            html += `▶ EXAMEN CLINIQUE<br>`;
            html += `─────────────────────────<br>`;
            if (formData.height_cm && formData.weight_kg) {
                const imc = parseFloat(formData.weight_kg) / Math.pow(parseFloat(formData.height_cm) / 100, 2);
                html += `<b>Taille:</b> ${formData.height_cm} cm | <b>Poids:</b> ${formData.weight_kg} kg | <b>IMC:</b> ${imc.toFixed(1)}<br>`;
            }
            if (formData.blood_pressure_systolic && formData.blood_pressure_diastolic) {
                html += `<b>Tension:</b> ${formData.blood_pressure_systolic}/${formData.blood_pressure_diastolic} mmHg<br>`;
            }
            if (formData.heart_rate_bpm) {
                html += `<b>Fréquence cardiaque:</b> ${formData.heart_rate_bpm} bpm<br>`;
            }
            html += `<br>`;
            html += `<b>Audition:</b> ${statusText(formData.hearing)}<br>`;
            html += `<b>Respiratoire:</b> ${statusText(formData.respiratory)}<br>`;
            html += `<b>Cardiovasculaire:</b> ${statusText(formData.cardiovascular)}<br>`;
            html += `<b>Système nerveux:</b> ${statusText(formData.nervous_system)}<br>`;
            html += `<b>Locomoteur:</b> ${statusText(formData.musculoskeletal)}<br>`;
            html += `<b>Peau/Muqueuses:</b> ${statusText(formData.skin)}<br>`;
            html += `<b>Biologie:</b> ${statusText(formData.blood_test)}<br>`;
            if (formData.other_observations) {
                html += `<b>Observations:</b> ${formData.other_observations}<br>`;
            }
            html += `<br>`;

            html += `▶ CONCLUSION<br>`;
            html += `─────────────────────────<br>`;
            if (formData.no_contraindication) {
                if (formData.visit_type === 'medical_mfl') {
                    html += `${checkBox(true)} <b>APTE</b><br>`;
                    html += `Aucune contre-indication médicale à la pratique<br>`;
                    html += `du football américain au niveau professionnel (MFL).<br>`;
                } else {
                    html += `${checkBox(true)} <b>APTE</b> - Aucune contre-indication n'a été constatée<br>`;
                }
            } else {
                html += `${checkBox(false)} <b>INAPTE</b><br>`;
            }
        }

        html += `<br>`;
        html += `<b>Examinateur:</b> ${formData.examiner_signature || '___________'}<br>`;
        html += `<b>Date de conclusion:</b> ${new Date().toLocaleDateString('fr-FR')}<br><br>`;
        html += `──────────────────────────────────────────────────<br>`;
        html += `Ce document est délivré pour servir et valoir<br>`;
        html += `ce que de droit.<br>`;
        html += `</div>`;

        // Copy as rich text HTML (for Google Docs)
        try {
            const blob = new Blob([html], { type: 'text/html' });
            const plainBlob = new Blob([html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ')], { type: 'text/plain' });
            await navigator.clipboard.write([
                new ClipboardItem({
                    'text/html': blob,
                    'text/plain': plainBlob
                })
            ]);
            toast.success('Rapport copié dans le presse-papiers!');
        } catch {
            // Fallback to plain text if rich text fails
            await navigator.clipboard.writeText(generateTextReport());
            toast.success('Rapport copié (texte simple)');
        }
    };

    const handleDownloadCertificate = async () => {
        const element = document.getElementById('patient-certificate');
        if (!element || !patient) return;

        try {
            const dataUrl = await toPng(element, {
                backgroundColor: '#ffffff',
                skipFonts: true,
            });

            const link = document.createElement('a');
            link.download = `certificat-${patient.last_name}-${formData.visit_date}.png`;
            link.href = dataUrl;
            link.click();
        } catch (err) {
            console.error('Error generating certificate image:', err);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center">
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
        <div className="min-h-screen p-6">
            <div className="w-full max-w-[1920px] mx-auto space-y-6">
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
                    {/* Actions Header */}
                    <div className="ml-auto flex items-center gap-4">
                        {isSaving && (
                            <div className="flex items-center gap-2 text-sm text-gray-400">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Sauvegarde...
                            </div>
                        )}
                    </div>
                </div>

                {/* Progress Steps */}
                {currentStep <= 4 && (
                    <div className="flex items-center w-full bg-zinc-900/50 border border-white/10 rounded-xl p-4">
                        {currentSteps.map((step: { id: number; title: string; icon: React.ComponentType<{ className?: string }> }, index: number) => (
                            <div key={step.id} className={`flex items-center ${index < currentSteps.length - 1 ? 'flex-1' : ''}`}>
                                <div
                                    className={`flex-none flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${currentStep === step.id
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
                                {index < currentSteps.length - 1 && (
                                    <div className={`flex-1 h-0.5 mx-4 ${currentStep > step.id ? 'bg-emerald-500' : 'bg-zinc-700'}`} />
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

                    {/* Step 2: Medical History OR Psycho Evaluation */}
                    {currentStep === 2 && (
                        <div className="space-y-6">
                            {formData.visit_type === 'psycho_test' ? (
                                <>
                                    <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                                        <Heart className="w-5 h-5 text-emerald-400" />
                                        Évaluation de l&apos;agressivité
                                    </h2>
                                    <p className="text-gray-400 text-sm">
                                        Notez les réponses du patient aux questions suivantes. Ces questions permettent d&apos;évaluer son comportement potentiel.
                                    </p>
                                    <div className="space-y-6">
                                        {PSYCHO_AGGRESSION_QUESTIONS.map((q) => (
                                            <div key={q.id} className="bg-black/30 rounded-lg p-4">
                                                <label className="block text-white font-medium mb-2">
                                                    {q.question}
                                                </label>
                                                <p className="text-xs text-gray-500 italic mb-3">
                                                    💡 {q.note}
                                                </p>
                                                <textarea
                                                    value={formData.psycho_data[q.id] || ''}
                                                    onChange={(e) => setFormData({ ...formData, psycho_data: { ...formData.psycho_data, [q.id]: e.target.value } })}
                                                    rows={2}
                                                    placeholder="Réponse du patient..."
                                                    className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white resize-none"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <>
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
                                </>
                            )}
                        </div>
                    )}

                    {/* Step 3: Clinical Exam OR Psycho Scenarios */}
                    {currentStep === 3 && (
                        <div className="space-y-6">
                            {formData.visit_type === 'psycho_test' ? (
                                <>
                                    <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                                        <Stethoscope className="w-5 h-5 text-emerald-400" />
                                        Mises en situation
                                    </h2>
                                    <p className="text-gray-400 text-sm">
                                        Présentez ces scénarios au patient et notez ses réponses. Minimum 3 scénarios requis.
                                    </p>
                                    <div className="space-y-6">
                                        {PSYCHO_SCENARIOS.map((scenario, index) => (
                                            <div key={scenario.id} className="bg-black/30 rounded-lg p-4 border border-white/10">
                                                <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                                                    <span className="bg-emerald-600 text-white text-xs px-2 py-1 rounded">
                                                        Scénario {index + 1}
                                                    </span>
                                                </h3>
                                                <p className="text-gray-300 mb-4 italic">
                                                    &quot;{scenario.situation}&quot;
                                                </p>
                                                <div className="grid md:grid-cols-2 gap-4 mb-4 text-xs">
                                                    <div className="bg-green-500/10 border border-green-500/20 rounded p-3">
                                                        <span className="text-green-400 font-bold">✓ Bonne réponse:</span>
                                                        <p className="text-green-300 mt-1">{scenario.good_answer}</p>
                                                    </div>
                                                    <div className="bg-red-500/10 border border-red-500/20 rounded p-3">
                                                        <span className="text-red-400 font-bold">✗ Mauvaise réponse:</span>
                                                        <p className="text-red-300 mt-1">{scenario.bad_answer}</p>
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-sm text-gray-400 mb-2">Réponse du patient:</label>
                                                    <textarea
                                                        value={formData.psycho_data[scenario.id] || ''}
                                                        onChange={(e) => setFormData({ ...formData, psycho_data: { ...formData.psycho_data, [scenario.id]: e.target.value } })}
                                                        rows={2}
                                                        placeholder="Notez la réponse donnée par le patient..."
                                                        className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white resize-none"
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <>
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
                                </>
                            )}
                        </div>
                    )}

                    {/* Step 4: Conclusion */}
                    {currentStep === 4 && (
                        <div className="space-y-6">
                            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                                <FileText className="w-5 h-5 text-emerald-400" />
                                Conclusion
                            </h2>

                            {formData.visit_type === 'psycho_test' ? (
                                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4">
                                    <label className="flex items-start gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.psycho_favorable}
                                            onChange={(e) => setFormData({ ...formData, psycho_favorable: e.target.checked, no_contraindication: e.target.checked })}
                                            className="w-5 h-5 mt-1 rounded text-emerald-500"
                                        />
                                        <span className="text-white">
                                            <strong>AVIS FAVORABLE</strong> - Le patient a passé avec succès le test psychotechnique et ne présente aucune contre-indication au port d&apos;arme.
                                        </span>
                                    </label>
                                </div>
                            ) : formData.visit_type === 'medical_mfl' ? (
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
                            ) : (
                                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4">
                                    <label className="flex items-start gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.no_contraindication}
                                            onChange={(e) => setFormData({ ...formData, no_contraindication: e.target.checked })}
                                            className="w-5 h-5 mt-1 rounded text-emerald-500"
                                        />
                                        <span className="text-white">
                                            <strong>APTE</strong> - Aucune contre-indication médicale n&apos;a été constatée à ce jour.
                                        </span>
                                    </label>
                                </div>
                            )}

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
                                        {formData.visit_type === 'psycho_test'
                                            ? 'Compte Rendu de Test Psychotechnique'
                                            : 'Compte Rendu de Visite Médicale'}
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

                                {/* Contenu conditionnel selon le type */}
                                {formData.visit_type === 'psycho_test' ? (
                                    // Contenu Psychotechnique
                                    <div className="mb-6">
                                        <div className="mb-6">
                                            <h3 className="text-sm font-bold text-red-600 uppercase tracking-wider mb-2 border-b border-red-100 pb-1">
                                                Évaluation de l&apos;Agressivité
                                            </h3>
                                            <div className="space-y-3">
                                                {PSYCHO_AGGRESSION_QUESTIONS.map((q) => {
                                                    const response = formData.psycho_data[q.id] as string;
                                                    return (
                                                        <div key={q.id} className="bg-gray-50 p-3 border border-gray-200 rounded">
                                                            <p className="text-sm font-bold text-gray-700">{q.question}</p>
                                                            <p className="text-sm text-gray-600 mt-1 italic">{response || 'Non renseigné'}</p>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        <div className="mb-6">
                                            <h3 className="text-sm font-bold text-red-600 uppercase tracking-wider mb-2 border-b border-red-100 pb-1">
                                                Mises en Situation
                                            </h3>
                                            <div className="space-y-4">
                                                {PSYCHO_SCENARIOS.map((scenario, index) => {
                                                    const response = formData.psycho_data[scenario.id] as string;
                                                    return (
                                                        <div key={scenario.id} className="bg-gray-50 p-3 border border-gray-200 rounded">
                                                            <p className="text-sm font-bold text-gray-700">Scénario {index + 1}</p>
                                                            <p className="text-xs text-gray-500 italic mb-2">{scenario.situation}</p>
                                                            <p className="text-sm text-gray-600 border-l-2 border-red-400 pl-2 mt-2">
                                                                <span className="font-bold">Réponse:</span> {response || 'Non renseigné'}
                                                            </p>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    // Contenu Médical
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
                                )}

                                {/* Conclusion */}
                                <div className="border-t-2 border-gray-200 pt-6 mb-8">
                                    <h3 className="text-center font-bold text-lg uppercase tracking-wider mb-4">
                                        {formData.visit_type === 'psycho_test' ? 'Conclusion' : 'Conclusion Médicale'}
                                    </h3>

                                    {formData.visit_type === 'psycho_test' ? (
                                        (formData.psycho_favorable || formData.no_contraindication) ? (
                                            <div className="bg-green-50 border border-green-200 p-4 text-center rounded">
                                                <p className="text-green-800 font-bold text-xl mb-2">AVIS FAVORABLE</p>
                                                <p className="text-green-700 font-serif">
                                                    Le patient a passé avec succès le test psychotechnique et ne présente aucune contre-indication au port d&apos;arme.
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="bg-red-50 border border-red-200 p-4 text-center rounded">
                                                <p className="text-red-800 font-bold text-xl mb-2">AVIS DÉFAVORABLE</p>
                                                <p className="text-red-700">
                                                    Le patient n&apos;a pas satisfait aux critères du test psychotechnique.
                                                </p>
                                            </div>
                                        )
                                    ) : formData.no_contraindication ? (
                                        <div className="bg-green-50 border border-green-200 p-4 text-center rounded">
                                            <p className="text-green-800 font-bold text-xl mb-2">APTE</p>
                                            <p className="text-green-700 font-serif">
                                                {formData.visit_type === 'medical_mfl'
                                                    ? "Aucune contre-indication médicale n'a été constatée à ce jour à la pratique du football américain au niveau professionnel."
                                                    : "Aucune contre-indication médicale n'a été constatée à ce jour."}
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

                            {/* Hidden Patient Certificate for Image Generation */}
                            <div
                                id="patient-certificate"
                                className="fixed top-[-9999px] left-0 bg-white text-black p-8 w-[800px]"
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
                                            <p className="text-sm text-gray-600">Date du certificat</p>
                                            <p className="font-bold text-lg">
                                                {new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Titre */}
                                <div className="text-center mb-8">
                                    <h2 className="text-2xl font-bold uppercase tracking-widest border-b border-gray-300 inline-block pb-1">
                                        CERTIFICAT MÉDICAL
                                    </h2>
                                    <p className="text-gray-500 italic mt-2">
                                        {VISIT_TYPES.find(t => t.value === formData.visit_type)?.label || 'Visite médicale'}
                                    </p>
                                </div>

                                {/* Corps du certificat */}
                                <div className="text-lg leading-relaxed mb-8">
                                    <p className="mb-6">
                                        Je soussigné(e), <strong>Dr. {formData.examiner_signature || '___________'}</strong>, médecin agréé
                                        au Pillbox Hill Medical Center, certifie avoir examiné ce jour:
                                    </p>

                                    <div className="bg-gray-50 border border-gray-200 p-4 mb-6 rounded">
                                        <p className="font-bold text-xl">{patient?.first_name} {patient?.last_name}</p>
                                        <p className="text-gray-600">
                                            Né(e) le: {patient?.birth_date ? new Date(patient.birth_date).toLocaleDateString('fr-FR') : 'Non renseignée'}
                                        </p>
                                    </div>

                                    <p className="mb-6">
                                        Dans le cadre de: <strong>{VISIT_TYPES.find(t => t.value === formData.visit_type)?.label || formData.visit_type}</strong>
                                    </p>
                                    <p className="mb-6">
                                        Date de l&apos;examen: <strong>{formData.visit_date ? new Date(formData.visit_date).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR')}</strong>
                                    </p>

                                    {/* Conclusion */}
                                    {formData.no_contraindication ? (
                                        <div className="bg-green-50 border-2 border-green-400 p-6 text-center rounded-lg">
                                            <p className="text-green-800 font-bold text-2xl mb-2">
                                                {formData.visit_type === 'psycho_test' ? 'AVIS FAVORABLE' : 'APTE'}
                                            </p>
                                            <p className="text-green-700">
                                                {formData.visit_type === 'psycho_test'
                                                    ? "Le patient a passé avec succès le test psychotechnique et ne présente aucune contre-indication au port d'arme."
                                                    : formData.visit_type === 'medical_mfl'
                                                        ? "Aucune contre-indication médicale n'a été constatée à ce jour à la pratique du football américain au niveau professionnel."
                                                        : "Aucune contre-indication médicale n'a été constatée à ce jour."}
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="bg-red-50 border-2 border-red-400 p-6 text-center rounded-lg">
                                            <p className="text-red-800 font-bold text-2xl mb-2">INAPTE / RÉSERVES</p>
                                            <p className="text-red-700">
                                                Des réserves ont été émises concernant l&apos;aptitude.
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Signature */}
                                <div className="flex justify-end mt-12">
                                    <div className="text-center w-64">
                                        <p className="text-sm text-gray-600 mb-2">Fait à Los Santos</p>
                                        <p className="text-sm text-gray-500 mb-8">Le {new Date().toLocaleDateString('fr-FR')}</p>
                                        <div className="border-t border-gray-300 pt-2">
                                            <p className="font-bold text-lg">{formData.examiner_signature || 'Dr. ________________'}</p>
                                            <p className="text-xs text-gray-400 uppercase mt-1">Médecin Agrée PHMC</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="mt-8 pt-4 border-t border-gray-200 text-center">
                                    <p className="text-xs text-gray-400">
                                        Ce certificat est délivré pour servir et valoir ce que de droit.
                                    </p>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex flex-wrap justify-center gap-4 pt-4">
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
                                <button
                                    onClick={handleCopyText}
                                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors shadow-lg"
                                >
                                    <Copy className="w-5 h-5" />
                                    Copier Rapport
                                </button>
                                <button
                                    onClick={handleDownloadCertificate}
                                    className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors shadow-lg"
                                >
                                    <FileCheck className="w-5 h-5" />
                                    Télécharger Certificat
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
