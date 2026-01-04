"use client";

import { useState, useEffect, use, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    ArrowLeft, User, Phone, Calendar, MapPin, Heart, AlertTriangle,
    FileText, Save, Loader2, Upload, X, History, MessageSquare, Send,
    CheckCircle, XCircle, Clock, Shield, Stethoscope, Plus, Eye, Download
} from "lucide-react";
import Link from "next/link";
import { BouncingLoader, MiniLoader } from "@/components/ui/BouncingLoader";
import { useSession } from "next-auth/react";
import { createClient } from "@supabase/supabase-js";
import { USIGenerator } from "@/components/intranet/USIGenerator";
import { ClipboardList } from "lucide-react";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

interface Patient {
    id: string;
    first_name: string;
    last_name: string;
    phone: string;
    birth_date: string;
    discord_id: string;
    discord_username: string;
    photo_url: string | null;
    address: string | null;
    blood_type: string | null;
    allergies: string | null;
    medical_history: string | null;
    emergency_contact: string | null;
    emergency_phone: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
    fingerprint: string | null;
}

interface Appointment {
    id: string;
    status: 'pending' | 'scheduled' | 'completed' | 'cancelled';
    reason_category: string | null;
    reason: string | null;
    created_at: string;
    scheduled_date: string | null;
    discord_channel_id: string | null;
    assigned_to: string | null;
    assigned_to_name: string | null;
    completed_at: string | null;
    completed_by: string | null;
    cancel_reason: string | null;
}

interface Message {
    id: string;
    sender_name: string;
    content: string;
    is_from_staff: boolean;
    created_at: string;
}

interface MedicalExam {
    id: string;
    patient_id: string;
    created_by: string;
    created_by_name: string | null;
    created_at: string;
    updated_at: string;
    status: 'draft' | 'completed';
    visit_date: string | null;
    visit_type: string | null;
    no_contraindication: boolean;
}

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function PatientDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const { data: session } = useSession();
    const [patient, setPatient] = useState<Patient | null>(null);
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'medical' | 'appointments' | 'exams' | 'usi'>('medical');
    const [medicalExams, setMedicalExams] = useState<MedicalExam[]>([]);
    const [isLoadingExams, setIsLoadingExams] = useState(false);

    // Appointment Chat State
    const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [isSending, setIsSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

    // Modal states
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [scheduleDate, setScheduleDate] = useState("");
    const [scheduleTime, setScheduleTime] = useState("");
    const [cancelReason, setCancelReason] = useState("");

    // Form state for editable fields
    const [formData, setFormData] = useState({
        photo_url: "",
        address: "",
        blood_type: "",
        allergies: "",
        medical_history: "",
        emergency_contact: "",
        emergency_phone: "",
        notes: "",
        fingerprint: ""
    });

    const fetchPatient = async () => {
        try {
            const response = await fetch(`/api/patients/${resolvedParams.id}`);
            const data = await response.json();

            if (!response.ok) {
                setError(data.error || "Patient non trouvé");
                return;
            }

            setPatient(data.patient);
            setAppointments(data.appointments || []);
            setFormData({
                photo_url: data.patient.photo_url || "",
                address: data.patient.address || "",
                blood_type: data.patient.blood_type || "",
                allergies: data.patient.allergies || "",
                medical_history: data.patient.medical_history || "",
                emergency_contact: data.patient.emergency_contact || "",
                emergency_phone: data.patient.emergency_phone || "",
                notes: data.patient.notes || "",
                fingerprint: data.patient.fingerprint || ""
            });
        } catch (err) {
            console.error("Error:", err);
            setError("Erreur de chargement");
        } finally {
            setIsLoading(false);
        }
    };

    const fetchMedicalExams = async () => {
        setIsLoadingExams(true);
        try {
            const response = await fetch(`/api/patients/${resolvedParams.id}/medical-exams`);
            if (response.ok) {
                const data = await response.json();
                setMedicalExams(data);
            }
        } catch (error) {
            console.error("Error fetching medical exams:", error);
        } finally {
            setIsLoadingExams(false);
        }
    };

    useEffect(() => {
        fetchPatient();
        fetchMedicalExams();
    }, [resolvedParams.id]);

    // Fetch messages when an appointment is selected
    useEffect(() => {
        if (!selectedAppointmentId) return;

        const fetchMessages = async () => {
            try {
                const response = await fetch(`/api/appointments/${selectedAppointmentId}`);
                const data = await response.json();
                if (response.ok) {
                    setMessages(data.messages || []);
                }
            } catch (error) {
                console.error("Error fetching messages:", error);
            }
        };

        fetchMessages();

        // Realtime subscription pour les messages
        const channel = supabaseClient
            .channel(`appointment-messages-${selectedAppointmentId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'appointment_messages',
                    filter: `appointment_id=eq.${selectedAppointmentId}`
                },
                () => {
                    // Refetch messages on any change
                    fetchMessages();
                }
            )
            .subscribe();

        return () => {
            supabaseClient.removeChannel(channel);
        };
    }, [selectedAppointmentId]);

    // Scroll to bottom of chat
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        setError(null);
        setSuccess(null);

        try {
            const response = await fetch(`/api/patients/${resolvedParams.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.error || "Erreur lors de la sauvegarde");
                return;
            }

            setPatient(data.patient);
            setSuccess("Modifications enregistrées");
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            console.error("Error:", err);
            setError("Erreur de sauvegarde");
        } finally {
            setIsSaving(false);
        }
    };

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            setError("Seules les images sont acceptées");
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            setError("Image trop volumineuse (max 5MB)");
            return;
        }

        setIsUploading(true);
        setError(null);

        try {
            const formDataUpload = new FormData();
            formDataUpload.append("image", file);

            const response = await fetch(
                `https://api.imgbb.com/1/upload?key=${process.env.NEXT_PUBLIC_IMGBB_API_KEY}`,
                {
                    method: "POST",
                    body: formDataUpload
                }
            );

            const data = await response.json();

            if (data.success) {
                setFormData(prev => ({ ...prev, photo_url: data.data.url }));
            } else {
                setError("Erreur lors de l'upload");
            }
        } catch (err) {
            console.error("Upload error:", err);
            setError("Erreur lors de l'upload");
        } finally {
            setIsUploading(false);
        }
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !selectedAppointmentId || isSending) return;

        setIsSending(true);
        try {
            const response = await fetch(`/api/appointments/${selectedAppointmentId}/message`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: newMessage.trim() })
            });

            if (response.ok) {
                setNewMessage("");
                // Refresh messages immediately
                const msgResponse = await fetch(`/api/appointments/${selectedAppointmentId}`);
                const data = await msgResponse.json();
                if (msgResponse.ok) {
                    setMessages(data.messages || []);
                }
            }
        } catch (error) {
            console.error("Error sending message:", error);
        } finally {
            setIsSending(false);
        }
    };

    const handleScheduleAppointment = async () => {
        if (!selectedAppointmentId || !scheduleDate || !scheduleTime || isUpdatingStatus) return;
        setIsUpdatingStatus(true);
        try {
            // Créer la date en heure locale puis convertir en ISO (UTC)
            const [year, month, day] = scheduleDate.split('-').map(Number);
            const [hour, minute] = scheduleTime.split(':').map(Number);
            const localDate = new Date(year, month - 1, day, hour, minute, 0);
            const scheduledDateTime = localDate.toISOString();

            const response = await fetch(`/api/appointments/${selectedAppointmentId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    status: 'scheduled',
                    scheduled_date: scheduledDateTime
                })
            });

            if (response.ok) {
                setShowScheduleModal(false);
                setScheduleDate("");
                setScheduleTime("");
                fetchPatient();
            }
        } catch (error) {
            console.error("Error scheduling appointment:", error);
        } finally {
            setIsUpdatingStatus(false);
        }
    };

    const handleCompleteAppointment = async () => {
        if (!selectedAppointmentId || isUpdatingStatus) return;
        setIsUpdatingStatus(true);
        try {
            const response = await fetch(`/api/appointments/${selectedAppointmentId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: 'completed' })
            });

            if (response.ok) {
                fetchPatient();
            }
        } catch (error) {
            console.error("Error completing appointment:", error);
        } finally {
            setIsUpdatingStatus(false);
        }
    };

    const handleCancelAppointment = async () => {
        if (!selectedAppointmentId || isUpdatingStatus) return;
        setIsUpdatingStatus(true);
        try {
            const response = await fetch(`/api/appointments/${selectedAppointmentId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    status: 'cancelled',
                    cancel_reason: cancelReason || null
                })
            });

            if (response.ok) {
                setShowCancelModal(false);
                setCancelReason("");
                fetchPatient();
            }
        } catch (error) {
            console.error("Error cancelling appointment:", error);
        } finally {
            setIsUpdatingStatus(false);
        }
    };

    // Calculate countdown for scheduled appointments
    const getCountdown = (scheduledDate: string) => {
        const now = new Date();
        const scheduled = new Date(scheduledDate);
        const diff = scheduled.getTime() - now.getTime();

        if (diff < 0) return "Passé";

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        if (days > 0) return `Dans ${days}j ${hours}h`;
        if (hours > 0) return `Dans ${hours}h ${minutes}min`;
        return `Dans ${minutes}min`;
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-24">
                <BouncingLoader size="md" color="red" />
            </div>
        );
    }

    if (error && !patient) {
        return (
            <div className="text-center py-24">
                <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                <p className="text-red-400">{error}</p>
                <Link href="/intranet/patients" className="text-gray-400 hover:text-white mt-4 inline-block">
                    ← Retour aux patients
                </Link>
            </div>
        );
    }

    if (!patient) return null;

    const statusColors: Record<string, string> = {
        pending: "bg-yellow-500/20 text-yellow-400",
        scheduled: "bg-blue-500/20 text-blue-400",
        completed: "bg-green-500/20 text-green-400",
        cancelled: "bg-red-500/20 text-red-400"
    };

    const statusLabels: Record<string, string> = {
        pending: "En attente",
        scheduled: "Programmé",
        completed: "Terminé",
        cancelled: "Annulé"
    };

    const selectedAppointment = appointments.find(a => a.id === selectedAppointmentId);

    return (
        <>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <Link
                        href="/intranet/patients"
                        className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-gray-400" />
                    </Link>
                    <div className="flex-1">
                        <h1 className="text-2xl font-bold text-white">
                            {patient.last_name.toUpperCase()} {patient.first_name}
                        </h1>
                        <p className="text-gray-500 text-sm">
                            Dossier créé le {new Date(patient.created_at).toLocaleDateString('fr-FR')}
                        </p>
                    </div>
                    {activeTab === 'medical' && (
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                        >
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Enregistrer
                        </button>
                    )}
                </div>

                {/* Tabs */}
                <div className="flex border-b border-white/10">
                    <button
                        onClick={() => setActiveTab('medical')}
                        className={`px-6 py-3 text-sm font-medium transition-colors relative ${activeTab === 'medical' ? 'text-white' : 'text-gray-400 hover:text-white'}`}
                    >
                        <div className="flex items-center gap-2">
                            <User className="w-4 h-4" />
                            Dossier Médical
                        </div>
                        {activeTab === 'medical' && (
                            <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500" />
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('appointments')}
                        className={`px-6 py-3 text-sm font-medium transition-colors relative ${activeTab === 'appointments' ? 'text-white' : 'text-gray-400 hover:text-white'}`}
                    >
                        <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            Rendez-vous
                        </div>
                        {activeTab === 'appointments' && (
                            <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500" />
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('exams')}
                        className={`px-6 py-3 text-sm font-medium transition-colors relative ${activeTab === 'exams' ? 'text-white' : 'text-gray-400 hover:text-white'}`}
                    >
                        <div className="flex items-center gap-2">
                            <Stethoscope className="w-4 h-4" />
                            Visites médicales
                        </div>
                        {activeTab === 'exams' && (
                            <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500" />
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('usi')}
                        className={`px-6 py-3 text-sm font-medium transition-colors relative ${activeTab === 'usi' ? 'text-white' : 'text-gray-400 hover:text-white'}`}
                    >
                        <div className="flex items-center gap-2">
                            <ClipboardList className="w-4 h-4" />
                            USI
                        </div>
                        {activeTab === 'usi' && (
                            <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500" />
                        )}
                    </button>
                </div>

                {/* Alerts */}
                {error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm">
                        {error}
                    </div>
                )}
                {success && (
                    <div className="p-3 bg-green-500/10 border border-green-500/20 text-green-400 rounded-lg text-sm">
                        {success}
                    </div>
                )}

                <AnimatePresence mode="wait">
                    {activeTab === 'medical' ? (
                        <motion.div
                            key="medical"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="grid lg:grid-cols-3 gap-6"
                        >
                            {/* ... (Contenu existant du dossier médical) ... */}
                            {/* Main Info */}
                            <div className="lg:col-span-2 space-y-6">
                                {/* Photo & Basic Info */}
                                <div className="bg-zinc-900/50 border border-white/5 rounded-lg p-6">
                                    <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                        <User className="w-5 h-5 text-emerald-400" />
                                        Informations Patient
                                    </h2>

                                    <div className="flex flex-col md:flex-row gap-6">
                                        {/* Photo */}
                                        <div className="flex-shrink-0">
                                            <div className="w-32 h-32 rounded-lg bg-zinc-800 border border-white/10 overflow-hidden relative group">
                                                {formData.photo_url ? (
                                                    <>
                                                        <img
                                                            src={formData.photo_url}
                                                            alt="Photo patient"
                                                            loading="lazy"
                                                            className="w-full h-full object-cover"
                                                        />
                                                        <button
                                                            onClick={() => setFormData(prev => ({ ...prev, photo_url: "" }))}
                                                            className="absolute top-1 right-1 p-1 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                                        >
                                                            <X className="w-4 h-4 text-white" />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer hover:bg-zinc-700 transition-colors">
                                                        {isUploading ? (
                                                            <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
                                                        ) : (
                                                            <>
                                                                <Upload className="w-6 h-6 text-gray-500 mb-2" />
                                                                <span className="text-xs text-gray-500">Ajouter photo</span>
                                                            </>
                                                        )}
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            onChange={handlePhotoUpload}
                                                            className="hidden"
                                                        />
                                                    </label>
                                                )}
                                            </div>
                                        </div>

                                        {/* Basic Info (Read-only) */}
                                        <div className="flex-1 grid sm:grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-xs text-gray-500 uppercase tracking-wider">Nom</label>
                                                <p className="text-white font-medium">{patient.last_name}</p>
                                            </div>
                                            <div>
                                                <label className="text-xs text-gray-500 uppercase tracking-wider">Prénom</label>
                                                <p className="text-white font-medium">{patient.first_name}</p>
                                            </div>
                                            <div>
                                                <label className="text-xs text-gray-500 uppercase tracking-wider flex items-center gap-1">
                                                    <Phone className="w-3 h-3" /> Téléphone
                                                </label>
                                                <p className="text-white">{patient.phone || "-"}</p>
                                            </div>
                                            <div>
                                                <label className="text-xs text-gray-500 uppercase tracking-wider flex items-center gap-1">
                                                    <Calendar className="w-3 h-3" /> Date de naissance
                                                </label>
                                                <p className="text-white">
                                                    {patient.birth_date ? new Date(patient.birth_date).toLocaleDateString('fr-FR') : "-"}
                                                </p>
                                            </div>
                                            <div className="sm:col-span-2">
                                                <label className="text-xs text-gray-500 uppercase tracking-wider flex items-center gap-1">
                                                    <Shield className="w-3 h-3" /> Empreinte (ID)
                                                </label>
                                                <div className="relative mt-1">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-mono">#</span>
                                                    <input
                                                        type="text"
                                                        name="fingerprint"
                                                        value={formData.fingerprint}
                                                        onChange={(e) => {
                                                            const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                                                            setFormData(prev => ({ ...prev, fingerprint: val }));
                                                        }}
                                                        placeholder="123456"
                                                        className="w-full bg-zinc-800 border border-white/10 rounded pl-8 pr-3 py-2 text-white font-mono tracking-widest focus:outline-none focus:border-emerald-500/50"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Medical Info */}
                                <div className="bg-zinc-900/50 border border-white/5 rounded-lg p-6">
                                    <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                        <Heart className="w-5 h-5 text-red-400" />
                                        Informations Médicales
                                    </h2>

                                    <div className="grid sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs text-gray-500 uppercase tracking-wider">Groupe sanguin</label>
                                            <select
                                                name="blood_type"
                                                value={formData.blood_type}
                                                onChange={handleInputChange}
                                                className="w-full mt-1 bg-zinc-800 border border-white/10 rounded px-3 py-2 text-white focus:outline-none focus:border-emerald-500/50"
                                            >
                                                <option value="">Non renseigné</option>
                                                {BLOOD_TYPES.map(type => (
                                                    <option key={type} value={type}>{type}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500 uppercase tracking-wider flex items-center gap-1">
                                                <MapPin className="w-3 h-3" /> Adresse
                                            </label>
                                            <input
                                                type="text"
                                                name="address"
                                                value={formData.address}
                                                onChange={handleInputChange}
                                                placeholder="Adresse du patient"
                                                className="w-full mt-1 bg-zinc-800 border border-white/10 rounded px-3 py-2 text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50"
                                            />
                                        </div>
                                        <div className="sm:col-span-2">
                                            <label className="text-xs text-gray-500 uppercase tracking-wider flex items-center gap-1">
                                                <AlertTriangle className="w-3 h-3" /> Allergies
                                            </label>
                                            <textarea
                                                name="allergies"
                                                value={formData.allergies}
                                                onChange={handleInputChange}
                                                placeholder="Allergies connues..."
                                                rows={2}
                                                className="w-full mt-1 bg-zinc-800 border border-white/10 rounded px-3 py-2 text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50 resize-none"
                                            />
                                        </div>
                                        <div className="sm:col-span-2">
                                            <label className="text-xs text-gray-500 uppercase tracking-wider flex items-center gap-1">
                                                <FileText className="w-3 h-3" /> Antécédents médicaux
                                            </label>
                                            <textarea
                                                name="medical_history"
                                                value={formData.medical_history}
                                                onChange={handleInputChange}
                                                placeholder="Historique médical, maladies chroniques..."
                                                rows={3}
                                                className="w-full mt-1 bg-zinc-800 border border-white/10 rounded px-3 py-2 text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50 resize-none"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Emergency Contact */}
                                <div className="bg-zinc-900/50 border border-white/5 rounded-lg p-6">
                                    <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                        <Phone className="w-5 h-5 text-orange-400" />
                                        Contact d'Urgence
                                    </h2>

                                    <div className="grid sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs text-gray-500 uppercase tracking-wider">Nom du contact</label>
                                            <input
                                                type="text"
                                                name="emergency_contact"
                                                value={formData.emergency_contact}
                                                onChange={handleInputChange}
                                                placeholder="Nom du contact d'urgence"
                                                className="w-full mt-1 bg-zinc-800 border border-white/10 rounded px-3 py-2 text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500 uppercase tracking-wider">Téléphone</label>
                                            <input
                                                type="tel"
                                                name="emergency_phone"
                                                value={formData.emergency_phone}
                                                onChange={handleInputChange}
                                                placeholder="Numéro d'urgence"
                                                className="w-full mt-1 bg-zinc-800 border border-white/10 rounded px-3 py-2 text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Notes */}
                                <div className="bg-zinc-900/50 border border-white/5 rounded-lg p-6">
                                    <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                        <FileText className="w-5 h-5 text-blue-400" />
                                        Notes
                                    </h2>
                                    <textarea
                                        name="notes"
                                        value={formData.notes}
                                        onChange={handleInputChange}
                                        placeholder="Notes supplémentaires sur le patient..."
                                        rows={4}
                                        className="w-full bg-zinc-800 border border-white/10 rounded px-3 py-2 text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50 resize-none"
                                    />
                                </div>
                            </div>

                            {/* Sidebar */}
                            <div className="space-y-6">
                                <div className="bg-zinc-900/50 border border-white/5 rounded-lg p-6">
                                    <h2 className="text-sm font-semibold text-gray-400 mb-3">E-Mail</h2>
                                    <p className="text-white font-mono text-sm">
                                        @{patient.discord_username || "Non lié"}
                                    </p>
                                    <p className="text-xs text-gray-600 mt-1 font-mono">
                                        ID: {patient.discord_id}
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    ) : activeTab === 'appointments' ? (
                        <motion.div
                            key="appointments"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="grid lg:grid-cols-3 gap-6 h-[calc(100vh-250px)]"
                        >
                            {/* Liste des RDV */}
                            <div className="lg:col-span-1 bg-zinc-900/50 border border-white/5 rounded-lg overflow-hidden flex flex-col">
                                <div className="p-4 border-b border-white/5">
                                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                                        <History className="w-5 h-5 text-purple-400" />
                                        Historique RDV
                                    </h2>
                                </div>
                                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                                    {appointments.length === 0 ? (
                                        <p className="text-gray-500 text-center py-4">Aucun rendez-vous</p>
                                    ) : (
                                        appointments.map(apt => (
                                            <button
                                                key={apt.id}
                                                onClick={() => setSelectedAppointmentId(apt.id)}
                                                className={`w-full text-left p-3 rounded-lg border transition-all ${selectedAppointmentId === apt.id
                                                    ? 'bg-emerald-500/10 border-emerald-500/50'
                                                    : 'bg-zinc-800/30 border-white/5 hover:bg-zinc-800/50'
                                                    }`}
                                            >
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className={`text-xs px-2 py-0.5 rounded ${statusColors[apt.status]}`}>
                                                        {statusLabels[apt.status]}
                                                    </span>
                                                    <span className="text-xs text-gray-500">
                                                        {new Date(apt.created_at).toLocaleDateString('fr-FR')}
                                                    </span>
                                                </div>
                                                <p className="text-sm font-medium text-white line-clamp-1">
                                                    {apt.reason_category || "Autre"}
                                                </p>
                                                {apt.reason && (
                                                    <p className="text-xs text-gray-400 mt-1 line-clamp-1">
                                                        {apt.reason}
                                                    </p>
                                                )}
                                            </button>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Détail RDV & Chat */}
                            <div className="lg:col-span-2 bg-zinc-900/50 border border-white/5 rounded-lg overflow-hidden flex flex-col">
                                {selectedAppointment ? (
                                    <>
                                        {/* Header RDV */}
                                        <div className="p-4 border-b border-white/5 flex justify-between items-center bg-black/20">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`text-xs px-2 py-0.5 rounded ${statusColors[selectedAppointment.status]}`}>
                                                        {statusLabels[selectedAppointment.status]}
                                                    </span>
                                                    <span className="text-sm font-bold text-white">
                                                        {selectedAppointment.reason_category || "Rendez-vous"}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-gray-400">
                                                    ID: {selectedAppointment.id.substring(0, 8)} • Canal: {selectedAppointment.discord_channel_id || "Aucun"}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {(selectedAppointment.status === 'pending' || selectedAppointment.status === 'scheduled') && (
                                                    <button
                                                        onClick={() => setShowScheduleModal(true)}
                                                        disabled={isUpdatingStatus}
                                                        className="p-2 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 rounded border border-blue-500/30 transition-colors"
                                                        title={selectedAppointment.status === 'scheduled' ? "Reprogrammer le RDV" : "Programmer le RDV"}
                                                    >
                                                        <Clock className="w-4 h-4" />
                                                    </button>
                                                )}
                                                {selectedAppointment.status !== 'completed' && selectedAppointment.status !== 'cancelled' && (
                                                    <>
                                                        <button
                                                            onClick={handleCompleteAppointment}
                                                            disabled={isUpdatingStatus}
                                                            className="p-2 bg-green-500/10 text-green-400 hover:bg-green-500/20 rounded border border-green-500/30 transition-colors"
                                                            title="Terminer le RDV"
                                                        >
                                                            <CheckCircle className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => setShowCancelModal(true)}
                                                            disabled={isUpdatingStatus}
                                                            className="p-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded border border-red-500/30 transition-colors"
                                                            title="Annuler le RDV"
                                                        >
                                                            <XCircle className="w-4 h-4" />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {/* Info RDV améliorées */}
                                        <div className="p-4 bg-black/10 border-b border-white/5 space-y-2">
                                            <p className="text-sm text-gray-300">
                                                <span className="text-gray-500 uppercase text-xs font-bold mr-2">Motif:</span>
                                                {selectedAppointment.reason_category || "Non précisé"} {selectedAppointment.reason && `- ${selectedAppointment.reason}`}
                                            </p>
                                            {selectedAppointment.scheduled_date && (
                                                <div className="flex items-center gap-4">
                                                    <p className="text-sm text-blue-400">
                                                        <Calendar className="w-4 h-4 inline mr-1" />
                                                        {new Date(selectedAppointment.scheduled_date).toLocaleString('fr-FR', {
                                                            dateStyle: 'long',
                                                            timeStyle: 'short'
                                                        })}
                                                    </p>
                                                    <span className="text-emerald-400 font-bold text-sm">
                                                        {getCountdown(selectedAppointment.scheduled_date)}
                                                    </span>
                                                </div>
                                            )}
                                            {selectedAppointment.assigned_to_name && (
                                                <p className="text-sm text-gray-300">
                                                    <span className="text-gray-500 uppercase text-xs font-bold mr-2">Pris en charge par:</span>
                                                    {selectedAppointment.assigned_to_name}
                                                </p>
                                            )}
                                            {selectedAppointment.status === 'completed' && selectedAppointment.completed_by && (
                                                <p className="text-sm text-green-400">
                                                    <CheckCircle className="w-4 h-4 inline mr-1" />
                                                    Terminé par {selectedAppointment.completed_by}
                                                </p>
                                            )}
                                            {selectedAppointment.status === 'cancelled' && selectedAppointment.cancel_reason && (
                                                <p className="text-sm text-red-400">
                                                    <XCircle className="w-4 h-4 inline mr-1" />
                                                    Motif d'annulation: {selectedAppointment.cancel_reason}
                                                </p>
                                            )}
                                        </div>

                                        {/* Chat Area */}
                                        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-black/20">
                                            {messages.length === 0 ? (
                                                <div className="flex flex-col items-center justify-center h-full text-gray-500 opacity-50">
                                                    <MessageSquare className="w-12 h-12 mb-2" />
                                                    <p>Aucun message</p>
                                                </div>
                                            ) : (
                                                messages.map((msg) => (
                                                    <div
                                                        key={msg.id}
                                                        className={`flex flex-col ${!msg.is_from_staff ? 'items-start' : 'items-end'}`}
                                                    >
                                                        <div className={`max-w-[80%] rounded-lg p-3 ${!msg.is_from_staff
                                                            ? 'bg-zinc-800 text-white border border-white/10'
                                                            : 'bg-emerald-600/20 text-emerald-100 border border-emerald-500/30'
                                                            }`}>
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className={`text-xs font-bold ${!msg.is_from_staff ? 'text-blue-400' : 'text-emerald-400'}`}>
                                                                    {msg.sender_name}
                                                                </span>
                                                                <span className="text-[10px] text-gray-500">
                                                                    {new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                                                </span>
                                                            </div>
                                                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                            <div ref={messagesEndRef} />
                                        </div>

                                        {/* Input Area */}
                                        <div className="p-4 border-t border-white/5 bg-zinc-900">
                                            <form onSubmit={handleSendMessage} className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={newMessage}
                                                    onChange={(e) => setNewMessage(e.target.value)}
                                                    placeholder="Écrire un message..."
                                                    className="flex-1 bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500/50"
                                                    disabled={isSending || selectedAppointment.status === 'completed' || selectedAppointment.status === 'cancelled'}
                                                />
                                                <button
                                                    type="submit"
                                                    disabled={isSending || !newMessage.trim() || selectedAppointment.status === 'completed' || selectedAppointment.status === 'cancelled'}
                                                    className="p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                                                </button>
                                            </form>
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-gray-500">
                                        <Calendar className="w-16 h-16 mb-4 opacity-20" />
                                        <p>Sélectionnez un rendez-vous pour voir les détails</p>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    ) : null}
                </AnimatePresence>

                {/* Exams Tab Content */}
                <AnimatePresence mode="wait">
                    {activeTab === 'exams' && (
                        <motion.div
                            key="exams"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="bg-zinc-900/50 backdrop-blur-xl border border-white/10 rounded-xl p-6"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                    <Stethoscope className="w-5 h-5 text-emerald-400" />
                                    Visites médicales
                                </h3>
                                <Link
                                    href={`/intranet/patients/${resolvedParams.id}/medical-exam/new`}
                                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors"
                                >
                                    <Plus className="w-4 h-4" />
                                    Nouvelle visite
                                </Link>
                            </div>

                            {isLoadingExams ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                                </div>
                            ) : medicalExams.length === 0 ? (
                                <div className="text-center py-12 text-gray-400">
                                    <Stethoscope className="w-12 h-12 mx-auto mb-4 opacity-30" />
                                    <p>Aucune visite médicale enregistrée</p>
                                    <p className="text-sm mt-1">Cliquez sur &quot;Nouvelle visite&quot; pour commencer</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {medicalExams.map((exam) => (
                                        <div
                                            key={exam.id}
                                            className="bg-black/30 border border-white/10 rounded-lg p-4 hover:border-emerald-500/30 transition-colors"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-4">
                                                    <div className={`p-2 rounded-lg ${exam.status === 'completed' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                                                        {exam.status === 'completed' ? <CheckCircle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-white font-medium">
                                                                Visite {exam.visit_type ? `(${exam.visit_type})` : ''}
                                                            </span>
                                                            <span className={`text-xs px-2 py-0.5 rounded ${exam.status === 'completed' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                                                                {exam.status === 'completed' ? 'Terminé' : 'Brouillon'}
                                                            </span>
                                                        </div>
                                                        <div className="text-sm text-gray-400 mt-1">
                                                            {exam.visit_date ? new Date(exam.visit_date).toLocaleDateString('fr-FR', { dateStyle: 'long' }) : 'Date non définie'}
                                                            {exam.created_by_name && ` • Par ${exam.created_by_name}`}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Link
                                                        href={`/intranet/patients/${resolvedParams.id}/medical-exam/${exam.id}`}
                                                        className="p-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
                                                        title={exam.status === 'completed' ? 'Voir le rapport' : 'Continuer'}
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </Link>
                                                    {exam.status === 'completed' && (
                                                        <Link
                                                            href={`/intranet/patients/${resolvedParams.id}/medical-exam/${exam.id}?download=pdf`}
                                                            className="p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors"
                                                            title="Télécharger PDF"
                                                        >
                                                            <Download className="w-4 h-4" />
                                                        </Link>
                                                    )}
                                                </div>
                                            </div>
                                            {exam.status === 'completed' && exam.no_contraindication && (
                                                <div className="mt-3 pt-3 border-t border-white/10">
                                                    <span className="text-sm text-green-400 flex items-center gap-2">
                                                        <CheckCircle className="w-4 h-4" />
                                                        Aucune contre-indication constatée
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* USI Tab Content */}
                <AnimatePresence mode="wait">
                    {activeTab === 'usi' && (
                        <motion.div
                            key="usi"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                        >
                            <USIGenerator patientId={patient.id} patientName={`${patient.first_name} ${patient.last_name}`} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Schedule Modal */}
            <AnimatePresence>
                {showScheduleModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
                        onClick={() => setShowScheduleModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-zinc-900 border border-white/10 rounded-xl p-6 max-w-md w-full mx-4"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h3 className="text-xl font-bold text-white mb-4">📅 Programmer le rendez-vous</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">Date</label>
                                    <input
                                        type="date"
                                        value={scheduleDate}
                                        onChange={(e) => setScheduleDate(e.target.value)}
                                        className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500/50"
                                        min={new Date().toISOString().split('T')[0]}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">Heure</label>
                                    <input
                                        type="time"
                                        value={scheduleTime}
                                        onChange={(e) => setScheduleTime(e.target.value)}
                                        className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500/50"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={() => setShowScheduleModal(false)}
                                    className="flex-1 py-2 px-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
                                >
                                    Annuler
                                </button>
                                <button
                                    onClick={handleScheduleAppointment}
                                    disabled={!scheduleDate || !scheduleTime || isUpdatingStatus}
                                    className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50"
                                >
                                    {isUpdatingStatus ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Confirmer"}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Cancel Modal */}
            <AnimatePresence>
                {showCancelModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
                        onClick={() => setShowCancelModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-zinc-900 border border-white/10 rounded-xl p-6 max-w-md w-full mx-4"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h3 className="text-xl font-bold text-white mb-4">❌ Annuler le rendez-vous</h3>
                            <div>
                                <label className="block text-sm text-gray-400 mb-2">Raison de l'annulation (optionnel)</label>
                                <textarea
                                    value={cancelReason}
                                    onChange={(e) => setCancelReason(e.target.value)}
                                    placeholder="Indiquez la raison de l'annulation..."
                                    className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-red-500/50 h-24 resize-none"
                                />
                            </div>
                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={() => setShowCancelModal(false)}
                                    className="flex-1 py-2 px-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
                                >
                                    Retour
                                </button>
                                <button
                                    onClick={handleCancelAppointment}
                                    disabled={isUpdatingStatus}
                                    className="flex-1 py-2 px-4 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors disabled:opacity-50"
                                >
                                    {isUpdatingStatus ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Confirmer l'annulation"}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
