"use client";

import { useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

interface GlassCardProps {
    children: React.ReactNode;
    className?: string;
    hoverEffect?: boolean;
    glowBorder?: boolean;
    onClick?: () => void;
}

export function GlassCard({ children, className, hoverEffect = false, glowBorder = true, onClick }: GlassCardProps) {
    const cardRef = useRef<HTMLDivElement>(null);
    const [glowPosition, setGlowPosition] = useState({ x: "50%", y: "50%" });
    const [glowOpacity, setGlowOpacity] = useState(0);

    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!cardRef.current || !glowBorder) return;
        const rect = cardRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        setGlowPosition({ x: `${x}px`, y: `${y}px` });
    }, [glowBorder]);

    const handleMouseEnter = useCallback(() => {
        if (glowBorder) setGlowOpacity(1);
    }, [glowBorder]);

    const handleMouseLeave = useCallback(() => {
        setGlowOpacity(0);
    }, []);

    return (
        <motion.div
            ref={cardRef}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            whileHover={hoverEffect ? { scale: 1.02, y: -5 } : {}}
            onClick={onClick}
            onMouseMove={handleMouseMove}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            style={{
                "--glow-x": glowPosition.x,
                "--glow-y": glowPosition.y,
                "--glow-opacity": glowOpacity,
            } as React.CSSProperties}
            className={twMerge(
                "glass rounded-2xl p-6 transition-all duration-300",
                hoverEffect && "glass-hover cursor-pointer",
                glowBorder && "glow-border",
                className
            )}
        >
            {children}
        </motion.div>
    );
}
