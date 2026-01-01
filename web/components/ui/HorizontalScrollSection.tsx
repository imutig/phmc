"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef, ReactNode } from "react";

interface HorizontalScrollSectionProps {
    children: ReactNode;
    className?: string;
    /** Multiplicateur de la longueur du scroll horizontal (ex: 3 = 3x la largeur de l'écran) */
    scrollMultiplier?: number;
}

/**
 * Section qui transforme le scroll vertical en défilement horizontal.
 * Effet signature Apple pour les présentations de produits/services.
 */
export function HorizontalScrollSection({
    children,
    className = "",
    scrollMultiplier = 3
}: HorizontalScrollSectionProps) {
    const targetRef = useRef<HTMLDivElement>(null);

    const { scrollYProgress } = useScroll({
        target: targetRef,
        offset: ["start start", "end end"]
    });

    // Transforme le scroll vertical (0-1) en déplacement horizontal (0% → -66% pour 3x)
    const x = useTransform(
        scrollYProgress,
        [0, 1],
        ["0%", `-${((scrollMultiplier - 1) / scrollMultiplier) * 100}%`]
    );

    return (
        <section
            ref={targetRef}
            className="relative"
            style={{ height: `${scrollMultiplier * 100}vh` }}
        >
            <div className="sticky top-0 h-screen overflow-hidden">
                <motion.div
                    style={{ x }}
                    className={`flex h-full ${className}`}
                >
                    {children}
                </motion.div>
            </div>
        </section>
    );
}

interface HorizontalSlideProps {
    children: ReactNode;
    className?: string;
}

/**
 * Slide individuel à utiliser dans HorizontalScrollSection.
 * Chaque slide occupe 100vw.
 */
export function HorizontalSlide({ children, className = "" }: HorizontalSlideProps) {
    return (
        <div className={`flex-shrink-0 w-screen h-full flex items-center justify-center ${className}`}>
            {children}
        </div>
    );
}
