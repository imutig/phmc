'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Calendar, Clock, User, CheckCircle2, XCircle, AlertCircle,
    Play, Square, MessageSquare, Activity
} from 'lucide-react';

// Fonction simple pour afficher le temps écoulé en français
function formatTimeAgo(timestamp: string): string {
    const now = new Date().getTime();
    const past = new Date(timestamp).getTime();
    const diffMs = now - past;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return "à l'instant";
    if (diffMin < 60) return `il y a ${diffMin}min`;
    if (diffHours < 24) return `il y a ${diffHours}h`;
    if (diffDays < 7) return `il y a ${diffDays}j`;
    return new Date(timestamp).toLocaleDateString('fr-FR');
}

interface ActivityItem {
    id: string;
    type: 'appointment' | 'service' | 'message';
    action: string;
    user: string;
    category?: string;
    timestamp: string;
}

interface ActivityFeedProps {
    maxItems?: number;
    className?: string;
}

const actionConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
    created: { icon: Calendar, color: 'text-blue-400', label: 'Nouveau RDV' },
    pending: { icon: AlertCircle, color: 'text-yellow-400', label: 'En attente' },
    scheduled: { icon: Clock, color: 'text-blue-400', label: 'Programmé' },
    completed: { icon: CheckCircle2, color: 'text-green-400', label: 'Terminé' },
    cancelled: { icon: XCircle, color: 'text-red-400', label: 'Annulé' },
    service_start: { icon: Play, color: 'text-green-400', label: 'Prise de service' },
    service_end: { icon: Square, color: 'text-orange-400', label: 'Fin de service' },
    message: { icon: MessageSquare, color: 'text-purple-400', label: 'Message' }
};

export function ActivityFeed({ maxItems = 8, className = '' }: ActivityFeedProps) {
    const [activities, setActivities] = useState<ActivityItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchActivities() {
            try {
                const res = await fetch('/api/intranet/analytics');
                if (res.ok) {
                    const data = await res.json();
                    setActivities(data.recentActivities || []);
                }
            } catch (e) {
                console.error('Activity fetch error:', e);
            }
            setLoading(false);
        }

        fetchActivities();
        // Refresh toutes les 30 secondes
        const interval = setInterval(fetchActivities, 30000);
        return () => clearInterval(interval);
    }, []);

    const getTimeAgo = (timestamp: string) => {
        try {
            return formatTimeAgo(timestamp);
        } catch {
            return '';
        }
    };

    if (loading) {
        return (
            <div className={`p-6 rounded-lg bg-[#141414] border border-[#2a2a2a] ${className}`}>
                <div className="flex items-center gap-2 mb-4">
                    <Activity className="w-5 h-5 text-red-400" />
                    <h3 className="font-display font-bold text-lg text-white">Activité Récente</h3>
                </div>
                <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="animate-pulse flex items-center gap-3 p-2">
                            <div className="w-8 h-8 rounded-full bg-zinc-800" />
                            <div className="flex-1 space-y-2">
                                <div className="h-3 bg-zinc-800 rounded w-3/4" />
                                <div className="h-2 bg-zinc-800 rounded w-1/2" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className={`p-6 rounded-lg bg-[#141414] border border-[#2a2a2a] ${className}`}
        >
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-red-400" />
                    <h3 className="font-display font-bold text-lg text-white">Activité Récente</h3>
                </div>
                <span className="text-xs text-gray-500">Mise à jour auto</span>
            </div>

            {activities.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                    <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Aucune activité récente</p>
                </div>
            ) : (
                <div className="space-y-1">
                    <AnimatePresence mode="popLayout">
                        {activities.slice(0, maxItems).map((activity, index) => {
                            const config = actionConfig[activity.action] || actionConfig.created;
                            const Icon = config.icon;

                            return (
                                <motion.div
                                    key={activity.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    transition={{ delay: index * 0.05 }}
                                    className="flex items-start gap-3 p-2 rounded-lg hover:bg-[#1a1a1a] transition-colors group"
                                >
                                    <div className={`p-1.5 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] group-hover:border-[#3a3a3a] transition-colors ${config.color}`}>
                                        <Icon className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-white truncate">
                                            <span className="font-medium">{activity.user || 'Anonyme'}</span>
                                            {' — '}
                                            <span className={config.color}>{config.label}</span>
                                        </p>
                                        <div className="flex items-center gap-2 text-xs text-gray-500">
                                            {activity.category && (
                                                <>
                                                    <span className="truncate max-w-[150px]">{activity.category}</span>
                                                    <span>•</span>
                                                </>
                                            )}
                                            <span>{getTimeAgo(activity.timestamp)}</span>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            )}
        </motion.div>
    );
}

export default ActivityFeed;
