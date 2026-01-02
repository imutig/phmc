"use client";

import { motion } from "framer-motion";
import { CheckCircle, ArrowLeft, MessageCircle } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

function SuccessContent() {
    const searchParams = useSearchParams();
    const id = searchParams.get("id");

    return (
        <>
            <div className="scan-overlay" />
            <div className="siren-bar">
                <div className="siren-blue" />
                <div className="siren-red" />
            </div>

            <main className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="max-w-lg w-full text-center"
                >
                    <div className="border border-white/10 bg-white/[0.02] p-8">
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                            className="w-20 h-20 mx-auto mb-6 bg-emerald-500/20 rounded-full flex items-center justify-center"
                        >
                            <CheckCircle className="w-10 h-10 text-emerald-400" />
                        </motion.div>

                        <h1 className="font-display text-3xl font-bold uppercase tracking-tighter mb-4">
                            Rendez-Vous Confirmé
                        </h1>

                        <p className="text-gray-400 font-sans mb-6">
                            Votre demande de rendez-vous a été enregistrée avec succès.
                            Notre équipe médicale vous contactera très prochainement via Discord.
                        </p>

                        <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 mb-6">
                            <div className="flex items-center justify-center gap-2 text-emerald-400 font-display text-sm uppercase tracking-widest">
                                <MessageCircle className="w-4 h-4" />
                                Communication via Discord
                            </div>
                            <p className="text-xs text-gray-500 mt-2 font-mono">
                                Consultez vos messages privés Discord pour suivre votre rendez-vous.
                            </p>
                        </div>

                        {id && (
                            <p className="text-xs text-gray-600 font-mono mb-6">
                                Référence: {id.slice(0, 8).toUpperCase()}
                            </p>
                        )}

                        <Link
                            href="/"
                            className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors font-display text-sm uppercase tracking-widest"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Retour à l'accueil
                        </Link>
                    </div>
                </motion.div>
            </main>
        </>
    );
}

export default function RendezVousSuccessPage() {
    return (
        <Suspense fallback={
            <main className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            </main>
        }>
            <SuccessContent />
        </Suspense>
    );
}
