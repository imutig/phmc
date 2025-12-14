"use client"

import { motion } from "framer-motion"

interface SkeletonProps {
    className?: string
    variant?: 'text' | 'card' | 'avatar' | 'chart'
    count?: number
}

function SkeletonBase({ className = "", style }: { className?: string, style?: React.CSSProperties }) {
    return (
        <motion.div
            className={`bg-[#1a1a1a] rounded ${className}`}
            style={style}
            animate={{ opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        />
    )
}

export function Skeleton({ className = "", variant = 'text', count = 1 }: SkeletonProps) {
    const items = Array.from({ length: count }, (_, i) => i)

    switch (variant) {
        case 'avatar':
            return (
                <div className={`flex items-center gap-3 ${className}`}>
                    <SkeletonBase className="w-10 h-10 rounded-full flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                        <SkeletonBase className="h-4 w-3/4" />
                        <SkeletonBase className="h-3 w-1/2" />
                    </div>
                </div>
            )

        case 'card':
            return (
                <>
                    {items.map(i => (
                        <div key={i} className={`p-4 bg-[#141414] border border-[#2a2a2a] rounded-lg ${className}`}>
                            <SkeletonBase className="h-4 w-1/3 mb-3" />
                            <SkeletonBase className="h-8 w-2/3 mb-2" />
                            <SkeletonBase className="h-3 w-1/2" />
                        </div>
                    ))}
                </>
            )

        case 'chart':
            return (
                <div className={`p-6 bg-[#141414] border border-[#2a2a2a] rounded-lg ${className}`}>
                    <SkeletonBase className="h-5 w-1/3 mb-6" />
                    <div className="flex items-end gap-2 h-48">
                        {[60, 80, 40, 90, 70, 50, 85].map((h, i) => (
                            <SkeletonBase key={i} className="flex-1" style={{ height: `${h}%` }} />
                        ))}
                    </div>
                </div>
            )

        default:
            return (
                <>
                    {items.map(i => (
                        <SkeletonBase key={i} className={`h-4 ${className}`} />
                    ))}
                </>
            )
    }
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number, cols?: number }) {
    return (
        <div className="bg-[#141414] border border-[#2a2a2a] rounded-lg overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-[#2a2a2a] flex gap-4">
                {Array.from({ length: cols }, (_, i) => (
                    <SkeletonBase key={i} className="h-4 flex-1" />
                ))}
            </div>
            {/* Rows */}
            {Array.from({ length: rows }, (_, r) => (
                <div key={r} className="p-4 border-b border-[#2a2a2a] flex gap-4">
                    {Array.from({ length: cols }, (_, c) => (
                        <SkeletonBase key={c} className="h-4 flex-1" />
                    ))}
                </div>
            ))}
        </div>
    )
}

export function SkeletonServiceCard() {
    return (
        <div className="bg-[#141414] border border-[#2a2a2a] rounded-lg overflow-hidden">
            <div className="p-4 bg-[#1a1a1a] border-b border-[#2a2a2a] flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <SkeletonBase className="w-10 h-10 rounded-full" />
                    <div className="space-y-2">
                        <SkeletonBase className="h-4 w-32" />
                        <SkeletonBase className="h-3 w-20" />
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <SkeletonBase className="h-4 w-16" />
                    <SkeletonBase className="h-4 w-20" />
                </div>
            </div>
            <div className="p-4">
                <div className="grid grid-cols-7 gap-2">
                    {Array.from({ length: 4 }, (_, i) => (
                        <SkeletonBase key={i} className="h-16" />
                    ))}
                </div>
            </div>
        </div>
    )
}

export function DashboardSkeleton() {
    return (
        <div className="space-y-6">
            {/* Stats cards */}
            <div className="grid grid-cols-4 gap-4">
                {Array.from({ length: 4 }, (_, i) => (
                    <div key={i} className="p-6 bg-[#141414] border border-[#2a2a2a] rounded-lg">
                        <SkeletonBase className="h-4 w-1/3 mb-3" />
                        <SkeletonBase className="h-8 w-2/3 mb-2" />
                        <SkeletonBase className="h-3 w-1/2" />
                    </div>
                ))}
            </div>
            {/* Table */}
            <SkeletonTable rows={5} cols={5} />
        </div>
    )
}
