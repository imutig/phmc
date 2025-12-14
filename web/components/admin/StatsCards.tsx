"use client"

import { motion, Variants } from "framer-motion"
import { Clock, CheckCircle, XCircle, Users, RefreshCw } from "lucide-react"

interface StatsCardsProps {
    stats: {
        total: number
        pending: number
        reviewing: number
        recruited: number
        rejected: number
    }
}

const cardVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
        opacity: 1,
        y: 0,
        transition: { delay: i * 0.1, duration: 0.4 }
    })
}

export function StatsCards({ stats }: StatsCardsProps) {
    const cards = [
        { label: "En attente", value: stats.pending, color: "text-yellow-400", icon: Clock },
        { label: "En examen", value: stats.reviewing, color: "text-blue-400", icon: RefreshCw },
        { label: "Total", value: stats.total, color: "text-white", icon: Users },
        { label: "Recrutés", value: stats.recruited, color: "text-green-400", icon: CheckCircle },
        { label: "Refusés", value: stats.rejected, color: "text-red-400", icon: XCircle },
    ]

    return (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            {cards.map((card, idx) => (
                <motion.div
                    key={card.label}
                    custom={idx}
                    initial="hidden"
                    animate="visible"
                    variants={cardVariants}
                    whileHover={{ scale: 1.02, y: -2 }}
                    className="p-4 border border-white/10 bg-white/[0.02] backdrop-blur-sm transition-all hover:bg-white/[0.04] cursor-default"
                >
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-gray-500 uppercase tracking-widest">{card.label}</p>
                        <card.icon className={`w-4 h-4 ${card.color} opacity-50`} />
                    </div>
                    <motion.p
                        className={`text-2xl font-display font-bold ${card.color}`}
                        initial={{ scale: 0.5 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: idx * 0.1 + 0.2, type: "spring", stiffness: 200 }}
                    >
                        {card.value}
                    </motion.p>
                </motion.div>
            ))}
        </div>
    )
}
