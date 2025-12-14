"use client"

import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, Legend } from 'recharts'
import { motion } from 'framer-motion'
import { Activity, Clock, CheckCircle } from 'lucide-react'

interface StatsData {
    charts: {
        daily: { date: string; ems: number }[];
        distribution: { name: string; value: number; color: string }[];
    };
    metrics: {
        avgProcessingTimeHours: number;
        avgProcessingTimeDays: string;
        acceptanceRate: number;
        totalProcessed: number;
    };
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-[#0a0a0a] border border-white/10 p-3 rounded shadow-xl">
                <p className="font-mono text-xs text-gray-400 mb-2">{label}</p>
                {payload.map((entry: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-2 text-sm font-bold">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.stroke }} />
                        <span style={{ color: entry.stroke }}>{entry.name}:</span>
                        <span className="text-white">{entry.value}</span>
                    </div>
                ))}
            </div>
        )
    }
    return null
}

export function StatsCharts({ stats }: { stats: StatsData }) {
    if (!stats) return null

    return (
        <div className="space-y-6 mb-8">
            {/* KPI Cards */}
            <div className="grid md:grid-cols-3 gap-6">
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white/[0.02] border border-white/10 p-6 flex flex-col justify-between h-32"
                >
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-xs text-gray-500 uppercase tracking-widest font-display">Délai Traitement</p>
                            <h3 className="text-3xl font-bold font-display mt-1">{stats.metrics.avgProcessingTimeDays}j</h3>
                        </div>
                        <div className="p-2 bg-emerald-500/10 rounded border border-emerald-500/20">
                            <Clock className="w-5 h-5 text-emerald-400" />
                        </div>
                    </div>
                    <div className="text-xs text-gray-400 font-mono">
                        ≈ {stats.metrics.avgProcessingTimeHours} heures en moyenne
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white/[0.02] border border-white/10 p-6 flex flex-col justify-between h-32"
                >
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-xs text-gray-500 uppercase tracking-widest font-display">Taux d'Acceptation</p>
                            <h3 className="text-3xl font-bold font-display mt-1">{stats.metrics.acceptanceRate}%</h3>
                        </div>
                        <div className="p-2 bg-green-500/10 rounded border border-green-500/20">
                            <CheckCircle className="w-5 h-5 text-green-400" />
                        </div>
                    </div>
                    <div className="text-xs text-gray-400 font-mono">
                        Sur {stats.metrics.totalProcessed} dossiers traités
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-white/[0.02] border border-white/10 p-6 flex flex-col justify-between h-32"
                >
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-xs text-gray-500 uppercase tracking-widest font-display">Activité (30j)</p>
                            <h3 className="text-3xl font-bold font-display mt-1">
                                {stats.charts.daily.reduce((acc, curr) => acc + curr.ems, 0)}
                            </h3>
                        </div>
                        <div className="p-2 bg-purple-500/10 rounded border border-purple-500/20">
                            <Activity className="w-5 h-5 text-purple-400" />
                        </div>
                    </div>
                    <div className="text-xs text-gray-400 font-mono">
                        Nouvelles candidatures
                    </div>
                </motion.div>
            </div>

            {/* Charts Grid */}
            <div className="grid md:grid-cols-3 gap-6">
                {/* Evolution Journalière */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="md:col-span-2 bg-white/[0.02] border border-white/10 p-6 min-h-[350px]"
                >
                    <h3 className="text-sm text-gray-400 font-display font-bold uppercase tracking-widest mb-6">Évolution des Candidatures</h3>
                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={stats.charts.daily}>
                                <defs>
                                    <linearGradient id="colorEms" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                                <XAxis
                                    dataKey="date"
                                    stroke="#525252"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis
                                    stroke="#525252"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    allowDecimals={false}
                                />
                                <Tooltip content={<CustomTooltip />} />
                                <Area
                                    type="monotone"
                                    dataKey="ems"
                                    name="EMS"
                                    stroke="#10B981"
                                    strokeWidth={2}
                                    fillOpacity={1}
                                    fill="url(#colorEms)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>

                {/* Répartition */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="bg-white/[0.02] border border-white/10 p-6 min-h-[350px]"
                >
                    <h3 className="text-sm text-gray-400 font-display font-bold uppercase tracking-widest mb-6">Répartition par Statut</h3>
                    <div className="h-[250px] w-full flex items-center justify-center relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={stats.charts.distribution}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {stats.charts.distribution.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} stroke="rgba(0,0,0,0.5)" />
                                    ))}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} />
                                <Legend
                                    verticalAlign="bottom"
                                    height={36}
                                    iconType="circle"
                                    layout="horizontal"
                                    // @ts-ignore - Recharts type issue with Legend wrapperStyle
                                    wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        {/* Center Text */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="text-center">
                                <span className="text-2xl font-bold text-white">
                                    {stats.charts.distribution.reduce((acc, curr) => acc + curr.value, 0)}
                                </span>
                                <span className="block text-[10px] text-gray-500 uppercase tracking-wider mt-1">Candidatures</span>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    )
}
