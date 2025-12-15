"use client"

import { motion, AnimatePresence } from "framer-motion"
import { Check } from "lucide-react"

interface SuccessCheckmarkProps {
    show: boolean
    onComplete?: () => void
    size?: "sm" | "md" | "lg"
    color?: string
}

/**
 * Composant checkmark animé pour confirmer les actions réussies
 * Usage: <SuccessCheckmark show={showCheck} onComplete={() => setShowCheck(false)} />
 */
export function SuccessCheckmark({
    show,
    onComplete,
    size = "md",
    color = "#22c55e"
}: SuccessCheckmarkProps) {
    const sizes = {
        sm: { circle: 32, icon: 16 },
        md: { circle: 48, icon: 24 },
        lg: { circle: 64, icon: 32 }
    }

    const s = sizes[size]

    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onAnimationComplete={() => {
                        setTimeout(() => onComplete?.(), 500)
                    }}
                >
                    <motion.div
                        className="rounded-full flex items-center justify-center"
                        style={{
                            width: s.circle,
                            height: s.circle,
                            backgroundColor: color + '20',
                            border: `2px solid ${color}`
                        }}
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{
                            type: "spring",
                            stiffness: 200,
                            damping: 15
                        }}
                    >
                        <motion.div
                            initial={{ pathLength: 0 }}
                            animate={{ pathLength: 1 }}
                            transition={{ delay: 0.2, duration: 0.3 }}
                        >
                            <Check
                                style={{ width: s.icon, height: s.icon, color }}
                                strokeWidth={3}
                            />
                        </motion.div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}

/**
 * Petit checkmark inline pour les listes/boutons
 */
export function InlineCheckmark({
    show,
    color = "#22c55e"
}: {
    show: boolean
    color?: string
}) {
    return (
        <AnimatePresence>
            {show && (
                <motion.span
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    className="inline-flex items-center justify-center w-5 h-5 rounded-full"
                    style={{ backgroundColor: color + '20' }}
                >
                    <Check style={{ width: 12, height: 12, color }} strokeWidth={3} />
                </motion.span>
            )}
        </AnimatePresence>
    )
}
