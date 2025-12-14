"use client"

import { motion, Variants } from "framer-motion"
import { ReactNode } from "react"

interface StaggerContainerProps {
    children: ReactNode
    className?: string
    delay?: number
    staggerDelay?: number
}

interface StaggerItemProps {
    children: ReactNode
    className?: string
}

const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.05,
            delayChildren: 0.1
        }
    }
}

const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.3,
            ease: "easeOut"
        }
    }
}

export function StaggerContainer({ children, className = "", delay = 0.1, staggerDelay = 0.05 }: StaggerContainerProps) {
    return (
        <motion.div
            className={className}
            initial="hidden"
            animate="visible"
            variants={{
                hidden: { opacity: 0 },
                visible: {
                    opacity: 1,
                    transition: {
                        staggerChildren: staggerDelay,
                        delayChildren: delay
                    }
                }
            }}
        >
            {children}
        </motion.div>
    )
}

export function StaggerItem({ children, className = "" }: StaggerItemProps) {
    return (
        <motion.div
            className={className}
            variants={itemVariants}
        >
            {children}
        </motion.div>
    )
}

// Version pour les grilles (cards)
export function StaggerGrid({ children, className = "", columns = 3 }: StaggerContainerProps & { columns?: number }) {
    return (
        <motion.div
            className={`grid gap-4 ${className}`}
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
            initial="hidden"
            animate="visible"
            variants={containerVariants}
        >
            {children}
        </motion.div>
    )
}

// Version pour les listes
export function StaggerList({ children, className = "" }: StaggerContainerProps) {
    return (
        <motion.ul
            className={className}
            initial="hidden"
            animate="visible"
            variants={containerVariants}
        >
            {children}
        </motion.ul>
    )
}

export function StaggerListItem({ children, className = "" }: StaggerItemProps) {
    return (
        <motion.li
            className={className}
            variants={itemVariants}
        >
            {children}
        </motion.li>
    )
}
