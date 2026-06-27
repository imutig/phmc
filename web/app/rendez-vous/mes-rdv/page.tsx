"use client";

import { motion } from "framer-motion";
import { ArrowLeft, Loader2, AlertCircle, Calendar, MessageSquare, Clock, CheckCircle2, XCircle, ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession, signIn } from "next-auth/react";

interface AvailabilitySlot {
    date: string
    from: string
    to: string
}

interface Appointment {
    id: string
    status: 'pending' | 'scheduled' | 'completed' | 'cancelled'
    reason_category: string
    reason: string | null
    availability_slots: AvailabilitySlot[]
    scheduled_date: string | null
    scheduled_end_date: string | null
    assigned_to_name: string | null
    created_at: string
}

const STATUS_CONFIG = {
    pending: {
        label: "En attente",
        color: "text-yellow-400",
        bg: "bg-yellow-500/10",
        border: "border-yellow-500/20",
        icon: Clock
    },
    scheduled: {
        label: "Programmé",
        color: "text-blue-400",
        bg: "bg-blue-500/10",
        border: "border-blue-500/20",
        icon: Calendar
    },
    completed: {
        label: "Terminé",
        color: "text-emerald-400",
        bg: "bg-emerald-500/10",
        border: "border-emerald-500/20",
        icon: CheckCircle2
    },
    cancelled: {
        label: "Annulé",
        color: "text-red-400",
        bg: "bg-red-500/10",
        border: "border-red-500/20",
        icon: XCircle
    }
}

function formatDate(dateStr: string): string {
    const d = new Date(dateStr)
    return d.toLocaleString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit"
    }).replace(/—/g, "-").replace(/–/g, "-")
}

export default function MesRendezVousPage() {
    const { data: session, status } = useSession();
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchMyAppointments() {
            if (status !== "authenticated") return;
            try {
                const res = await fetch("/api/appointments");
                if (res.ok) {
                    const data = await res.json();
                    setAppointments(data.appointments || []);
                } else {
                    setError("Erreur lors de la récupération des rendez-vous.");
                }
            } catch (err) {
                console.error("Fetch error:", err);
                setError("Erreur réseau.");
            } finally {
                setIsLoading(false);
            }
        }
        if (status === "authenticated") {
            fetchMyAppointments();
        } else if (status !== "loading") {
            setIsLoading(false);
        }
    }, [status]);

    if (status === "loading" || isLoading) {
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
                            Vous devez être connecté avec Discord pour voir vos rendez-vous.
                        </p>
                        <button
                            onClick={() => signIn("discord", { callbackUrl: "/rendez-vous/mes-rdv" })}
                            className="w-full flex items-center justify-center gap-3 bg-[#5865F2] hover:bg-[#4752C4] text-white py-4 px-6 font-display font-bold tracking-widest uppercase transition-all"
                        >
                            Se connecter avec Discord
                        </button>
                    </motion.div>
                </main>
            </>
        );
    }

    const currentAppointments = appointments.filter(a => a.status === "pending" || a.status === "scheduled");
    const pastAppointments = appointments.filter(a => a.status === "completed" || a.status === "cancelled");

    return (
        <>
            <div className="scan-overlay" />
            <div className="siren-bar">
                <div className="siren-blue" />
                <div className="siren-red" />
            </div>

            <nav className="fixed w-full z-40 py-6 px-8 border-b border-white/10 backdrop-blur-sm bg-black/50">
                <div className="max-w-5xl mx-auto flex justify-between items-center">
                    <Link href="/" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                        <span className="font-sans text-sm">Retour</span>
                    </Link>
                    <div className="text-emerald-400 font-display font-bold tracking-widest text-sm">
                        MES RENDEZ-VOUS
                    </div>
                </div>
            </nav>

            <main className="min-h-screen bg-[#0a0a0a] text-white pt-32 pb-12 px-4">
                <div className="max-w-5xl mx-auto">
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                        
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                            <div>
                                <h1 className="font-display text-4xl font-bold uppercase tracking-tighter mb-2">
                                    Mes Rendez-vous
                                </h1>
                                <p className="text-gray-400 font-sans text-sm">
                                    Suivez vos demandes en cours et consultez votre historique médical.
                                </p>
                            </div>
                            <Link href="/rendez-vous" className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-3 font-display font-bold tracking-widest text-xs uppercase transition-all">
                                <Plus className="w-4 h-4" />
                                Nouveau Rendez-vous
                            </Link>
                        </div>

                        {error && (
                            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 flex items-start gap-3 font-sans">
                                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                <span>{error}</span>
                            </div>
                        )}

                        {appointments.length === 0 ? (
                            <div className="text-center border border-white/10 bg-white/[0.02] p-12">
                                <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                                <h3 className="font-display font-bold text-lg uppercase mb-2">Aucun rendez-vous</h3>
                                <p className="text-gray-400 font-sans text-sm mb-6 max-w-sm mx-auto">
                                    Vous n'avez pas encore demandé de rendez-vous médical auprès du PHMC.
                                </p>
                                <Link
                                    href="/rendez-vous"
                                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 font-display font-bold tracking-widest uppercase text-xs transition-all inline-flex items-center gap-2"
                                >
                                    Prendre un rendez-vous
                                </Link>
                            </div>
                        ) : (
                            <div className="space-y-10">
                                
                                {/* Section: Demandes en cours */}
                                <div>
                                    <h2 className="font-display text-xl font-bold uppercase flex items-center gap-3 mb-4">
                                        <div className="w-1.5 h-6 bg-emerald-500" />
                                        Demandes en cours ({currentAppointments.length})
                                    </h2>
                                    {currentAppointments.length === 0 ? (
                                        <p className="text-gray-500 font-sans text-sm border border-white/5 bg-white/[0.01] p-4">
                                            Aucun rendez-vous en cours de traitement.
                                        </p>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {currentAppointments.map(appt => {
                                                const cfg = STATUS_CONFIG[appt.status]
                                                const Icon = cfg.icon
                                                return (
                                                    <div key={appt.id} className="border border-white/10 bg-white/[0.02] p-5 flex flex-col justify-between hover:border-white/20 transition-all">
                                                        <div>
                                                            <div className="flex items-center justify-between gap-2 mb-3">
                                                                <span className="font-mono text-xs text-gray-500">
                                                                    RDV-{appt.id.slice(0, 8).toUpperCase()}
                                                                </span>
                                                                <div className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-display font-bold uppercase tracking-wider ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
                                                                    <Icon className="w-3 h-3" />
                                                                    {cfg.label}
                                                                </div>
                                                            </div>
                                                            <h3 className="font-display font-bold text-base text-white mb-1">
                                                                {appt.reason_category}
                                                            </h3>
                                                            {appt.reason && (
                                                                <p className="text-xs text-gray-400 font-sans line-clamp-2 mb-4">
                                                                    {appt.reason}
                                                                </p>
                                                            )}
                                                            
                                                            {appt.status === "scheduled" && appt.scheduled_date ? (
                                                                <div className="bg-blue-500/5 border border-blue-500/10 p-3 mb-4 flex items-start gap-2">
                                                                    <Calendar className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                                                                    <div>
                                                                        <p className="text-xs text-blue-400 font-display font-bold uppercase">Créneau programmé</p>
                                                                        <p className="text-xs text-blue-300 font-sans mt-0.5">{formatDate(appt.scheduled_date)}</p>
                                                                        {appt.assigned_to_name && (
                                                                            <p className="text-[10px] text-gray-500 font-sans mt-1">Médecin: {appt.assigned_to_name}</p>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="bg-yellow-500/5 border border-yellow-500/10 p-3 mb-4 flex items-start gap-2">
                                                                    <Clock className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                                                                    <div>
                                                                        <p className="text-xs text-yellow-400 font-display font-bold uppercase">Plages de disponibilités</p>
                                                                        <p className="text-xs text-gray-400 font-sans mt-1">
                                                                            {appt.availability_slots.length} jour(s) proposé(s). En attente de validation.
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>

                                                        <Link
                                                            href={`/rendez-vous/${appt.id}`}
                                                            className="mt-2 w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white py-2.5 text-xs font-display font-bold tracking-wider uppercase transition-all"
                                                        >
                                                            <MessageSquare className="w-4 h-4" />
                                                            Suivre et discuter
                                                            <ChevronRight className="w-3.5 h-3.5" />
                                                        </Link>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* Section: Historique */}
                                <div>
                                    <h2 className="font-display text-xl font-bold uppercase flex items-center gap-3 mb-4">
                                        <div className="w-1.5 h-6 bg-gray-600" />
                                        Historique des rendez-vous ({pastAppointments.length})
                                    </h2>
                                    {pastAppointments.length === 0 ? (
                                        <p className="text-gray-500 font-sans text-sm border border-white/5 bg-white/[0.01] p-4">
                                            Aucun rendez-vous dans l'historique.
                                        </p>
                                    ) : (
                                        <div className="border border-white/10 bg-white/[0.01] divide-y divide-white/5">
                                            {pastAppointments.map(appt => {
                                                const cfg = STATUS_CONFIG[appt.status]
                                                const Icon = cfg.icon
                                                return (
                                                    <div key={appt.id} className="p-4 sm:flex sm:items-center sm:justify-between gap-4 hover:bg-white/[0.01] transition-all">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-3 mb-1.5">
                                                                <span className="font-mono text-[10px] text-gray-600 uppercase">
                                                                    RDV-{appt.id.slice(0, 8).toUpperCase()}
                                                                </span>
                                                                <span className="text-[10px] text-gray-500">
                                                                    Créé le {new Date(appt.created_at).toLocaleDateString("fr-FR")}
                                                                </span>
                                                            </div>
                                                            <h3 className="font-display font-bold text-sm text-white truncate">
                                                                {appt.reason_category}
                                                            </h3>
                                                            {appt.scheduled_date && (
                                                                <p className="text-xs text-gray-500 font-sans mt-0.5">
                                                                    Date effective: {new Date(appt.scheduled_date).toLocaleDateString("fr-FR")}
                                                                </p>
                                                            )}
                                                        </div>
                                                        <div className="mt-3 sm:mt-0 flex items-center gap-3 justify-between sm:justify-end">
                                                            <div className={`flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-display font-bold uppercase tracking-wider ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
                                                                <Icon className="w-3 h-3" />
                                                                {cfg.label}
                                                            </div>
                                                            <Link
                                                                href={`/rendez-vous/${appt.id}`}
                                                                className="text-xs font-display font-bold uppercase tracking-wider text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1"
                                                            >
                                                                Détails
                                                                <ChevronRight className="w-3.5 h-3.5" />
                                                            </Link>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                                
                            </div>
                        )}
                        
                    </motion.div>
                </div>
            </main>
        </>
    );
}
