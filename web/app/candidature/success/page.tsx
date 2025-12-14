"use client";

import { motion } from "framer-motion";
import { CheckCircle, Clock, MessageSquare, ArrowRight, Home, FileText, HeartPulse } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function SuccessContent() {
    const searchParams = useSearchParams();
    const applicationId = searchParams.get("id") || "";

    // Thème EMS
    const themeColor = "text-emerald-400";
    const themeBg = "bg-emerald-600";
    const themeBorder = "border-emerald-500";

    const steps = [
        {
            icon: <Clock className="w-5 h-5" />,
            title: "Examen du dossier",
            description: "Nos recruteurs vont examiner votre candidature dans les plus brefs délais."
        },
        {
            icon: <MessageSquare className="w-5 h-5" />,
            title: "Contact Discord",
            description: "Vous recevrez un message privé Discord pour toute communication."
        },
        {
            icon: <FileText className="w-5 h-5" />,
            title: "Entretien",
            description: "Si votre profil correspond, vous serez convoqué pour un entretien."
        }
    ];

    return (
        <>
            <main className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="max-w-2xl w-full"
                >
                    {/* Header Success */}
                    <div className="text-center mb-8">
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                            className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-500/20 border border-emerald-500/30 mb-6"
                        >
                            <CheckCircle className="w-10 h-10 text-emerald-400" />
                        </motion.div>

                        <motion.h1
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.3 }}
                            className="font-display text-4xl font-bold uppercase tracking-tighter mb-3"
                        >
                            Candidature Envoyée !
                        </motion.h1>

                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.4 }}
                            className="font-sans text-gray-400 max-w-md mx-auto"
                        >
                            Votre candidature pour le <span className={themeColor + " font-bold"}>Pillbox Hill Medical Center</span> a été enregistrée avec succès.
                        </motion.p>
                    </div>

                    {/* Référence */}
                    {applicationId && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 }}
                            className={`text-center mb-8 p-4 border ${themeBorder}/30 bg-white/[0.02]`}
                        >
                            <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Référence</p>
                            <p className="font-mono text-lg">{applicationId.substring(0, 8).toUpperCase()}</p>
                        </motion.div>
                    )}

                    {/* Prochaines étapes */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.6 }}
                        className="border border-white/10 bg-white/[0.02] p-6 mb-8"
                    >
                        <h2 className="font-display text-lg font-bold uppercase mb-6 flex items-center gap-3">
                            <div className={`w-1 h-5 ${themeBg}`} />
                            Prochaines Étapes
                        </h2>

                        <div className="space-y-4">
                            {steps.map((step, idx) => (
                                <motion.div
                                    key={idx}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.7 + idx * 0.1 }}
                                    className="flex items-start gap-4"
                                >
                                    <div className={`p-2 ${themeBg}/20 border ${themeBorder}/30 rounded`}>
                                        <span className={themeColor}>{step.icon}</span>
                                    </div>
                                    <div>
                                        <h3 className="font-display font-bold uppercase text-sm mb-1">{step.title}</h3>
                                        <p className="font-sans text-gray-500 text-sm">{step.description}</p>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>

                    {/* Info DM */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1 }}
                        className="bg-emerald-500/10 border border-emerald-500/20 p-4 mb-8"
                    >
                        <p className="font-sans text-sm text-emerald-300">
                            💬 <strong>Astuce :</strong> Vous avez reçu un message privé Discord. Vous pouvez y répondre directement pour communiquer avec les recruteurs.
                        </p>
                    </motion.div>

                    {/* Actions */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1.1 }}
                        className="flex flex-col sm:flex-row gap-4"
                    >
                        <Link href="/suivi" className="flex-1">
                            <button className={`w-full ${themeBg} text-white px-6 py-4 font-display font-bold tracking-widest uppercase transition-all flex items-center justify-center gap-2 hover:opacity-90`}>
                                Suivre ma candidature
                                <ArrowRight className="w-5 h-5" />
                            </button>
                        </Link>
                        <Link href="/" className="flex-1">
                            <button className="w-full border border-white/10 bg-white/[0.02] text-white px-6 py-4 font-display font-bold tracking-widest uppercase transition-all flex items-center justify-center gap-2 hover:bg-white/5">
                                <Home className="w-5 h-5" />
                                Retour à l'accueil
                            </button>
                        </Link>
                    </motion.div>
                </motion.div>
            </main>
        </>
    );
}

export default function SuccessPage() {
    return (
        <Suspense fallback={
            <main className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
            </main>
        }>
            <SuccessContent />
        </Suspense>
    );
}
