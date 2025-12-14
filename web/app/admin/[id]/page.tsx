"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
    ArrowLeft, Shield, Clock, CheckCircle, XCircle, Calendar,
    Loader2, AlertCircle, User, FileText, MessageSquare,
    ThumbsUp, ThumbsDown, History, ExternalLink, Send, RefreshCw, Trash2, Lock, Zap, Edit2, X
} from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { STATUS_LABELS, STATUS_COLORS, type ApplicationStatus } from "@/lib/types/database";

interface ApplicationDetail {
    id: string;
    service: 'EMS';
    status: ApplicationStatus;
    first_name: string;
    last_name: string;
    birth_date: string;
    seniority: string;
    motivation: string;
    availability: string;
    discord_channel_id?: string;
    closed_at?: string;
    close_reason?: string;
    created_at: string;
    updated_at: string;
    users?: {
        discord_id: string;
        discord_username: string;
        avatar_url?: string;
    };
    application_documents?: {
        type: string;
        file_url: string;
        created_at: string;
    }[];
    application_votes?: {
        voter_discord_id: string;
        voter_name: string;
        vote: boolean;
        comment?: string;
        created_at: string;
    }[];
    application_messages?: {
        id: string;
        sender_discord_id?: string;
        sender_name: string;
        content: string;
        is_from_candidate: boolean;
        message_number?: number;
        is_deleted: boolean;
        created_at: string;
    }[];
}

interface Log {
    id: string;
    actor_name: string;
    action: string;
    details?: Record<string, unknown>;
    created_at: string;
}

const ACTION_LABELS: Record<string, string> = {
    'status_change': 'Changement de statut',
    'status_change_web': 'Changement de statut (web)',
    'message_sent': 'Message envoyé',
    'message_edited': 'Message modifié',
    'message_deleted': 'Message supprimé',
    'vote_cast': 'Vote enregistré',
    'application_created': 'Candidature créée',
    'application_withdrawn': 'Candidature retirée',
    'document_uploaded': 'Document uploadé',
};

const STATUS_OPTIONS: ApplicationStatus[] = [
    'pending', 'interview_scheduled', 'interview_passed',
    'interview_failed', 'training'
];

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

export default function AdminDetailPage() {
    const { id } = useParams();
    const router = useRouter();
    const { data: session, status: authStatus } = useSession();
    const [application, setApplication] = useState<ApplicationDetail | null>(null);
    const [logs, setLogs] = useState<Log[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [updating, setUpdating] = useState(false);

    // Vote state
    const [voting, setVoting] = useState(false);
    const [myVote, setMyVote] = useState<boolean | null>(null);
    const [showVoteModal, setShowVoteModal] = useState(false);
    const [pendingVote, setPendingVote] = useState<boolean | null>(null);
    const [voteComment, setVoteComment] = useState('');

    // Message state
    const [newMessage, setNewMessage] = useState('');
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Snippets state
    const [snippets, setSnippets] = useState<{ id: string; name: string; content: string }[]>([]);
    const [showSnippets, setShowSnippets] = useState(false);

    // Delete state
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // Close (clôture) state
    const [showCloseModal, setShowCloseModal] = useState(false);
    const [closing, setClosing] = useState(false);
    const [closeDecision, setCloseDecision] = useState<'recruited' | 'rejected'>('recruited');
    const [closeReason, setCloseReason] = useState('');

    // Edit message state
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
    const [editMessageContent, setEditMessageContent] = useState('');
    const [savingMessage, setSavingMessage] = useState(false);

    const fetchApplication = useCallback(async () => {
        try {
            const response = await fetch(`/api/admin/applications/${id}`);
            const data = await response.json();

            if (!response.ok) {
                setError(data.error || "Erreur de chargement.");
                return;
            }

            setApplication(data.application);
            setLogs(data.logs);
            setError(null);

            // Trouver mon vote
            const myDiscordId = session?.user?.discord_id;
            if (myDiscordId && data.application?.application_votes) {
                const vote = data.application.application_votes.find(
                    (v: { voter_discord_id: string }) => v.voter_discord_id === myDiscordId
                );
                setMyVote(vote?.vote ?? null);
            }
        } catch {
            setError("Erreur de connexion au serveur.");
        } finally {
            setLoading(false);
        }
    }, [id, session?.user?.discord_id]);

    useEffect(() => {
        if (authStatus === "authenticated") {
            fetchApplication();
            // Charger les snippets
            fetch('/api/admin/snippets')
                .then(res => res.json())
                .then(data => setSnippets(data.snippets || []))
                .catch(() => { });
        } else if (authStatus === "unauthenticated") {
            router.push('/admin');
        }
    }, [authStatus, fetchApplication, router]);

    // Realtime pour les votes et messages
    useEffect(() => {
        if (authStatus !== "authenticated" || !id) return;

        console.log('[Realtime Detail] Setting up channel for application:', id);

        // Test sans filtre pour diagnostiquer
        const channel = supabaseClient
            .channel(`application-detail-${id}`)
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'application_votes' },
                (payload) => {
                    console.log('[Realtime] Vote change (all):', payload);
                    if (payload.new && (payload.new as { application_id?: string }).application_id === id) {
                        fetchApplication();
                    }
                }
            )
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'application_messages' },
                (payload) => {
                    console.log('[Realtime] Message change (all):', payload);
                    if (payload.new && (payload.new as { application_id?: string }).application_id === id) {
                        fetchApplication();
                    }
                }
            )
            .on('postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'applications' },
                (payload) => {
                    console.log('[Realtime] Application update (all):', payload);
                    if (payload.new && (payload.new as { id?: string }).id === id) {
                        fetchApplication();
                    }
                }
            )
            .subscribe((status, err) => {
                console.log('[Realtime Detail] Status:', status);
                if (err) console.error('[Realtime Detail] Error:', err);
            });

        return () => {
            supabaseClient.removeChannel(channel);
        };
    }, [authStatus, id, fetchApplication]);

    // Scroll to bottom when new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [application?.application_messages]);

    const updateStatus = async (newStatus: ApplicationStatus) => {
        setUpdating(true);
        try {
            const response = await fetch(`/api/admin/applications/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });

            if (response.ok) {
                await fetchApplication();
            }
        } catch (err) {
            console.error('Update error:', err);
        } finally {
            setUpdating(false);
        }
    };

    const openVoteModal = (vote: boolean) => {
        setPendingVote(vote);
        setVoteComment('');
        setShowVoteModal(true);
    };

    const handleVote = async () => {
        if (pendingVote === null) return;
        setVoting(true);
        try {
            const response = await fetch(`/api/admin/applications/${id}/vote`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    vote: pendingVote,
                    comment: voteComment.trim() || undefined
                })
            });

            if (response.ok) {
                setMyVote(pendingVote);
                setShowVoteModal(false);
                setVoteComment('');
                await fetchApplication();
            }
        } catch (err) {
            console.error('Vote error:', err);
        } finally {
            setVoting(false);
        }
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || sending) return;

        setSending(true);
        try {
            const response = await fetch(`/api/admin/applications/${id}/message`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: newMessage.trim() })
            });

            if (response.ok) {
                setNewMessage('');
                await fetchApplication();
            }
        } catch (err) {
            console.error('Send message error:', err);
        } finally {
            setSending(false);
        }
    };

    const handleDelete = async () => {
        setDeleting(true);
        try {
            const response = await fetch(`/api/admin/applications/${id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                router.push('/admin');
            } else {
                const data = await response.json();
                setError(data.error || "Erreur lors de la suppression.");
            }
        } catch (err) {
            console.error('Delete error:', err);
            setError("Erreur de connexion.");
        } finally {
            setDeleting(false);
            setShowDeleteModal(false);
        }
    };

    const handleClose = async () => {
        setClosing(true);
        try {
            const response = await fetch(`/api/admin/applications/${id}/close`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    decision: closeDecision,
                    reason: closeReason.trim() || undefined
                })
            });

            if (response.ok) {
                setShowCloseModal(false);
                setCloseReason('');
                await fetchApplication();
            } else {
                const data = await response.json();
                setError(data.error || "Erreur lors de la clôture.");
            }
        } catch (err) {
            console.error('Close error:', err);
            setError("Erreur de connexion.");
        } finally {
            setClosing(false);
        }
    };

    if (loading) {
        return (
            <main className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-white" />
            </main>
        );
    }

    if (error || !application) {
        return (
            <main className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
                <div className="text-center">
                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <p className="text-white">{error || "Candidature non trouvée."}</p>
                    <Link href="/admin" className="text-blue-400 hover:underline mt-4 block">
                        Retour au portail admin
                    </Link>
                </div>
            </main>
        );
    }

    // Thème EMS
    const themeColor = "text-emerald-400";
    const themeBg = "bg-emerald-600";
    const themeBorder = "border-emerald-500";

    const docLabels: Record<string, string> = {
        'id_card': "Pièce d'identité",
        'driving_license': "Permis de conduire",
        'weapon_permit': "Permis de port d'arme"
    };

    const votesFor = application.application_votes?.filter(v => v.vote).length || 0;
    const votesAgainst = application.application_votes?.filter(v => !v.vote).length || 0;
    const totalVotes = votesFor + votesAgainst;
    const voteRatio = totalVotes > 0 ? Math.round((votesFor / totalVotes) * 100) : 0;

    const sortedMessages = [...(application.application_messages || [])]
        .filter(m => !m.is_deleted)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

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
                    <Link href="/admin" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                        <span className="font-sans text-sm">Retour</span>
                    </Link>
                    <div className="flex items-center gap-4">
                        <motion.button
                            whileHover={{ scale: 1.05, rotate: 180 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={fetchApplication}
                            className="p-2 border border-white/10 hover:bg-white/5 transition-colors"
                        >
                            <RefreshCw className="w-4 h-4" />
                        </motion.button>
                        <div className="text-purple-400 font-display font-bold tracking-widest text-sm flex items-center gap-2">
                            <Shield className="w-4 h-4" />
                            DÉTAIL CANDIDATURE
                        </div>
                    </div>
                </div>
            </nav>

            <main className="min-h-screen bg-[#0a0a0a] text-white pt-32 pb-12 px-4">
                <div className="max-w-7xl mx-auto">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        {/* Header */}
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <span className={`px-3 py-1 ${themeBg} text-white font-display font-bold text-sm uppercase tracking-widest`}>
                                        {application.service}
                                    </span>
                                    <span className={`px-2 py-1 text-xs font-sans ${STATUS_COLORS[application.status]}`}>
                                        {STATUS_LABELS[application.status]}
                                    </span>
                                </div>
                                <h1 className="font-display text-3xl font-bold uppercase tracking-tighter">
                                    {application.first_name} {application.last_name}
                                </h1>
                                <p className="text-sm text-gray-500 font-mono mt-1">
                                    @{application.users?.discord_username || 'N/A'} • ID: {application.id.substring(0, 8)}
                                </p>
                            </div>

                            <div className="flex items-center gap-2">
                                <select
                                    value={application.status}
                                    onChange={(e) => updateStatus(e.target.value as ApplicationStatus)}
                                    disabled={updating}
                                    className="bg-black/50 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none disabled:opacity-50"
                                >
                                    {STATUS_OPTIONS.map(status => (
                                        <option key={status} value={status}>{STATUS_LABELS[status]}</option>
                                    ))}
                                </select>
                                {updating && <Loader2 className="w-4 h-4 animate-spin" />}
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => setShowDeleteModal(true)}
                                    className="p-2 border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
                                    title="Supprimer la candidature"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </motion.button>
                                {application.status !== 'recruited' && application.status !== 'rejected' && (
                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => setShowCloseModal(true)}
                                        className="px-3 py-2 border border-green-500/30 text-green-400 hover:bg-green-500/10 transition-colors flex items-center gap-2 text-sm font-display"
                                    >
                                        <Lock className="w-4 h-4" />
                                        Clôturer
                                    </motion.button>
                                )}
                            </div>
                        </div>

                        <div className="grid md:grid-cols-3 gap-6">
                            {/* Colonne principale */}
                            <div className="md:col-span-2 space-y-6">
                                {/* Infos personnelles */}
                                <div className={`border ${themeBorder}/30 bg-white/[0.02] p-6`}>
                                    <h2 className="font-display text-lg font-bold uppercase mb-4 flex items-center gap-2">
                                        <User className="w-5 h-5" />
                                        Informations
                                    </h2>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-xs text-gray-500 uppercase tracking-widest">Date de naissance</p>
                                            <p className="font-sans">{new Date(application.birth_date).toLocaleDateString('fr-FR')}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 uppercase tracking-widest">Ancienneté</p>
                                            <p className="font-sans">{application.seniority}</p>
                                        </div>
                                        <div className="col-span-2">
                                            <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Disponibilités</p>
                                            <p className="font-sans text-gray-300">{application.availability}</p>
                                        </div>
                                        {application.close_reason && (
                                            <div className="col-span-2">
                                                <p className="text-xs text-red-400 uppercase tracking-widest mb-1">Motif de clôture</p>
                                                <p className="font-sans text-red-300 bg-red-500/10 p-2 border border-red-500/20">{application.close_reason}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Motivation */}
                                <div className="border border-white/10 bg-white/[0.02] p-6">
                                    <h2 className="font-display text-lg font-bold uppercase mb-4 flex items-center gap-2">
                                        <FileText className="w-5 h-5" />
                                        Motivation
                                    </h2>
                                    <p className="font-sans text-gray-300 whitespace-pre-wrap">{application.motivation}</p>
                                </div>

                                {/* Chat */}
                                <div className="border border-white/10 bg-white/[0.02] p-6">
                                    <h2 className="font-display text-lg font-bold uppercase mb-4 flex items-center gap-2">
                                        <MessageSquare className="w-5 h-5" />
                                        Chat ({sortedMessages.length})
                                    </h2>

                                    {/* Messages */}
                                    <div className="space-y-3 max-h-96 overflow-y-auto mb-4 pr-2">
                                        <AnimatePresence>
                                            {sortedMessages.map((msg, idx) => (
                                                <motion.div
                                                    key={msg.id}
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: idx * 0.02 }}
                                                    className={`p-3 border ${msg.is_from_candidate ? 'border-green-500/20 bg-green-500/5' : 'border-white/10 bg-black/30'} group`}
                                                >
                                                    <div className="flex justify-between items-start mb-1">
                                                        <span className={`text-sm font-bold ${msg.is_from_candidate ? 'text-green-400' : themeColor}`}>
                                                            {msg.is_from_candidate ? '👤' : '📨'} {msg.sender_name}
                                                            {msg.message_number && !msg.is_from_candidate && ` #${msg.message_number}`}
                                                        </span>
                                                        <div className="flex items-center gap-2">
                                                            {!msg.is_from_candidate && msg.sender_discord_id === session?.user?.discord_id && (
                                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    <button
                                                                        onClick={() => {
                                                                            setEditingMessageId(msg.id);
                                                                            setEditMessageContent(msg.content);
                                                                        }}
                                                                        className="p-1 text-gray-500 hover:text-white transition-colors"
                                                                        title="Modifier"
                                                                    >
                                                                        <Edit2 className="w-3 h-3" />
                                                                    </button>
                                                                    <button
                                                                        onClick={async () => {
                                                                            if (!confirm('Supprimer ce message ?')) return;
                                                                            await fetch(`/api/admin/applications/${id}/message/${msg.id}`, { method: 'DELETE' });
                                                                            fetchApplication();
                                                                        }}
                                                                        className="p-1 text-gray-500 hover:text-red-400 transition-colors"
                                                                        title="Supprimer"
                                                                    >
                                                                        <Trash2 className="w-3 h-3" />
                                                                    </button>
                                                                </div>
                                                            )}
                                                            <span className="text-xs text-gray-600">
                                                                {new Date(msg.created_at).toLocaleString('fr-FR')}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    {editingMessageId === msg.id ? (
                                                        <div className="flex gap-2 mt-2">
                                                            <input
                                                                type="text"
                                                                value={editMessageContent}
                                                                onChange={(e) => setEditMessageContent(e.target.value)}
                                                                className="flex-1 bg-black/50 border border-white/10 px-2 py-1 text-sm text-white focus:outline-none focus:border-white/30"
                                                            />
                                                            <button
                                                                onClick={async () => {
                                                                    setSavingMessage(true);
                                                                    await fetch(`/api/admin/applications/${id}/message/${msg.id}`, {
                                                                        method: 'PATCH',
                                                                        headers: { 'Content-Type': 'application/json' },
                                                                        body: JSON.stringify({ content: editMessageContent })
                                                                    });
                                                                    setSavingMessage(false);
                                                                    setEditingMessageId(null);
                                                                    fetchApplication();
                                                                }}
                                                                disabled={savingMessage}
                                                                className="px-2 py-1 bg-green-600 text-white text-xs"
                                                            >
                                                                {savingMessage ? <Loader2 className="w-3 h-3 animate-spin" /> : 'OK'}
                                                            </button>
                                                            <button
                                                                onClick={() => setEditingMessageId(null)}
                                                                className="px-2 py-1 border border-white/10 text-xs"
                                                            >
                                                                <X className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <p className="text-sm text-gray-300">{msg.content}</p>
                                                    )}
                                                </motion.div>
                                            ))}
                                        </AnimatePresence>
                                        {sortedMessages.length === 0 && (
                                            <p className="text-gray-500 text-center py-4">Aucun message</p>
                                        )}
                                        <div ref={messagesEndRef} />
                                    </div>

                                    {/* Input message */}
                                    <form onSubmit={handleSendMessage} className="flex gap-2 relative">
                                        <input
                                            type="text"
                                            value={newMessage}
                                            onChange={(e) => setNewMessage(e.target.value)}
                                            placeholder="Écrire un message au candidat..."
                                            className="flex-1 bg-black/50 border border-white/10 px-4 py-2 text-sm text-white focus:outline-none focus:border-white/30"
                                            disabled={sending}
                                        />
                                        {/* Bouton Snippets */}
                                        <div className="relative">
                                            <motion.button
                                                whileHover={{ scale: 1.02 }}
                                                whileTap={{ scale: 0.98 }}
                                                type="button"
                                                onClick={() => setShowSnippets(!showSnippets)}
                                                className="px-3 py-2 border border-white/10 text-gray-400 hover:text-white hover:border-white/30 transition-colors"
                                                title="Snippets"
                                            >
                                                <Zap className="w-4 h-4" />
                                            </motion.button>

                                            {/* Menu snippets */}
                                            <AnimatePresence>
                                                {showSnippets && snippets.length > 0 && (
                                                    <motion.div
                                                        initial={{ opacity: 0, y: 10 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        exit={{ opacity: 0, y: 10 }}
                                                        className="absolute bottom-full mb-2 right-0 w-64 bg-[#111] border border-white/10 shadow-xl max-h-64 overflow-y-auto z-50"
                                                    >
                                                        <div className="p-2 text-xs text-gray-500 uppercase tracking-wider border-b border-white/10">
                                                            Snippets rapides
                                                        </div>
                                                        {snippets.map(snippet => (
                                                            <button
                                                                key={snippet.id}
                                                                type="button"
                                                                onClick={() => {
                                                                    setNewMessage(snippet.content);
                                                                    setShowSnippets(false);
                                                                }}
                                                                className="w-full text-left px-3 py-2 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
                                                            >
                                                                <span className="text-blue-400 font-mono text-xs">/{snippet.name}</span>
                                                                <p className="text-gray-400 text-xs mt-0.5 line-clamp-1">{snippet.content}</p>
                                                            </button>
                                                        ))}
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                        <motion.button
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            type="submit"
                                            disabled={sending || !newMessage.trim()}
                                            className={`px-4 py-2 ${themeBg} flex items-center gap-2 font-display font-bold text-sm uppercase disabled:opacity-50`}
                                        >
                                            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                        </motion.button>
                                    </form>
                                </div>

                                {/* Logs */}
                                <div className="border border-white/10 bg-white/[0.02] p-6">
                                    <h2 className="font-display text-lg font-bold uppercase mb-4 flex items-center gap-2">
                                        <History className="w-5 h-5" />
                                        Historique ({logs.length})
                                    </h2>
                                    <div className="space-y-2 max-h-64 overflow-y-auto">
                                        {logs.map((log) => (
                                            <div key={log.id} className="flex items-start gap-3 text-sm py-2 border-b border-white/5 last:border-0">
                                                <span className="text-gray-600 font-mono text-xs whitespace-nowrap">
                                                    {new Date(log.created_at).toLocaleString('fr-FR')}
                                                </span>
                                                <span className="text-gray-400">
                                                    <strong>{log.actor_name}</strong>: {ACTION_LABELS[log.action] || log.action}
                                                    {log.details && log.action.includes('status') && (
                                                        <span className="text-gray-500"> → {STATUS_LABELS[(log.details.new_status as ApplicationStatus)] || log.details.new_status as string}</span>
                                                    )}
                                                </span>
                                            </div>
                                        ))}
                                        {logs.length === 0 && (
                                            <p className="text-gray-500 text-center py-4">Aucun historique</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Sidebar */}
                            <div className="space-y-6">
                                {/* Votes interactifs */}
                                <div className="border border-white/10 bg-white/[0.02] p-6">
                                    <h2 className="font-display text-sm font-bold uppercase mb-4">Votes</h2>

                                    {/* Barre de progression */}
                                    <div className="mb-4">
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="text-green-400">Pour: {votesFor}</span>
                                            <span className="text-gray-400">{voteRatio}%</span>
                                            <span className="text-red-400">Contre: {votesAgainst}</span>
                                        </div>
                                        <div className="h-2 bg-gray-800 overflow-hidden">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${voteRatio}%` }}
                                                className="h-full bg-gradient-to-r from-green-500 to-green-400"
                                            />
                                        </div>
                                    </div>

                                    {/* Boutons de vote */}
                                    <div className="flex gap-2 mb-4">
                                        <motion.button
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            onClick={() => openVoteModal(true)}
                                            disabled={voting}
                                            className={`flex-1 py-3 flex items-center justify-center gap-2 border transition-all ${myVote === true
                                                ? 'bg-green-600 border-green-500 text-white'
                                                : 'border-green-500/30 text-green-400 hover:bg-green-500/10'
                                                }`}
                                        >
                                            <ThumbsUp className="w-5 h-5" />
                                            Pour
                                        </motion.button>
                                        <motion.button
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            onClick={() => openVoteModal(false)}
                                            disabled={voting}
                                            className={`flex-1 py-3 flex items-center justify-center gap-2 border transition-all ${myVote === false
                                                ? 'bg-red-600 border-red-500 text-white'
                                                : 'border-red-500/30 text-red-400 hover:bg-red-500/10'
                                                }`}
                                        >
                                            <ThumbsDown className="w-5 h-5" />
                                            Contre
                                        </motion.button>
                                    </div>

                                    {/* Liste des votants */}
                                    <div className="space-y-2">
                                        {application.application_votes?.map((vote, idx) => (
                                            <motion.div
                                                key={idx}
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: idx * 0.05 }}
                                                className="flex items-center justify-between text-sm py-1"
                                            >
                                                <span className="text-gray-400">{vote.voter_name}</span>
                                                <span className={vote.vote ? 'text-green-400' : 'text-red-400'}>
                                                    {vote.vote ? '👍' : '👎'}
                                                </span>
                                            </motion.div>
                                        ))}
                                    </div>
                                </div>

                                {/* Documents */}
                                <div className="border border-white/10 bg-white/[0.02] p-6">
                                    <h2 className="font-display text-sm font-bold uppercase mb-4">Documents</h2>
                                    <div className="space-y-2">
                                        {application.application_documents?.map((doc, idx) => (
                                            <motion.a
                                                key={idx}
                                                whileHover={{ scale: 1.02, x: 4 }}
                                                href={doc.file_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center justify-between p-2 border border-white/10 hover:bg-white/5 transition-colors"
                                            >
                                                <span className="text-sm">{docLabels[doc.type] || doc.type}</span>
                                                <ExternalLink className="w-4 h-4 text-gray-500" />
                                            </motion.a>
                                        ))}
                                        {(!application.application_documents || application.application_documents.length === 0) && (
                                            <p className="text-gray-500 text-center py-2 text-sm">Aucun document</p>
                                        )}
                                    </div>
                                </div>

                                {/* Dates */}
                                <div className="border border-white/10 bg-white/[0.02] p-6">
                                    <h2 className="font-display text-sm font-bold uppercase mb-4">Dates</h2>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Créée le</span>
                                            <span className="font-mono">{new Date(application.created_at).toLocaleDateString('fr-FR')}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Mise à jour</span>
                                            <span className="font-mono">{new Date(application.updated_at).toLocaleDateString('fr-FR')}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </main>

            {/* Modal de confirmation de suppression */}
            <AnimatePresence>
                {showDeleteModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
                        onClick={() => setShowDeleteModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-[#0a0a0a] border border-red-500/30 p-6 max-w-md w-full mx-4"
                        >
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-red-500/20 border border-red-500/30">
                                    <Trash2 className="w-6 h-6 text-red-400" />
                                </div>
                                <h3 className="font-display text-xl font-bold uppercase">Supprimer la candidature ?</h3>
                            </div>
                            <p className="text-gray-400 mb-6 font-sans">
                                Cette action est irréversible. Toutes les données liées à cette candidature seront supprimées
                                (votes, messages, documents, historique). Le candidat pourra ensuite recréer une nouvelle candidature.
                            </p>
                            <div className="flex gap-3">
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => setShowDeleteModal(false)}
                                    className="flex-1 py-3 border border-white/10 hover:bg-white/5 font-display font-bold text-sm uppercase transition-colors"
                                >
                                    Annuler
                                </motion.button>
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={handleDelete}
                                    disabled={deleting}
                                    className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-display font-bold text-sm uppercase flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                                >
                                    {deleting ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <>
                                            <Trash2 className="w-4 h-4" />
                                            Supprimer
                                        </>
                                    )}
                                </motion.button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Modal de clôture */}
            <AnimatePresence>
                {showCloseModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
                        onClick={() => setShowCloseModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-[#111] border border-white/10 p-6 max-w-md w-full"
                        >
                            <h3 className="font-display text-xl font-bold uppercase mb-4 flex items-center gap-2">
                                <Lock className="w-5 h-5 text-green-400" />
                                Clôturer la candidature
                            </h3>
                            <p className="text-gray-400 text-sm mb-6">
                                Cette action est définitive. Le candidat sera informé de la décision par message privé.
                            </p>

                            <div className="space-y-4 mb-6">
                                <div>
                                    <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">Décision</label>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setCloseDecision('recruited')}
                                            className={`flex-1 py-3 border flex items-center justify-center gap-2 font-display font-bold text-sm uppercase transition-all ${closeDecision === 'recruited'
                                                ? 'border-green-500 bg-green-500/20 text-green-400'
                                                : 'border-white/10 text-gray-400 hover:border-white/30'
                                                }`}
                                        >
                                            <CheckCircle className="w-4 h-4" />
                                            Recruté
                                        </button>
                                        <button
                                            onClick={() => setCloseDecision('rejected')}
                                            className={`flex-1 py-3 border flex items-center justify-center gap-2 font-display font-bold text-sm uppercase transition-all ${closeDecision === 'rejected'
                                                ? 'border-red-500 bg-red-500/20 text-red-400'
                                                : 'border-white/10 text-gray-400 hover:border-white/30'
                                                }`}
                                        >
                                            <XCircle className="w-4 h-4" />
                                            Refusé
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">Raison (optionnel)</label>
                                    <textarea
                                        value={closeReason}
                                        onChange={(e) => setCloseReason(e.target.value)}
                                        placeholder={closeDecision === 'rejected' ? "Motif du refus..." : "Commentaire..."}
                                        className="w-full bg-black/50 border border-white/10 p-3 text-white text-sm resize-none h-20 focus:outline-none focus:border-white/30"
                                        maxLength={500}
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => setShowCloseModal(false)}
                                    className="flex-1 py-3 border border-white/10 hover:bg-white/5 font-display font-bold text-sm uppercase transition-colors"
                                >
                                    Annuler
                                </motion.button>
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={handleClose}
                                    disabled={closing}
                                    className={`flex-1 py-3 text-white font-display font-bold text-sm uppercase flex items-center justify-center gap-2 disabled:opacity-50 transition-colors ${closeDecision === 'recruited' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                                        }`}
                                >
                                    {closing ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <>
                                            <Lock className="w-4 h-4" />
                                            Confirmer
                                        </>
                                    )}
                                </motion.button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Modal de vote */}
            <AnimatePresence>
                {showVoteModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
                        onClick={() => setShowVoteModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-[#111] border border-white/10 p-6 max-w-md w-full"
                        >
                            <h3 className="font-display text-xl font-bold uppercase mb-4 flex items-center gap-2">
                                {pendingVote ? (
                                    <ThumbsUp className="w-5 h-5 text-green-400" />
                                ) : (
                                    <ThumbsDown className="w-5 h-5 text-red-400" />
                                )}
                                Voter {pendingVote ? 'Pour' : 'Contre'}
                            </h3>
                            <p className="text-gray-400 text-sm mb-4">
                                Vous pouvez ajouter une note optionnelle à votre vote.
                            </p>

                            <div className="mb-6">
                                <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">Note (optionnel)</label>
                                <textarea
                                    value={voteComment}
                                    onChange={(e) => setVoteComment(e.target.value)}
                                    placeholder="Ajoutez un commentaire à votre vote..."
                                    className="w-full bg-black/50 border border-white/10 p-3 text-white text-sm resize-none h-24 focus:outline-none focus:border-white/30"
                                    maxLength={500}
                                />
                                <p className="text-xs text-gray-600 mt-1 text-right">{voteComment.length}/500</p>
                            </div>

                            <div className="flex gap-3">
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => setShowVoteModal(false)}
                                    className="flex-1 py-3 border border-white/10 hover:bg-white/5 font-display font-bold text-sm uppercase transition-colors"
                                >
                                    Annuler
                                </motion.button>
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={handleVote}
                                    disabled={voting}
                                    className={`flex-1 py-3 text-white font-display font-bold text-sm uppercase flex items-center justify-center gap-2 disabled:opacity-50 transition-colors ${pendingVote ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                                        }`}
                                >
                                    {voting ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <>
                                            {pendingVote ? <ThumbsUp className="w-4 h-4" /> : <ThumbsDown className="w-4 h-4" />}
                                            Confirmer
                                        </>
                                    )}
                                </motion.button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
