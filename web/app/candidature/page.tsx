"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Upload, CheckCircle, Loader2, AlertCircle, User, FileText, MessageSquare, X } from "lucide-react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useState, Suspense, useRef } from "react";
import { useSession, signIn } from "next-auth/react";
import type { ApplicationService } from "@/lib/types/database";

interface FileState {
    file: File | null;
    preview: string | null;
}

const STEPS = [
    { id: 1, title: "Identité", icon: User },
    { id: 2, title: "Documents", icon: FileText },
    { id: 3, title: "Motivation", icon: MessageSquare },
];

function CandidatureForm() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { data: session, status } = useSession();

    // Service EMS uniquement
    const normalizedService = "EMS" as const;
    const themeColor = "text-red-400";
    const themeBg = "bg-red-600 hover:bg-red-500";
    const themeBorder = "border-red-500";
    const themeAccent = "bg-red-500";

    const [currentStep, setCurrentStep] = useState(1);

    const [formData, setFormData] = useState({
        firstName: "",
        lastName: "",
        birthDate: "",
        seniority: "",
        motivation: "",
        availability: "",
    });

    const [files, setFiles] = useState<{
        cv: FileState;
    }>({
        cv: { file: null, preview: null },
    });

    const fileInputRefs = {
        cv: useRef<HTMLInputElement>(null),
    };

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<string | null>(null);
    const [uploadPercent, setUploadPercent] = useState<number>(0);
    const [error, setError] = useState<string | null>(null);

    if (status === "loading") {
        return (
            <main className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-white" />
            </main>
        );
    }

    if (status === "unauthenticated") {
        return (
            <>
                <div className="scan-overlay" />
                <div className="siren-bar">
                    <div className="siren-blue" />
                    <div className="siren-red" />
                </div>
                <main className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="max-w-md w-full text-center p-8 border border-white/10 bg-white/[0.02]"
                    >
                        <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                        <h2 className="font-display text-2xl font-bold mb-2 uppercase">Connexion requise</h2>
                        <p className="font-sans text-gray-400 mb-6">
                            Vous devez être connecté avec Discord pour déposer une candidature.
                        </p>
                        <button
                            onClick={() => signIn("discord", { callbackUrl: `/candidature?service=ems` })}
                            className="w-full flex items-center justify-center gap-3 bg-[#5865F2] hover:bg-[#4752C4] text-white py-4 px-6 font-display font-bold tracking-widest uppercase transition-all"
                        >
                            Se connecter avec Discord
                        </button>
                    </motion.div>
                </main>
            </>
        );
    }

    const handleFileSelect = (type: 'cv') => (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        if (!selectedFile.type.startsWith("image/") && selectedFile.type !== "application/pdf") {
            setError("Seules les images et les fichiers PDF sont acceptés.");
            return;
        }

        if (selectedFile.size > 5 * 1024 * 1024) {
            setError("Le fichier est trop volumineux (max 5MB).");
            return;
        }

        setError(null);

        const reader = new FileReader();
        reader.onloadend = () => {
            setFiles(prev => ({
                ...prev,
                [type]: { file: selectedFile, preview: reader.result as string }
            }));
        };
        reader.readAsDataURL(selectedFile);
    };

    const handleRemoveFile = (type: 'cv') => {
        setFiles(prev => ({
            ...prev,
            [type]: { file: null, preview: null }
        }));
        if (fileInputRefs[type].current) {
            fileInputRefs[type].current.value = "";
        }
    };

    const uploadFile = (applicationId: string, type: string, file: File): Promise<void> => {
        return new Promise((resolve, reject) => {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("applicationId", applicationId);
            formData.append("type", type);

            const xhr = new XMLHttpRequest();

            xhr.upload.addEventListener("progress", (event) => {
                if (event.lengthComputable) {
                    const percent = Math.round((event.loaded / event.total) * 100);
                    setUploadPercent(percent);
                }
            });

            xhr.addEventListener("load", () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve();
                } else {
                    try {
                        const data = JSON.parse(xhr.responseText);
                        reject(new Error(data.error || `Erreur upload ${type}`));
                    } catch {
                        reject(new Error(`Erreur upload ${type}`));
                    }
                }
            });

            xhr.addEventListener("error", () => {
                reject(new Error(`Erreur réseau upload ${type}`));
            });

            xhr.open("POST", "/api/documents");
            xhr.send(formData);
        });
    };

    const validateStep = (step: number): boolean => {
        setError(null);

        if (step === 1) {
            if (!formData.firstName || !formData.lastName || !formData.birthDate || !formData.seniority) {
                setError("Veuillez remplir tous les champs d'identité.");
                return false;
            }
        }

        if (step === 3) {
            if (!formData.motivation || !formData.availability) {
                setError("Veuillez remplir tous les champs de motivation.");
                return false;
            }
        }

        return true;
    };

    const handleNext = () => {
        if (validateStep(currentStep)) {
            setCurrentStep(prev => Math.min(prev + 1, 3));
        }
    };

    const handlePrevious = () => {
        setCurrentStep(prev => Math.max(prev - 1, 1));
    };

    const handleSubmit = async () => {
        if (!validateStep(3)) return;

        // Vérifier que tous les documents obligatoires sont présents
        const missingDocs = documentTypes
            .filter(doc => doc.required && !files[doc.key].file)
            .map(doc => doc.label);

        if (missingDocs.length > 0) {
            setError(`Documents manquants : ${missingDocs.join(', ')}`);
            return;
        }

        setIsSubmitting(true);
        setError(null);
        setUploadProgress(null);

        let applicationId: string | null = null;

        try {
            setUploadProgress("Création de la candidature...");

            const response = await fetch("/api/applications", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    service: normalizedService,
                    ...formData,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.error || "Une erreur est survenue.");
                setIsSubmitting(false);
                setUploadProgress(null);
                return;
            }

            applicationId = data.applicationId;

            const filesToUpload = Object.entries(files).filter(([, f]) => f.file !== null);

            for (let i = 0; i < filesToUpload.length; i++) {
                const [type, fileState] = filesToUpload[i];
                if (fileState.file) {
                    setUploadProgress(`Upload document ${i + 1}/${filesToUpload.length}`);
                    setUploadPercent(0);

                    // Si l'upload échoue, annuler la candidature
                    await uploadFile(applicationId!, type, fileState.file);
                }
            }

            // Rediriger vers la page de succès
            router.push(`/candidature/success?service=${normalizedService}&id=${applicationId}`);

        } catch (uploadError) {
            console.error('Erreur lors de la soumission:', uploadError);

            // Supprimer la candidature si elle a été créée
            if (applicationId) {
                try {
                    await fetch(`/api/applications/${applicationId}`, {
                        method: 'DELETE'
                    });
                } catch (deleteError) {
                    console.error('Erreur suppression candidature:', deleteError);
                }
            }

            setError("Erreur lors de l'envoi des documents. Votre candidature n'a pas été enregistrée. Veuillez réessayer ou contacter les recruteurs si le problème persiste.");
            setIsSubmitting(false);
            setUploadProgress(null);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const documentTypes = [
        { key: 'cv' as const, label: "CV (Curriculum Vitae)", required: true }
    ];

    return (
        <>
            <div className="scan-overlay" />
            <div className="siren-bar">
                <div className="siren-blue" />
                <div className="siren-red" />
            </div>

            {/* Navigation */}
            <nav className="fixed w-full z-40 py-6 px-8 border-b border-white/10 backdrop-blur-sm bg-black/50">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <Link href="/ems" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                        <span className="font-sans text-sm">Retour</span>
                    </Link>
                    <div className={`${themeColor} font-display font-bold tracking-widest text-sm`}>
                        FORMULAIRE {normalizedService}
                    </div>
                </div>
            </nav>

            <main className="min-h-screen bg-[#0a0a0a] text-white pt-32 pb-12 px-4">
                <div className="max-w-3xl mx-auto">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        {/* Header */}
                        <div className="mb-8">
                            <div className="flex items-center gap-3 mb-4">
                                <div className={`px-4 py-1 border ${themeBorder}/50 bg-white/5 rounded`}>
                                    <span className={`${themeColor} text-xs font-bold tracking-widest uppercase`}>
                                        Étape {currentStep} sur 3
                                    </span>
                                </div>
                                {session?.user && (
                                    <span className="text-xs text-gray-500 bg-white/5 px-3 py-1 rounded font-mono">
                                        {session.user.discord_username || session.user.name}
                                    </span>
                                )}
                            </div>
                            <h1 className="font-display text-4xl font-bold uppercase tracking-tighter mb-4">
                                Candidature {normalizedService}
                            </h1>
                        </div>

                        {/* Barre de progression */}
                        <div className="mb-8">
                            <div className="flex items-center justify-between mb-4">
                                {STEPS.map((step, idx) => (
                                    <div key={step.id} className="flex items-center">
                                        <div className={`flex items-center gap-2 ${currentStep >= step.id ? themeColor : 'text-gray-600'
                                            }`}>
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${currentStep > step.id
                                                ? `${themeAccent} border-transparent`
                                                : currentStep === step.id
                                                    ? `${themeBorder} bg-white/5`
                                                    : 'border-gray-700 bg-transparent'
                                                }`}>
                                                {currentStep > step.id ? (
                                                    <CheckCircle className="w-5 h-5 text-white" />
                                                ) : (
                                                    <step.icon className="w-5 h-5" />
                                                )}
                                            </div>
                                            <span className="hidden sm:block font-display text-xs uppercase tracking-widest">
                                                {step.title}
                                            </span>
                                        </div>
                                        {idx < STEPS.length - 1 && (
                                            <div className={`w-12 sm:w-24 h-0.5 mx-2 transition-all ${currentStep > step.id ? themeAccent : 'bg-gray-700'
                                                }`} />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {error && (
                            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 flex items-start gap-3 font-sans">
                                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                <span>{error}</span>
                            </div>
                        )}

                        {/* Contenu des étapes */}
                        <AnimatePresence mode="wait">
                            {/* Étape 1: Identité */}
                            {currentStep === 1 && (
                                <motion.div
                                    key="step1"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="border border-white/10 bg-white/[0.02] p-6 space-y-6"
                                >
                                    <h2 className="font-display text-xl font-bold uppercase flex items-center gap-3">
                                        <div className={`w-1 h-6 ${themeAccent}`} />
                                        Identité & Civil
                                    </h2>

                                    <div className="grid md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-sm text-gray-400 font-sans">Prénom *</label>
                                            <input
                                                type="text"
                                                name="firstName"
                                                required
                                                className="w-full bg-black/50 border border-white/10 p-3 text-white focus:outline-none focus:border-white/30 transition-colors font-sans"
                                                placeholder="John"
                                                value={formData.firstName}
                                                onChange={handleInputChange}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm text-gray-400 font-sans">Nom *</label>
                                            <input
                                                type="text"
                                                name="lastName"
                                                required
                                                className="w-full bg-black/50 border border-white/10 p-3 text-white focus:outline-none focus:border-white/30 transition-colors font-sans"
                                                placeholder="Doe"
                                                value={formData.lastName}
                                                onChange={handleInputChange}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm text-gray-400 font-sans">Date de Naissance *</label>
                                            <input
                                                type="date"
                                                name="birthDate"
                                                required
                                                className="w-full bg-black/50 border border-white/10 p-3 text-white focus:outline-none focus:border-white/30 transition-colors font-sans [color-scheme:dark]"
                                                value={formData.birthDate}
                                                onChange={handleInputChange}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm text-gray-400 font-sans">Ancienneté en ville *</label>
                                            <input
                                                type="text"
                                                name="seniority"
                                                required
                                                className="w-full bg-black/50 border border-white/10 p-3 text-white focus:outline-none focus:border-white/30 transition-colors font-sans"
                                                placeholder="Ex: 2 mois, 3 ans..."
                                                value={formData.seniority}
                                                onChange={handleInputChange}
                                            />
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {/* Étape 2: Documents */}
                            {currentStep === 2 && (
                                <motion.div
                                    key="step2"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="border border-white/10 bg-white/[0.02] p-6 space-y-6"
                                >
                                    <h2 className="font-display text-xl font-bold uppercase flex items-center gap-3">
                                        <div className={`w-1 h-6 ${themeAccent}`} />
                                        Documents Requis
                                    </h2>

                                    <div className="grid gap-4">
                                        {documentTypes.map((doc) => (
                                            <div key={doc.key}>
                                                <input
                                                    ref={fileInputRefs[doc.key]}
                                                    type="file"
                                                    accept="image/*,.pdf,application/pdf"
                                                    onChange={handleFileSelect(doc.key)}
                                                    className="hidden"
                                                    id={`upload-${doc.key}`}
                                                />

                                                {!files[doc.key].file ? (
                                                    <label
                                                        htmlFor={`upload-${doc.key}`}
                                                        className="flex items-center justify-between p-4 border border-white/10 bg-black/30 hover:bg-white/5 transition-colors cursor-pointer group"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <Upload className="w-4 h-4 text-gray-500 group-hover:text-white transition-colors" />
                                                            <span className="font-sans text-gray-300 group-hover:text-white transition-colors">
                                                                {doc.label}
                                                                {!doc.required && <span className="text-gray-600 text-xs ml-2">(optionnel)</span>}
                                                            </span>
                                                        </div>
                                                        <span className="text-xs text-gray-600 uppercase tracking-widest font-display">Choisir</span>
                                                    </label>
                                                ) : (
                                                    <div className="border border-white/10 bg-black/30 p-4">
                                                        <div className="flex items-start gap-4">
                                                            {files[doc.key].file && (
                                                                <div className="relative w-16 h-16 rounded overflow-hidden flex-shrink-0 border border-white/10 flex items-center justify-center bg-white/5">
                                                                    {files[doc.key].file!.type === "application/pdf" ? (
                                                                        <FileText className="w-8 h-8 text-red-400" />
                                                                    ) : (
                                                                        <img
                                                                            src={files[doc.key].preview!}
                                                                            alt="Aperçu"
                                                                            className="w-full h-full object-cover"
                                                                        />
                                                                    )}
                                                                </div>
                                                            )}
                                                            <div className="flex-1 min-w-0">
                                                                <p className="font-sans text-sm text-white truncate">{files[doc.key].file!.name}</p>
                                                                <p className="text-xs text-gray-500">
                                                                    {(files[doc.key].file!.size / 1024).toFixed(1)} KB
                                                                </p>
                                                                <p className="text-xs text-green-400 mt-1 flex items-center gap-1">
                                                                    <CheckCircle className="w-3 h-3" />
                                                                    Prêt
                                                                </p>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveFile(doc.key)}
                                                                className="p-1.5 text-gray-500 hover:text-white transition-colors"
                                                            >
                                                                <X className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-xs text-gray-600 font-mono">
                                        Les documents seront uploadés avec votre candidature.
                                    </p>
                                </motion.div>
                            )}

                            {/* Étape 3: Motivation */}
                            {currentStep === 3 && (
                                <motion.div
                                    key="step3"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="border border-white/10 bg-white/[0.02] p-6 space-y-6"
                                >
                                    <h2 className="font-display text-xl font-bold uppercase flex items-center gap-3">
                                        <div className={`w-1 h-6 ${themeAccent}`} />
                                        Motivations & Disponibilités
                                    </h2>

                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <label className="text-sm text-gray-400 font-sans">Lettre de motivation *</label>
                                            <textarea
                                                name="motivation"
                                                required
                                                rows={6}
                                                className="w-full bg-black/50 border border-white/10 p-3 text-white focus:outline-none focus:border-white/30 transition-colors resize-none font-sans"
                                                placeholder="Pourquoi souhaitez-vous nous rejoindre ?"
                                                value={formData.motivation}
                                                onChange={handleInputChange}
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-sm text-gray-400 font-sans">Disponibilités (3 prochains jours) *</label>
                                            <textarea
                                                name="availability"
                                                required
                                                rows={3}
                                                className="w-full bg-black/50 border border-white/10 p-3 text-white focus:outline-none focus:border-white/30 transition-colors resize-none font-sans"
                                                placeholder="Lundi: 18h-23h, Mardi: ..."
                                                value={formData.availability}
                                                onChange={handleInputChange}
                                            />
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Navigation entre étapes */}
                        <div className="flex justify-between items-center pt-6">
                            {currentStep > 1 ? (
                                <button
                                    onClick={handlePrevious}
                                    className="flex items-center gap-2 px-6 py-3 border border-white/10 text-gray-400 hover:text-white hover:border-white/30 transition-all font-display uppercase tracking-widest"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                    Précédent
                                </button>
                            ) : (
                                <div />
                            )}

                            <div className="flex flex-col items-end gap-2">
                                {uploadProgress && (
                                    <div className="w-48">
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="text-gray-400 font-mono">{uploadProgress}</span>
                                            <span className={themeColor}>{uploadPercent}%</span>
                                        </div>
                                        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${uploadPercent}%` }}
                                                transition={{ duration: 0.2 }}
                                                className={`h-full bg-red-500`}
                                            />
                                        </div>
                                    </div>
                                )}

                                {currentStep < 3 ? (
                                    <button
                                        onClick={handleNext}
                                        className={`${themeBg} text-white px-8 py-3 font-display font-bold tracking-widest uppercase transition-all flex items-center gap-2`}
                                    >
                                        Suivant
                                        <ArrowRight className="w-4 h-4" />
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleSubmit}
                                        disabled={isSubmitting}
                                        className={`${themeBg} text-white px-8 py-3 font-display font-bold tracking-widest uppercase transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed`}
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                                Envoi...
                                            </>
                                        ) : (
                                            <>
                                                Envoyer
                                                <CheckCircle className="w-5 h-5" />
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>

                    </motion.div>
                </div>
            </main>
        </>
    );
}

export default function CandidaturePage() {
    return (
        <Suspense fallback={
            <main className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-white" />
            </main>
        }>
            <CandidatureForm />
        </Suspense>
    );
}
