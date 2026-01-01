"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef, ReactNode } from "react";

interface ParallaxSectionProps {
    children: ReactNode;
    className?: string;
    /** Intensité du parallaxe (-1 à 1, 0 = pas de parallaxe) */
    intensity?: number;
    /** Direction du parallaxe */
    direction?: "up" | "down";
}

/**
 * Wrapper qui applique un effet de parallaxe au contenu.
 * L'élément se déplace à une vitesse différente du scroll.
 */
export function ParallaxSection({
    children,
    className = "",
    intensity = 0.3,
    direction = "up"
}: ParallaxSectionProps) {
    const ref = useRef<HTMLDivElement>(null);

    const { scrollYProgress } = useScroll({
        target: ref,
        offset: ["start end", "end start"]
    });

    const factor = direction === "up" ? -1 : 1;
    const y = useTransform(
        scrollYProgress,
        [0, 1],
        [`${factor * intensity * 100}px`, `${-factor * intensity * 100}px`]
    );

    return (
        <div ref={ref} className={`overflow-hidden ${className}`}>
            <motion.div style={{ y }}>
                {children}
            </motion.div>
        </div>
    );
}

interface ParallaxImageProps {
    src: string;
    alt: string;
    className?: string;
    containerClassName?: string;
    /** Intensité du parallaxe (0.1 à 0.5 recommandé) */
    intensity?: number;
}

/**
 * Image avec effet de parallaxe intégré.
 * L'image est légèrement plus grande que son container pour permettre le mouvement.
 */
export function ParallaxImage({
    src,
    alt,
    className = "",
    containerClassName = "",
    intensity = 0.2
}: ParallaxImageProps) {
    const ref = useRef<HTMLDivElement>(null);

    const { scrollYProgress } = useScroll({
        target: ref,
        offset: ["start end", "end start"]
    });

    const y = useTransform(
        scrollYProgress,
        [0, 1],
        [`-${intensity * 100}%`, `${intensity * 100}%`]
    );

    // L'image doit être plus grande pour permettre le mouvement
    const scale = 1 + intensity * 2;

    return (
        <div
            ref={ref}
            className={`overflow-hidden ${containerClassName}`}
        >
            <motion.div
                style={{ y, scale }}
                className="w-full h-full"
            >
                <img
                    src={src}
                    alt={alt}
                    className={`w-full h-full object-cover ${className}`}
                />
            </motion.div>
        </div>
    );
}

interface ParallaxBackgroundProps {
    children: ReactNode;
    backgroundImage: string;
    className?: string;
    intensity?: number;
    /** Overlay sombre sur l'image */
    overlay?: boolean;
    overlayOpacity?: number;
}

/**
 * Section avec image de fond en parallaxe.
 */
export function ParallaxBackground({
    children,
    backgroundImage,
    className = "",
    intensity = 0.15,
    overlay = true,
    overlayOpacity = 0.6
}: ParallaxBackgroundProps) {
    const ref = useRef<HTMLDivElement>(null);

    const { scrollYProgress } = useScroll({
        target: ref,
        offset: ["start end", "end start"]
    });

    const y = useTransform(
        scrollYProgress,
        [0, 1],
        [`-${intensity * 50}%`, `${intensity * 50}%`]
    );

    return (
        <div ref={ref} className={`relative overflow-hidden ${className}`}>
            {/* Background avec parallaxe */}
            <motion.div
                style={{
                    y,
                    backgroundImage: `url(${backgroundImage})`,
                }}
                className="absolute inset-0 bg-cover bg-center scale-110"
            />

            {/* Overlay */}
            {overlay && (
                <div
                    className="absolute inset-0 bg-black"
                    style={{ opacity: overlayOpacity }}
                />
            )}

            {/* Content */}
            <div className="relative z-10">
                {children}
            </div>
        </div>
    );
}
