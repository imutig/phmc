"use client";

import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle, Loader2, AlertCircle, User, Phone, Calendar, Stethoscope, Clock } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useSession, signIn } from "next-auth/react";

interface AvailabilitySlot {
    date: string
    from: string
    to: string
}

const DAYS_AHEAD = 10

function minsToTimeStr(mins: number): string {
    if (mins >= 1440) return "00:00"
    return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`
}

function timeStrToMins(t: string): number {
    if (!t || t === "00:00") return 1440
    const [h, m] = t.split(":").map(Number)
    const total = h * 60 + m
    return total === 0 ? 1440 : total
}

function getNextDays(count: number): Date[] {
    const days: Date[] = []
    const today = new Date()
    for (let i = 1; i <= count; i++) {
        const d = new Date(today)
        d.setDate(today.getDate() + i)
        days.push(d)
    }
    return days
}

function formatDateKey(d: Date): string {
    return d.toISOString().split("T")[0]
}

function formatDayLabel(d: Date): string {
    return d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })
}

interface AvailabilityCalendarProps {
    slots: AvailabilitySlot[]
    onChange: (slots: AvailabilitySlot[]) => void
}

function AvailabilityCalendar({ slots, onChange }: AvailabilityCalendarProps) {
    const days = getNextDays(DAYS_AHEAD)

    const toggleDay = (dateStr: string) => {
        const exists = slots.find(s => s.date === dateStr)
        if (exists) {
            onChange(slots.filter(s => s.date !== dateStr))
        } else {
            onChange([...slots, { date: dateStr, from: "00:01", to: "00:00" }])
        }
    }

    const updateSlot = (dateStr: string, field: "from" | "to", value: string) => {
        onChange(slots.map(s => s.date === dateStr ? { ...s, [field]: value } : s))
    }

    return (
        <div className="space-y-3">
            <div className="grid grid-cols-5 gap-2">
                {days.map(day => {
                    const dateStr = formatDateKey(day)
                    const isSelected = slots.some(s => s.date === dateStr)
                    return (
                        <button
                            key={dateStr}
                            type="button"
                            onClick={() => toggleDay(dateStr)}
                            className={`p-2 text-xs font-display font-bold uppercase tracking-wide border transition-all text-center leading-tight ${
                                isSelected
                                    ? "border-emerald-500 bg-emerald-500/20 text-emerald-300"
                                    : "border-white/10 bg-white/5 text-gray-400 hover:border-white/30 hover:text-white"
                            }`}
                        >
                            {formatDayLabel(day)}
                        </button>
                    )
                })}
            </div>

            {slots
                .sort((a, b) => a.date.localeCompare(b.date))
                .map(slot => {
                    const day = new Date(slot.date + "T12:00:00")
                    const fromMins = slot.from === "00:00" ? 1 : (() => { const [h, m] = slot.from.split(":").map(Number); return h * 60 + m })()
                    const toMins = timeStrToMins(slot.to)
                    return (
                        <div key={slot.date} className="border border-emerald-500/20 bg-emerald-500/5 p-3">
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-xs text-emerald-400 font-display font-bold uppercase tracking-widest">
                                    {day.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
                                </p>
                                <span className="text-xs font-mono text-white bg-emerald-600/30 px-2 py-0.5">
                                    {slot.from} – {slot.to === "00:00" ? "minuit" : slot.to}
                                </span>
                            </div>
                            <div className="space-y-3">
                                <div>
                                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                                        <span>Début</span>
                                        <span className="font-mono text-emerald-300">{slot.from}</span>
                                    </div>
                                    <input
                                        type="range"
                                        min={1}
                                        max={toMins - 15}
                                        step={15}
                                        value={fromMins}
                                        onChange={e => {
                                            const newFromMins = Number(e.target.value)
                                            updateSlot(slot.date, "from", minsToTimeStr(newFromMins))
                                        }}
                                        className="w-full accent-emerald-500 cursor-pointer"
                                    />
                                </div>
                                <div>
                                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                                        <span>Fin</span>
                                        <span className="font-mono text-emerald-300">{slot.to === "00:00" ? "minuit (00h00)" : slot.to}</span>
                                    </div>
                                    <input
                                        type="range"
                                        min={fromMins + 15}
                                        max={1440}
                                        step={15}
                                        value={toMins}
                                        onChange={e => {
                                            const newToMins = Number(e.target.value)
                                            updateSlot(slot.date, "to", minsToTimeStr(newToMins))
                                        }}
                                        className="w-full accent-emerald-500 cursor-pointer"
                                    />
                                </div>
                                <div className="flex justify-between text-[10px] text-gray-700 font-mono">
                                    <span>00h01</span>
                                    <span>12h00</span>
                                    <span>00h00</span>
                                </div>
                            </div>
                        </div>
                    )
                })}

            {slots.length === 0 && (
                <p className="text-xs text-gray-600 text-center py-2">
                    Cliquez sur les jours pour indiquer vos disponibilités
                </p>
            )}
        </div>
    )
}

export default function RendezVousPage() {
    const router = useRouter();
    const { data: session, status } = useSession();

    const [formData, setFormData] = useState({
        firstName: "",
        lastName: "",
        phone: "",
        birthDate: "",
        reasonCategory: "",
        reason: "",
    });

    const [availabilitySlots, setAvailabilitySlots] = useState<AvailabilitySlot[]>([])

    const REASON_CATEGORIES = [
        "Une visite médicale",
        "Un test psychotechnique (PPA)",
        "Un rendez-vous avec un médecin",
        "Un rendez-vous avec la direction",
        "Un suivi psychologique",
        "Un suivi gynécologique/obsétrique",
        "Autre (à préciser)"
    ];

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchPatientData() {
            if (status !== "authenticated") return;
            try {
                const response = await fetch("/api/me/patient");
                if (response.ok) {
                    const data = await response.json();
                    if (data.patient) {
                        setFormData(prev => ({
                            ...prev,
                            firstName: data.patient.first_name || "",
                            lastName: data.patient.last_name || "",
                            phone: data.patient.phone || "",
                            birthDate: data.patient.birth_date || "",
                        }));
                    }
                }
            } catch (err) {
                console.error("Erreur chargement patient:", err);
            } finally {
                setIsLoadingData(false);
            }
        }
        if (status === "authenticated") {
            fetchPatientData();
        } else if (status !== "loading") {
            setIsLoadingData(false);
        }
    }, [status]);

    if (status === "loading" || isLoadingData) {
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
                            Vous devez être connecté avec Discord pour prendre rendez-vous.
                        </p>
                        <button
                            onClick={() => signIn("discord", { callbackUrl: "/rendez-vous" })}
                            className="w-full flex items-center justify-center gap-3 bg-[#5865F2] hover:bg-[#4752C4] text-white py-4 px-6 font-display font-bold tracking-widest uppercase transition-all"
                        >
                            Se connecter avec Discord
                        </button>
                    </motion.div>
                </main>
            </>
        );
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!formData.firstName || !formData.lastName || !formData.phone || !formData.birthDate || !formData.reasonCategory) {
            setError("Veuillez remplir tous les champs obligatoires.");
            return;
        }

        if (formData.reasonCategory === "Autre (à préciser)" && !formData.reason) {
            setError("Veuillez préciser le motif.");
            return;
        }

        if (availabilitySlots.length === 0) {
            setError("Veuillez indiquer au moins une disponibilité.");
            return;
        }

        setIsSubmitting(true);

        try {
            const response = await fetch("/api/appointments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...formData, availabilitySlots }),
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.error || "Une erreur est survenue.");
                setIsSubmitting(false);
                return;
            }

            router.push(`/rendez-vous/success?id=${data.appointmentId}`);
        } catch (err) {
            console.error("Erreur:", err);
            setError("Une erreur est survenue. Veuillez réessayer.");
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <div className="scan-overlay" />
            <div className="siren-bar">
                <div className="siren-blue" />
                <div className="siren-red" />
            </div>

            <nav className="fixed w-full z-40 py-6 px-8 border-b border-white/10 backdrop-blur-sm bg-black/50">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <Link href="/" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                        <span className="font-sans text-sm">Retour</span>
                    </Link>
                    <div className="text-emerald-400 font-display font-bold tracking-widest text-sm">
                        RENDEZ-VOUS MÉDICAL
                    </div>
                </div>
            </nav>

            <main className="min-h-screen bg-[#0a0a0a] text-white pt-32 pb-12 px-4">
                <div className="max-w-2xl mx-auto">
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                        <div className="mb-8">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="px-4 py-1 border border-emerald-500/50 bg-white/5 rounded">
                                    <span className="text-emerald-400 text-xs font-bold tracking-widest uppercase">PHMC</span>
                                </div>
                                {session?.user && (
                                    <span className="text-xs text-gray-500 bg-white/5 px-3 py-1 rounded font-mono">
                                        {session.user.discord_username || session.user.name}
                                    </span>
                                )}
                            </div>
                            <h1 className="font-display text-4xl font-bold uppercase tracking-tighter mb-4">
                                Prendre Rendez-Vous
                            </h1>
                            <p className="text-gray-400 font-sans">
                                Remplissez ce formulaire pour prendre rendez-vous avec notre équipe médicale.
                                Nous vous contacterons via Discord.
                            </p>
                        </div>

                        {error && (
                            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 flex items-start gap-3 font-sans">
                                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                <span>{error}</span>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="border border-white/10 bg-white/[0.02] p-6 space-y-6">

                            <h2 className="font-display text-xl font-bold uppercase flex items-center gap-3">
                                <div className="w-1 h-6 bg-emerald-500" />
                                Informations Patient
                            </h2>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block font-display text-sm font-bold text-gray-400 mb-2 uppercase tracking-widest">Nom</label>
                                    <div className="relative">
                                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                                        <input
                                            type="text"
                                            value={formData.lastName}
                                            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                                            className="w-full bg-white/5 border border-white/10 text-white pl-12 pr-4 py-3 focus:outline-none focus:border-white/30 transition-colors placeholder:text-gray-600"
                                            placeholder="Votre nom"
                                            required
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block font-display text-sm font-bold text-gray-400 mb-2 uppercase tracking-widest">Prénom</label>
                                    <div className="relative">
                                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                                        <input
                                            type="text"
                                            value={formData.firstName}
                                            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                                            className="w-full bg-white/5 border border-white/10 text-white pl-12 pr-4 py-3 focus:outline-none focus:border-white/30 transition-colors placeholder:text-gray-600"
                                            placeholder="Votre prénom"
                                            required
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm text-gray-400 font-sans flex items-center gap-2">
                                    <Phone className="w-4 h-4" />
                                    Numéro de téléphone *
                                </label>
                                <input
                                    type="tel"
                                    name="phone"
                                    required
                                    className="w-full bg-black/50 border border-white/10 p-3 text-white focus:outline-none focus:border-emerald-500/50 transition-colors font-sans"
                                    placeholder="555-0123"
                                    value={formData.phone}
                                    onChange={handleInputChange}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm text-gray-400 font-sans flex items-center gap-2">
                                    <Calendar className="w-4 h-4" />
                                    Date de naissance *
                                </label>
                                <input
                                    type="date"
                                    name="birthDate"
                                    required
                                    className="w-full bg-black/50 border border-white/10 p-3 text-white focus:outline-none focus:border-emerald-500/50 transition-colors font-sans [color-scheme:dark]"
                                    value={formData.birthDate}
                                    onChange={handleInputChange}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm text-gray-400 font-sans flex items-center gap-2">
                                    <Stethoscope className="w-4 h-4" />
                                    Motif du rendez-vous *
                                </label>
                                <select
                                    name="reasonCategory"
                                    required
                                    value={formData.reasonCategory}
                                    onChange={handleInputChange}
                                    className="w-full bg-black/50 border border-white/10 p-3 text-white focus:outline-none focus:border-emerald-500/50 transition-colors font-sans appearance-none"
                                >
                                    <option value="">Sélectionnez un motif...</option>
                                    {REASON_CATEGORIES.map(category => (
                                        <option key={category} value={category}>{category}</option>
                                    ))}
                                </select>
                            </div>

                            {formData.reasonCategory === "Autre (à préciser)" && (
                                <div className="space-y-2">
                                    <label className="text-sm text-gray-400 font-sans">Précisez votre demande *</label>
                                    <textarea
                                        name="reason"
                                        required
                                        rows={3}
                                        className="w-full bg-black/50 border border-white/10 p-3 text-white focus:outline-none focus:border-emerald-500/50 transition-colors resize-none font-sans"
                                        placeholder="Décrivez brièvement la raison de votre visite..."
                                        value={formData.reason}
                                        onChange={handleInputChange}
                                    />
                                </div>
                            )}

                            <div className="border-t border-white/10 pt-6">
                                <h2 className="font-display text-xl font-bold uppercase flex items-center gap-3 mb-4">
                                    <div className="w-1 h-6 bg-emerald-500" />
                                    Vos Disponibilités
                                </h2>
                                <p className="text-sm text-gray-400 font-sans mb-4">
                                    Sélectionnez les jours où vous êtes disponible et indiquez votre plage horaire.
                                    Un médecin choisira un créneau dans votre plage.
                                </p>
                                <div className="flex items-center gap-2 mb-3 text-xs text-gray-500 font-sans">
                                    <Clock className="w-3.5 h-3.5" />
                                    Vous pouvez sélectionner plusieurs jours
                                </div>
                                <AvailabilityCalendar slots={availabilitySlots} onChange={setAvailabilitySlots} />
                            </div>

                            <div className="pt-4 flex justify-end">
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-3 font-display font-bold tracking-widest uppercase transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            Envoi...
                                        </>
                                    ) : (
                                        <>
                                            Prendre Rendez-Vous
                                            <CheckCircle className="w-5 h-5" />
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>

                        <p className="mt-6 text-xs text-gray-600 text-center font-mono">
                            En prenant rendez-vous, vous acceptez d'être contacté via Discord.
                        </p>
                    </motion.div>
                </div>
            </main>
        </>
    );
}
