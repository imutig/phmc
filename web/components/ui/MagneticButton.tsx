"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useRef, ReactNode, MouseEvent } from "react";

interface MagneticButtonProps {
    children: ReactNode;
    className?: string;
    /** Intensité de l'effet magnétique (0.1 à 0.5 recommandé) */
    intensity?: number;
    /** Scale au hover */
    hoverScale?: number;
    onClick?: () => void;
    disabled?: boolean;
}

/**
 * Bouton avec effet magnétique qui suit subtilement le curseur.
 * Micro-interaction premium style Apple.
 */
export function MagneticButton({
    children,
    className = "",
    intensity = 0.3,
    hoverScale = 1.02,
    onClick,
    disabled = false
}: MagneticButtonProps) {
    const ref = useRef<HTMLButtonElement>(null);

    const x = useMotionValue(0);
    const y = useMotionValue(0);

    const springConfig = { damping: 15, stiffness: 150 };
    const springX = useSpring(x, springConfig);
    const springY = useSpring(y, springConfig);

    const handleMouseMove = (e: MouseEvent<HTMLButtonElement>) => {
        if (!ref.current || disabled) return;

        const rect = ref.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const distanceX = e.clientX - centerX;
        const distanceY = e.clientY - centerY;

        x.set(distanceX * intensity);
        y.set(distanceY * intensity);
    };

    const handleMouseLeave = () => {
        x.set(0);
        y.set(0);
    };

    return (
        <motion.button
            ref={ref}
            style={{ x: springX, y: springY }}
            whileHover={{ scale: disabled ? 1 : hoverScale }}
            whileTap={{ scale: disabled ? 1 : 0.98 }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onClick={onClick}
            disabled={disabled}
            className={className}
        >
            {children}
        </motion.button>
    );
}

interface MagneticLinkProps {
    children: ReactNode;
    href: string;
    className?: string;
    intensity?: number;
}

/**
 * Lien avec effet magnétique.
 */
export function MagneticLink({
    children,
    href,
    className = "",
    intensity = 0.2
}: MagneticLinkProps) {
    const ref = useRef<HTMLAnchorElement>(null);

    const x = useMotionValue(0);
    const y = useMotionValue(0);

    const springConfig = { damping: 20, stiffness: 200 };
    const springX = useSpring(x, springConfig);
    const springY = useSpring(y, springConfig);

    const handleMouseMove = (e: MouseEvent<HTMLAnchorElement>) => {
        if (!ref.current) return;

        const rect = ref.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        x.set((e.clientX - centerX) * intensity);
        y.set((e.clientY - centerY) * intensity);
    };

    const handleMouseLeave = () => {
        x.set(0);
        y.set(0);
    };

    return (
        <motion.a
            ref={ref}
            href={href}
            style={{ x: springX, y: springY }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            className={`inline-block ${className}`}
        >
            {children}
        </motion.a>
    );
}

interface MagneticCardProps {
    children: ReactNode;
    className?: string;
    intensity?: number;
    /** Rotation 3D au hover */
    rotate3D?: boolean;
}

/**
 * Card avec effet magnétique et rotation 3D subtile.
 */
export function MagneticCard({
    children,
    className = "",
    intensity = 0.1,
    rotate3D = true
}: MagneticCardProps) {
    const ref = useRef<HTMLDivElement>(null);

    const x = useMotionValue(0);
    const y = useMotionValue(0);

    const springConfig = { damping: 25, stiffness: 200 };
    const springX = useSpring(x, springConfig);
    const springY = useSpring(y, springConfig);

    const rotateX = useTransform(springY, [-20, 20], [5, -5]);
    const rotateY = useTransform(springX, [-20, 20], [-5, 5]);

    const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
        if (!ref.current) return;

        const rect = ref.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        x.set((e.clientX - centerX) * intensity);
        y.set((e.clientY - centerY) * intensity);
    };

    const handleMouseLeave = () => {
        x.set(0);
        y.set(0);
    };

    return (
        <motion.div
            ref={ref}
            style={{
                x: springX,
                y: springY,
                rotateX: rotate3D ? rotateX : 0,
                rotateY: rotate3D ? rotateY : 0,
                transformPerspective: 1000
            }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            className={className}
        >
            {children}
        </motion.div>
    );
}
