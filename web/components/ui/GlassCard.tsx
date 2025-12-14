"use client";

import { motion } from "framer-motion";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

interface GlassCardProps {
    children: React.ReactNode;
    className?: string;
    hoverEffect?: boolean;
    onClick?: () => void;
}

export function GlassCard({ children, className, hoverEffect = false, onClick }: GlassCardProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            whileHover={hoverEffect ? { scale: 1.02, y: -5 } : {}}
            onClick={onClick}
            className={twMerge(
                "glass rounded-2xl p-6 transition-all duration-300",
                hoverEffect && "glass-hover cursor-pointer",
                className
            )}
        >
            {children}
        </motion.div>
    );
}
