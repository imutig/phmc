"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import {
    Clock, CheckCircle, XCircle, Calendar, RefreshCw,
    ThumbsUp, ThumbsDown, FileText, Eye, Shield
} from "lucide-react"
import { STATUS_LABELS, STATUS_COLORS, type ApplicationStatus } from "@/lib/types/database"

interface Application {
    id: string
    service: 'EMS'
    status: ApplicationStatus
    first_name: string
    last_name: string
    created_at: string
    users?: { discord_username: string }
    stats: {
        votes_pour: number
        votes_contre: number
        documents_count: number
        messages_count: number
    }
}

interface ApplicationTableProps {
    applications: Application[]
    searchQuery: string
}

const STATUS_ICONS: Record<ApplicationStatus, React.ReactNode> = {
    pending: <Clock className="w-4 h-4" />,
    reviewing: <RefreshCw className="w-4 h-4" />,
    interview_scheduled: <Calendar className="w-4 h-4" />,
    interview_passed: <CheckCircle className="w-4 h-4" />,
    interview_failed: <XCircle className="w-4 h-4" />,
    training: <Clock className="w-4 h-4" />,
    recruited: <CheckCircle className="w-4 h-4" />,
    rejected: <XCircle className="w-4 h-4" />,
}

const rowVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: (i: number) => ({
        opacity: 1,
        x: 0,
        transition: { delay: i * 0.05, duration: 0.3 }
    })
}

export function ApplicationTable({ applications, searchQuery }: ApplicationTableProps) {
    if (applications.length === 0) {
        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-20 border border-white/5 bg-white/[0.02] rounded-lg backdrop-blur-sm"
            >
                <div className="flex justify-center mb-4 text-gray-600">
                    <FileText className="w-12 h-12" />
                </div>
                <p className="text-gray-400 font-sans">Aucune candidature trouvée</p>
            </motion.div>
        )
    }

    return (
        <>
            {/* Mobile: Cards */}
            <div className="md:hidden space-y-3">
                {applications.map((app, i) => (
                    <motion.div
                        key={app.id}
                        custom={i}
                        variants={rowVariants}
                        initial="hidden"
                        animate="visible"
                    >
                        <Link
                            href={`/admin/${app.id}`}
                            className="block p-4 bg-[#141414] border border-[#2a2a2a] rounded-lg hover:bg-[#1a1a1a] transition-colors"
                        >
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <div className="font-bold text-white text-base">
                                        {app.first_name} {app.last_name}
                                    </div>
                                    <div className="text-gray-500 text-xs font-mono">
                                        @{app.users?.discord_username || 'N/A'}
                                    </div>
                                </div>
                                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    EMS
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[app.status]}`}>
                                    {STATUS_ICONS[app.status]}
                                    {STATUS_LABELS[app.status]}
                                </span>
                                <div className="flex items-center gap-3 text-xs">
                                    <span className="text-green-400 flex items-center gap-1">
                                        <ThumbsUp className="w-3 h-3" /> {app.stats.votes_pour}
                                    </span>
                                    <span className="text-red-400 flex items-center gap-1">
                                        <ThumbsDown className="w-3 h-3" /> {app.stats.votes_contre}
                                    </span>
                                </div>
                            </div>
                        </Link>
                    </motion.div>
                ))}
            </div>

            {/* Desktop: Table */}
            <div className="hidden md:block overflow-x-auto rounded-lg border border-[#2a2a2a] bg-[#141414]">
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b border-[#2a2a2a] bg-[#1a1a1a]">
                            <th className="p-4 font-display text-sm text-gray-500 uppercase tracking-wider">Candidat</th>
                            <th className="p-4 font-display text-sm text-gray-500 uppercase tracking-wider">Discord</th>
                            <th className="p-4 font-display text-sm text-gray-500 uppercase tracking-wider">Service</th>
                            <th className="p-4 font-display text-sm text-gray-500 uppercase tracking-wider">Statut</th>
                            <th className="p-4 font-display text-sm text-gray-500 uppercase tracking-wider hidden lg:table-cell">Date</th>
                            <th className="p-4 font-display text-sm text-gray-500 uppercase tracking-wider text-center">Stats</th>
                            <th className="p-4 font-display text-sm text-gray-500 uppercase tracking-wider text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2a2a2a]">
                        {applications.map((app, i) => (
                            <motion.tr
                                key={app.id}
                                custom={i}
                                variants={rowVariants}
                                initial="hidden"
                                animate="visible"
                                className="group hover:bg-[#1f1f1f] transition-colors"
                            >
                                <td className="p-4">
                                    <div className="font-bold text-white group-hover:text-emerald-400 transition-colors">
                                        {app.first_name} {app.last_name}
                                    </div>
                                </td>
                                <td className="p-4 text-gray-400 font-mono text-sm">
                                    {app.users?.discord_username || 'N/A'}
                                </td>
                                <td className="p-4">
                                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                        EMS
                                    </span>
                                </td>
                                <td className="p-4">
                                    <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${STATUS_COLORS[app.status]} bg-opacity-10 border border-current bg-transparent`}>
                                        {STATUS_ICONS[app.status]}
                                        {STATUS_LABELS[app.status]}
                                    </span>
                                </td>
                                <td className="p-4 text-gray-400 text-sm hidden lg:table-cell font-mono">
                                    {new Date(app.created_at).toLocaleDateString()}
                                </td>
                                <td className="p-4">
                                    <div className="flex items-center justify-center gap-4 text-sm">
                                        <div className="flex items-center gap-1 text-green-400" title="Votes Pour">
                                            <ThumbsUp className="w-3 h-3" />
                                            <span>{app.stats.votes_pour}</span>
                                        </div>
                                        <div className="flex items-center gap-1 text-red-400" title="Votes Contre">
                                            <ThumbsDown className="w-3 h-3" />
                                            <span>{app.stats.votes_contre}</span>
                                        </div>
                                    </div>
                                </td>
                                <td className="p-4 text-right">
                                    <Link
                                        href={`/admin/${app.id}`}
                                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-emerald-500 hover:text-white text-gray-300 rounded transition-all duration-300 border border-white/10 group-hover:border-emerald-400/50"
                                    >
                                        <Eye className="w-4 h-4" />
                                        <span className="text-xs font-bold uppercase tracking-wider">Voir</span>
                                    </Link>
                                </td>
                            </motion.tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </>
    )
}
