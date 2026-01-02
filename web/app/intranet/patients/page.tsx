"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, User, Phone, Calendar, ChevronRight, Loader2, UserPlus } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SkeletonPatientCard } from "@/components/ui/Skeleton";

interface Patient {
    id: string;
    first_name: string;
    last_name: string;
    phone: string;
    birth_date: string;
    photo_url: string | null;
    discord_username: string | null;
    created_at: string;
}

export default function PatientsPage() {
    const searchParams = useSearchParams();
    const [patients, setPatients] = useState<Patient[]>([]);
    const [search, setSearch] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [showNewPatientModal, setShowNewPatientModal] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [newPatientData, setNewPatientData] = useState({
        firstName: "",
        lastName: "",
        birthDate: "",
        fingerprint: "",
        phone: ""
    });

    const handleCreatePatient = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsCreating(true);
        try {
            const response = await fetch("/api/patients", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newPatientData),
            });
            const data = await response.json();
            if (response.ok) {
                setShowNewPatientModal(false);
                setNewPatientData({ firstName: "", lastName: "", birthDate: "", fingerprint: "", phone: "" });
                fetchPatients(); // Refresh list
            } else {
                alert(data.error || "Erreur lors de la création");
            }
        } catch (error) {
            console.error("Error creating patient:", error);
            alert("Erreur lors de la création");
        } finally {
            setIsCreating(false);
        }
    };

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search);
        }, 300);
        return () => clearTimeout(timer);
    }, [search]);

    const fetchPatients = useCallback(async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams();
            if (debouncedSearch) params.set("search", debouncedSearch);

            const response = await fetch(`/api/patients?${params}`);
            const data = await response.json();
            setPatients(data.patients || []);
        } catch (error) {
            console.error("Error fetching patients:", error);
        } finally {
            setIsLoading(false);
        }
    }, [debouncedSearch]);

    useEffect(() => {
        fetchPatients();
    }, [fetchPatients]);

    // Ouvrir le modal si action=new
    useEffect(() => {
        if (searchParams.get('action') === 'new') {
            setShowNewPatientModal(true);
        }
    }, [searchParams]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white">Dossiers Patients</h1>
                    <p className="text-gray-400 mt-1">
                        Recherchez et consultez les dossiers médicaux
                    </p>
                </div>
                <button
                    onClick={() => setShowNewPatientModal(true)}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg transition-colors"
                >
                    <UserPlus className="w-4 h-4" />
                    Nouveau Patient
                </button>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                    type="text"
                    placeholder="Rechercher par nom, prénom ou téléphone..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-zinc-900/50 border border-white/10 rounded-lg pl-12 pr-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
                />
            </div>

            {/* Results */}
            {isLoading ? (
                <div className="grid gap-3">
                    {[1, 2, 3, 4, 5].map(i => (
                        <SkeletonPatientCard key={i} />
                    ))}
                </div>
            ) : patients.length === 0 ? (
                <div className="text-center py-12 bg-zinc-900/30 border border-white/5 rounded-lg">
                    <UserPlus className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400">
                        {search ? "Aucun patient trouvé." : "Aucun patient enregistré."}
                    </p>
                    <p className="text-gray-600 text-sm mt-2">
                        Les patients sont créés automatiquement lors d'une prise de rendez-vous.
                    </p>
                </div>
            ) : (
                <div className="grid gap-3">
                    {patients.map((patient, index) => (
                        <motion.div
                            key={patient.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                        >
                            <Link
                                href={`/intranet/patients/${patient.id}`}
                                className="flex items-center gap-4 p-4 bg-zinc-900/50 border border-white/5 rounded-lg hover:border-emerald-500/30 hover:bg-zinc-900/80 transition-all group"
                            >
                                {/* Avatar */}
                                <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                                    {patient.photo_url ? (
                                        <img
                                            src={patient.photo_url}
                                            alt={`${patient.first_name} ${patient.last_name}`}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <User className="w-6 h-6 text-emerald-400" />
                                    )}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold text-white group-hover:text-emerald-400 transition-colors">
                                        {patient.last_name.toUpperCase()} {patient.first_name}
                                    </h3>
                                    <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                                        {patient.phone && (
                                            <span className="flex items-center gap-1">
                                                <Phone className="w-3 h-3" />
                                                {patient.phone}
                                            </span>
                                        )}
                                        {patient.birth_date && (
                                            <span className="flex items-center gap-1">
                                                <Calendar className="w-3 h-3" />
                                                {new Date(patient.birth_date).toLocaleDateString('fr-FR')}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Discord */}
                                {patient.discord_username && (
                                    <span className="text-xs text-gray-600 bg-white/5 px-2 py-1 rounded hidden md:block">
                                        @{patient.discord_username}
                                    </span>
                                )}

                                <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-emerald-400 transition-colors" />
                            </Link>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* New Patient Modal */}
            <AnimatePresence>
                {showNewPatientModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
                        onClick={() => setShowNewPatientModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-zinc-900 border border-white/10 rounded-xl p-6 max-w-md w-full mx-4"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                <UserPlus className="w-5 h-5 text-emerald-400" />
                                Nouveau Patient
                            </h3>
                            <form onSubmit={handleCreatePatient} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">Nom *</label>
                                        <input
                                            type="text"
                                            required
                                            value={newPatientData.lastName}
                                            onChange={(e) => setNewPatientData({ ...newPatientData, lastName: e.target.value })}
                                            className="w-full bg-black/50 border border-white/10 rounded px-3 py-2 text-white focus:outline-none focus:border-emerald-500/50"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">Prénom *</label>
                                        <input
                                            type="text"
                                            required
                                            value={newPatientData.firstName}
                                            onChange={(e) => setNewPatientData({ ...newPatientData, firstName: e.target.value })}
                                            className="w-full bg-black/50 border border-white/10 rounded px-3 py-2 text-white focus:outline-none focus:border-emerald-500/50"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Empreinte (ID In-Game) *</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-mono">#</span>
                                        <input
                                            type="text"
                                            required
                                            placeholder="123456"
                                            value={newPatientData.fingerprint}
                                            onChange={(e) => {
                                                const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                                                setNewPatientData({ ...newPatientData, fingerprint: val });
                                            }}
                                            className="w-full bg-black/50 border border-white/10 rounded pl-8 pr-3 py-2 text-white focus:outline-none focus:border-emerald-500/50 font-mono tracking-widest"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Date de naissance *</label>
                                    <input
                                        type="date"
                                        required
                                        value={newPatientData.birthDate}
                                        onChange={(e) => setNewPatientData({ ...newPatientData, birthDate: e.target.value })}
                                        className="w-full bg-black/50 border border-white/10 rounded px-3 py-2 text-white focus:outline-none focus:border-emerald-500/50"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Téléphone</label>
                                    <input
                                        type="tel"
                                        value={newPatientData.phone}
                                        onChange={(e) => setNewPatientData({ ...newPatientData, phone: e.target.value })}
                                        className="w-full bg-black/50 border border-white/10 rounded px-3 py-2 text-white focus:outline-none focus:border-emerald-500/50"
                                    />
                                </div>
                                <div className="flex gap-3 mt-6">
                                    <button
                                        type="button"
                                        onClick={() => setShowNewPatientModal(false)}
                                        className="flex-1 py-2 px-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
                                    >
                                        Annuler
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isCreating}
                                        className="flex-1 py-2 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors disabled:opacity-50"
                                    >
                                        {isCreating ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Créer"}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
