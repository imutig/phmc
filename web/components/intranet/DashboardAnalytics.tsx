'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell
} from 'recharts';
import { TrendingUp, Calendar, Clock, DollarSign, Users, Activity } from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';

interface AnalyticsData {
    summary: {
        appointmentsThisWeek: number;
        appointmentsTotal: any;
        servicesThisWeek: number;
        liveServicesCount: number;
        totalRevenue: number;
        totalMinutes: number;
        avgServiceTime: number;
    };
    statusCounts: {
        pending: number;
        scheduled: number;
        completed: number;
        cancelled: number;
    };
    chartData: Array<{
        name: string;
        total: number;
        completed: number;
        cancelled: number;
    }>;
}

const COLORS = {
    pending: '#FBBF24',    // Yellow
    scheduled: '#3B82F6',  // Blue
    completed: '#22C55E',  // Green
    cancelled: '#EF4444'   // Red
};

const STATUS_LABELS: Record<string, string> = {
    pending: 'En attente',
    scheduled: 'Programmés',
    completed: 'Terminés',
    cancelled: 'Annulés'
};

function StatCard({
    icon: Icon,
    label,
    value,
    subValue,
    color = 'text-white',
    delay = 0
}: {
    icon: React.ElementType;
    label: string;
    value: string | number;
    subValue?: string;
    color?: string;
    delay?: number;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay }}
            className="p-4 rounded-lg bg-[#141414] border border-[#2a2a2a] hover:border-[#3a3a3a] transition-colors"
        >
            <div className="flex items-center gap-2 mb-2">
                <Icon className={`w-4 h-4 ${color}`} />
                <span className="text-xs text-gray-500 uppercase tracking-wide">{label}</span>
            </div>
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            {subValue && <div className="text-xs text-gray-500 mt-1">{subValue}</div>}
        </motion.div>
    );
}

export function DashboardAnalytics({ className = '' }: { className?: string }) {
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchAnalytics() {
            try {
                const res = await fetch('/api/intranet/analytics');
                if (res.ok) {
                    const result = await res.json();
                    setData(result);
                }
            } catch (e) {
                console.error('Analytics fetch error:', e);
            }
            setLoading(false);
        }

        fetchAnalytics();
        // Refresh toutes les 60 secondes
        const interval = setInterval(fetchAnalytics, 60000);
        return () => clearInterval(interval);
    }, []);

    const formatDuration = (minutes: number) => {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m}min`;
    };

    if (loading) {
        return (
            <div className={`space-y-6 ${className}`}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => (
                        <Skeleton key={i} variant="card" />
                    ))}
                </div>
                <Skeleton variant="chart" />
            </div>
        );
    }

    if (!data) {
        return (
            <div className={`p-6 rounded-lg bg-[#141414] border border-[#2a2a2a] text-center text-gray-500 ${className}`}>
                Impossible de charger les analytics
            </div>
        );
    }

    const pieData = Object.entries(data.statusCounts)
        .filter(([_, value]) => value > 0)
        .map(([key, value]) => ({
            name: STATUS_LABELS[key],
            value,
            color: COLORS[key as keyof typeof COLORS]
        }));

    return (
        <div className={`space-y-6 ${className}`}>
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                    icon={Calendar}
                    label="RDV cette semaine"
                    value={data.summary.appointmentsThisWeek}
                    subValue={`${data.summary.servicesThisWeek} services`}
                    color="text-blue-400"
                    delay={0.1}
                />
                <StatCard
                    icon={Users}
                    label="En service"
                    value={data.summary.liveServicesCount}
                    subValue="Actuellement actifs"
                    color="text-green-400"
                    delay={0.15}
                />
                <StatCard
                    icon={DollarSign}
                    label="Revenus semaine"
                    value={`$${data.summary.totalRevenue.toLocaleString()}`}
                    subValue={formatDuration(data.summary.totalMinutes)}
                    color="text-yellow-400"
                    delay={0.2}
                />
                <StatCard
                    icon={Clock}
                    label="Temps moyen"
                    value={formatDuration(data.summary.avgServiceTime)}
                    subValue="Par service"
                    color="text-purple-400"
                    delay={0.25}
                />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Area Chart - RDV par jour */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="lg:col-span-2 p-6 rounded-lg bg-[#141414] border border-[#2a2a2a]"
                >
                    <div className="flex items-center gap-2 mb-4">
                        <TrendingUp className="w-5 h-5 text-blue-400" />
                        <h3 className="font-display font-bold text-white">Rendez-vous (7 derniers jours)</h3>
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                        <AreaChart data={data.chartData}>
                            <defs>
                                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#22C55E" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#22C55E" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                            <XAxis
                                dataKey="name"
                                stroke="#666"
                                tick={{ fill: '#666', fontSize: 12 }}
                            />
                            <YAxis
                                stroke="#666"
                                tick={{ fill: '#666', fontSize: 12 }}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: '#1a1a1a',
                                    border: '1px solid #2a2a2a',
                                    borderRadius: '8px',
                                    color: '#fff'
                                }}
                            />
                            <Area
                                type="monotone"
                                dataKey="total"
                                name="Total"
                                stroke="#3B82F6"
                                strokeWidth={2}
                                fillOpacity={1}
                                fill="url(#colorTotal)"
                            />
                            <Area
                                type="monotone"
                                dataKey="completed"
                                name="Terminés"
                                stroke="#22C55E"
                                strokeWidth={2}
                                fillOpacity={1}
                                fill="url(#colorCompleted)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </motion.div>

                {/* Pie Chart - Répartition par statut */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35 }}
                    className="p-6 rounded-lg bg-[#141414] border border-[#2a2a2a]"
                >
                    <div className="flex items-center gap-2 mb-4">
                        <Activity className="w-5 h-5 text-purple-400" />
                        <h3 className="font-display font-bold text-white">Répartition</h3>
                    </div>
                    <ResponsiveContainer width="100%" height={160}>
                        <PieChart>
                            <Pie
                                data={pieData}
                                cx="50%"
                                cy="50%"
                                innerRadius={40}
                                outerRadius={60}
                                paddingAngle={2}
                                dataKey="value"
                            >
                                {pieData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: '#1a1a1a',
                                    border: '1px solid #2a2a2a',
                                    borderRadius: '8px',
                                    color: '#fff'
                                }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap gap-2 mt-2">
                        {pieData.map((entry, index) => (
                            <div key={index} className="flex items-center gap-1 text-xs">
                                <div
                                    className="w-2 h-2 rounded-full"
                                    style={{ backgroundColor: entry.color }}
                                />
                                <span className="text-gray-400">{entry.name}: {entry.value}</span>
                            </div>
                        ))}
                    </div>
                </motion.div>
            </div>
        </div>
    );
}

export default DashboardAnalytics;
