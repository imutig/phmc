"use client";

import { motion } from "framer-motion";
import { ArrowLeft, Clock, CheckCircle, XCircle, Calendar, Loader2, AlertCircle, RefreshCw, Shield, Trash2 } from "lucide-react";
import Link from "next/link";
import { useSession, signIn } from "next-auth/react";
import { useEffect, useState } from "react";
import type { Application, ApplicationStatus } from "@/lib/types/database";
import { STATUS_LABELS, STATUS_COLORS } from "@/lib/types/database";

const STATUS_ICONS: Record<ApplicationStatus, React.ReactNode> = {
    pending: <Clock className="w-4 h-4" />,
    reviewing: <RefreshCw className="w-4 h-4" />,
    interview_scheduled: <Calendar className="w-4 h-4" />,
    interview_passed: <CheckCircle className="w-4 h-4" />,
    interview_failed: <XCircle className="w-4 h-4" />,
    training: <Clock className="w-4 h-4" />,
    recruited: <CheckCircle className="w-4 h-4" />,
    rejected: <XCircle className="w-4 h-4" />,
};

// Statuts où le retrait est possible
const CAN_WITHDRAW_STATUSES: ApplicationStatus[] = ['pending', 'reviewing', 'interview_scheduled'];

export default function SuiviPage() {
    const { data: session, status } = useSession();
    const [applications, setApplications] = useState<Application[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [withdrawingId, setWithdrawingId] = useState<string | null>(null);
    const [showConfirmModal, setShowConfirmModal] = useState<string | null>(null);

    useEffect(() => {
        if (status === "authenticated") {
            fetchApplications();
        } else if (status === "unauthenticated") {
            setLoading(false);
        }
    }, [status]);

    const fetchApplications = async () => {
        try {
            const response = await fetch("/api/applications");
            const data = await response.json();

            if (!response.ok) {
                setError(data.error || "Erreur lors de la récupération.");
                return;
            }

            setApplications(data.applications);
        } catch {
            setError("Erreur de connexion au serveur.");
        } finally {
            setLoading(false);
        }
    };

    const handleWithdraw = async (applicationId: string) => {
        setWithdrawingId(applicationId);
        setShowConfirmModal(null);
        setError(null);

        try {
            const response = await fetch(`/api/applications/${applicationId}`, {
                method: "DELETE",
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.error || "Erreur lors du retrait.");
                setWithdrawingId(null);
                return;
            }

            // Retirer la candidature de la liste
            setApplications(prev => prev.filter(app => app.id !== applicationId));
            setWithdrawingId(null);

        } catch {
            setError("Erreur de connexion au serveur.");
            setWithdrawingId(null);
        }
    };

    if (status === "loading" || loading) {
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
                            Connectez-vous pour voir vos candidatures.
                        </p>
                        <button
                            onClick={() => signIn("discord", { callbackUrl: "/suivi" })}
                            className="w-full flex items-center justify-center gap-3 bg-[#5865F2] hover:bg-[#4752C4] text-white py-4 px-6 font-display font-bold tracking-widest uppercase transition-all"
                        >
                            Se connecter avec Discord
                        </button>
                    </motion.div>
                </main>
            </>
        );
    }

    return (
        <>
            <div className="scan-overlay" />
            <div className="siren-bar">
                <div className="siren-blue" />
                <div className="siren-red" />
            </div>

            {/* Modal de confirmation */}
            {showConfirmModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="max-w-md w-full p-6 border border-red-500/30 bg-[#0a0a0a]"
                    >
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-red-500/20 rounded">
                                <Trash2 className="w-6 h-6 text-red-400" />
                            </div>
                            <h3 className="font-display text-xl font-bold uppercase">Retirer la candidature ?</h3>
                        </div>
                        <p className="font-sans text-gray-400 mb-6">
                            Cette action est irréversible. Votre candidature et tous les documents associés seront supprimés définitivement.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowConfirmModal(null)}
                                className="flex-1 px-4 py-3 border border-white/10 text-gray-400 hover:text-white hover:border-white/30 transition-colors font-display uppercase tracking-widest"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={() => handleWithdraw(showConfirmModal)}
                                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-500 text-white font-display uppercase tracking-widest transition-colors"
                            >
                                Confirmer
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}

            {/* Navigation */}
            <nav className="fixed w-full z-40 py-6 px-8 border-b border-white/10 backdrop-blur-sm bg-black/50">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <Link href="/" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                        <span className="font-sans text-sm">Retour</span>
                    </Link>
                    <div className="text-blue-400 font-display font-bold tracking-widest text-sm">SUIVI CANDIDATURE</div>
                </div>
            </nav>

            <main className="min-h-screen bg-[#0a0a0a] text-white pt-32 pb-12 px-4">
                <div className="max-w-4xl mx-auto">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h1 className="font-display text-3xl font-bold uppercase tracking-tighter mb-2">Suivi de candidature</h1>
                                <p className="font-sans text-gray-400">
                                    Consultez l'état de vos candidatures en cours.
                                </p>
                            </div>
                            {session?.user && (
                                <div className="flex items-center gap-3 bg-white/5 px-4 py-2 border border-white/10">
                                    <span className="text-sm text-gray-400 font-mono">
                                        {session.user.discord_username || session.user.name}
                                    </span>
                                </div>
                            )}
                        </div>

                        {error && (
                            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 flex items-start gap-3 font-sans">
                                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                <span>{error}</span>
                            </div>
                        )}

                        {applications.length === 0 ? (
                            <div className="text-center py-16 border border-white/10 bg-white/[0.02]">
                                <Shield className="w-16 h-16 mx-auto opacity-20 mb-4" />
                                <h3 className="font-display text-xl font-bold uppercase mb-2">Aucune candidature</h3>
                                <p className="font-sans text-gray-500 mb-8">
                                    Vous n'avez pas encore déposé de candidature.
                                </p>
                                <div className="flex justify-center gap-4">
                                    <Link href="/ems">
                                        <button className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 font-display font-bold tracking-widest uppercase transition-all">
                                            Postuler EMS
                                        </button>
                                    </Link>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {applications.map((app, idx) => {
                                    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        const x = e.clientX - rect.left;
                                        const y = e.clientY - rect.top;
                                        e.currentTarget.style.setProperty('--glow-x', `${x}px`);
                                        e.currentTarget.style.setProperty('--glow-y', `${y}px`);
                                    };

                                    return (
                                        <motion.div
                                            key={app.id}
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: idx * 0.1 }}
                                            onMouseMove={handleMouseMove}
                                            onMouseEnter={(e) => e.currentTarget.style.setProperty('--glow-opacity', '1')}
                                            onMouseLeave={(e) => e.currentTarget.style.setProperty('--glow-opacity', '0')}
                                            className="p-6 border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] transition-colors rounded-2xl glow-border"
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <span className="px-3 py-1 text-xs font-display font-bold uppercase tracking-widest bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">
                                                            {app.service}
                                                        </span>
                                                        <span className={`px-3 py-1 text-xs font-sans flex items-center gap-1.5 ${STATUS_COLORS[app.status]}`}>
                                                            {STATUS_ICONS[app.status]}
                                                            {STATUS_LABELS[app.status]}
                                                        </span>
                                                    </div>

                                                    <h3 className="font-display text-lg font-bold uppercase mb-1">
                                                        {app.first_name} {app.last_name}
                                                    </h3>

                                                    <p className="text-sm text-gray-500 font-mono">
                                                        Déposée le {new Date(app.created_at).toLocaleDateString('fr-FR', {
                                                            day: 'numeric',
                                                            month: 'long',
                                                            year: 'numeric',
                                                            hour: '2-digit',
                                                            minute: '2-digit'
                                                        })}
                                                    </p>

                                                    {app.interview_date && (
                                                        <p className="text-sm text-purple-400 mt-2 flex items-center gap-2 font-sans">
                                                            <Calendar className="w-4 h-4" />
                                                            Entretien prévu le {new Date(app.interview_date).toLocaleDateString('fr-FR', {
                                                                day: 'numeric',
                                                                month: 'long',
                                                                hour: '2-digit',
                                                                minute: '2-digit'
                                                            })}
                                                        </p>
                                                    )}
                                                </div>

                                                {/* Bouton retirer */}
                                                {CAN_WITHDRAW_STATUSES.includes(app.status) && (
                                                    <button
                                                        onClick={() => setShowConfirmModal(app.id)}
                                                        disabled={withdrawingId === app.id}
                                                        className="flex items-center gap-2 px-4 py-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/30 transition-colors disabled:opacity-50"
                                                    >
                                                        {withdrawingId === app.id ? (
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                        ) : (
                                                            <Trash2 className="w-4 h-4" />
                                                        )}
                                                        <span className="font-display text-xs uppercase tracking-widest">
                                                            {withdrawingId === app.id ? "..." : "Retirer"}
                                                        </span>
                                                    </button>
                                                )}
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        )}
                    </motion.div>
                </div>
            </main>
        </>
    );
}
