"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef, ReactNode } from "react";

interface TextRevealProps {
    children: string;
    className?: string;
    /** Classe pour les mots déjà révélés */
    revealedClassName?: string;
    /** Si true, révèle caractère par caractère au lieu de mot par mot */
    byCharacter?: boolean;
}

/**
 * Composant qui révèle le texte progressivement au scroll.
 * Effet élégant utilisé par Apple dans ses pages produit.
 */
export function TextReveal({
    children,
    className = "",
    revealedClassName = "text-white",
    byCharacter = false
}: TextRevealProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ["start 0.8", "end 0.3"]
    });

    const elements = byCharacter ? children.split("") : children.split(" ");

    return (
        <div ref={containerRef} className={className}>
            <p className="flex flex-wrap">
                {elements.map((element, index) => {
                    const start = index / elements.length;
                    const end = (index + 1) / elements.length;

                    return (
                        <Word
                            key={index}
                            range={[start, end]}
                            progress={scrollYProgress}
                            revealedClassName={revealedClassName}
                        >
                            {element}
                            {!byCharacter && "\u00A0"}
                        </Word>
                    );
                })}
            </p>
        </div>
    );
}

interface WordProps {
    children: ReactNode;
    range: [number, number];
    progress: ReturnType<typeof useScroll>["scrollYProgress"];
    revealedClassName: string;
}

function Word({ children, range, progress, revealedClassName }: WordProps) {
    const opacity = useTransform(progress, range, [0.15, 1]);

    return (
        <motion.span
            style={{ opacity }}
            className={`transition-colors duration-300 ${revealedClassName}`}
        >
            {children}
        </motion.span>
    );
}

interface TextRevealByLineProps {
    lines: string[];
    className?: string;
    lineClassName?: string;
}

/**
 * Variante qui révèle le texte ligne par ligne avec un effet de slide.
 */
export function TextRevealByLine({
    lines,
    className = "",
    lineClassName = ""
}: TextRevealByLineProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ["start 0.9", "end 0.4"]
    });

    return (
        <div ref={containerRef} className={className}>
            {lines.map((line, index) => {
                const start = index / lines.length;
                const end = (index + 0.8) / lines.length;

                return (
                    <RevealLine
                        key={index}
                        range={[start, end]}
                        progress={scrollYProgress}
                        className={lineClassName}
                    >
                        {line}
                    </RevealLine>
                );
            })}
        </div>
    );
}

interface RevealLineProps {
    children: ReactNode;
    range: [number, number];
    progress: ReturnType<typeof useScroll>["scrollYProgress"];
    className?: string;
}

function RevealLine({ children, range, progress, className }: RevealLineProps) {
    const opacity = useTransform(progress, range, [0, 1]);
    const y = useTransform(progress, range, [30, 0]);

    return (
        <motion.div
            style={{ opacity, y }}
            className={className}
        >
            {children}
        </motion.div>
    );
}
