"use client"

import { motion, AnimatePresence } from "framer-motion"
import { useState } from "react"
import {
    HeartPulse,
    Play,
    DollarSign,
    BookOpen,
    ChevronRight,
    ChevronLeft,
    Check,
    Sparkles
} from "lucide-react"

interface OnboardingStep {
    title: string
    description: string
    icon: React.ReactNode
    tip?: string
}

const steps: OnboardingStep[] = [
    {
        title: "Bienvenue sur l'Intranet PHMC ! 🎉",
        description: "Ce tutoriel va vous guider à travers les principales fonctionnalités de l'intranet. Vous pourrez le refaire à tout moment depuis la sidebar.",
        icon: <HeartPulse className="w-12 h-12 text-red-500" />,
        tip: "Vous pouvez passer ce tutoriel et y revenir plus tard"
    },
    {
        title: "Lancer un Service",
        description: "Accédez à 'Mes Services' pour démarrer et terminer vos services. Un service actif est visible par tous vos collègues en temps réel.",
        icon: <Play className="w-12 h-12 text-green-500" />,
        tip: "Le timer de service tourne automatiquement une fois lancé"
    },
    {
        title: "Consulter les Tarifs",
        description: "La grille tarifaire contient tous les prix des soins. Vous pouvez marquer vos soins favoris pour y accéder plus rapidement.",
        icon: <DollarSign className="w-12 h-12 text-yellow-500" />,
        tip: "Cliquez sur l'étoile pour ajouter un soin aux favoris"
    },
    {
        title: "Explorer le Wiki",
        description: "Le wiki contient toutes les procédures, guides et informations importantes. N'hésitez pas à consulter régulièrement les mises à jour.",
        icon: <BookOpen className="w-12 h-12 text-blue-500" />,
        tip: "Utilisez la recherche globale (Ctrl+K) pour trouver rapidement"
    }
]

interface OnboardingModalProps {
    onComplete: () => void
}

export function OnboardingModal({ onComplete }: OnboardingModalProps) {
    const [currentStep, setCurrentStep] = useState(0)
    const [direction, setDirection] = useState(0)

    const isLastStep = currentStep === steps.length - 1
    const isFirstStep = currentStep === 0

    const nextStep = () => {
        if (isLastStep) {
            onComplete()
        } else {
            setDirection(1)
            setCurrentStep(s => s + 1)
        }
    }

    const prevStep = () => {
        if (!isFirstStep) {
            setDirection(-1)
            setCurrentStep(s => s - 1)
        }
    }

    const step = steps[currentStep]

    const variants = {
        enter: (direction: number) => ({
            x: direction > 0 ? 100 : -100,
            opacity: 0
        }),
        center: {
            x: 0,
            opacity: 1
        },
        exit: (direction: number) => ({
            x: direction < 0 ? 100 : -100,
            opacity: 0
        })
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative bg-[#141414] border border-[#2a2a2a] rounded-xl max-w-lg w-full overflow-hidden"
            >
                {/* Progress bar */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gray-800">
                    <motion.div
                        className="h-full bg-gradient-to-r from-red-500 to-red-400"
                        initial={{ width: 0 }}
                        animate={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                        transition={{ duration: 0.3 }}
                    />
                </div>

                {/* Content */}
                <div className="p-8 pt-10">
                    <AnimatePresence mode="wait" custom={direction}>
                        <motion.div
                            key={currentStep}
                            custom={direction}
                            variants={variants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{ duration: 0.3 }}
                            className="text-center"
                        >
                            {/* Icon */}
                            <motion.div
                                className="mb-6 inline-flex p-4 rounded-2xl bg-[#1a1a1a] border border-[#2a2a2a]"
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: 0.2, type: "spring" }}
                            >
                                {step.icon}
                            </motion.div>

                            {/* Title */}
                            <h2 className="font-display text-2xl font-bold text-white mb-4">
                                {step.title}
                            </h2>

                            {/* Description */}
                            <p className="text-gray-400 mb-6 leading-relaxed">
                                {step.description}
                            </p>

                            {/* Tip */}
                            {step.tip && (
                                <div className="flex items-center justify-center gap-2 text-sm text-amber-400/80 bg-amber-500/10 px-4 py-2 rounded-lg">
                                    <Sparkles className="w-4 h-4" />
                                    <span>{step.tip}</span>
                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Footer */}
                <div className="px-8 pb-8 flex items-center justify-between">
                    {/* Dots */}
                    <div className="flex gap-2">
                        {steps.map((_, i) => (
                            <button
                                key={i}
                                onClick={() => {
                                    setDirection(i > currentStep ? 1 : -1)
                                    setCurrentStep(i)
                                }}
                                className={`w-2 h-2 rounded-full transition-all ${i === currentStep
                                        ? 'bg-red-500 w-6'
                                        : 'bg-gray-600 hover:bg-gray-500'
                                    }`}
                            />
                        ))}
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-3">
                        {!isFirstStep && (
                            <button
                                onClick={prevStep}
                                className="flex items-center gap-1 px-4 py-2 text-gray-400 hover:text-white transition-colors"
                            >
                                <ChevronLeft className="w-4 h-4" />
                                Précédent
                            </button>
                        )}
                        <button
                            onClick={nextStep}
                            className="flex items-center gap-2 px-6 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg transition-colors"
                        >
                            {isLastStep ? (
                                <>
                                    <Check className="w-4 h-4" />
                                    Commencer
                                </>
                            ) : (
                                <>
                                    Suivant
                                    <ChevronRight className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Skip button */}
                {isFirstStep && (
                    <button
                        onClick={onComplete}
                        className="absolute top-4 right-4 text-gray-500 hover:text-gray-400 text-sm transition-colors"
                    >
                        Passer
                    </button>
                )}
            </motion.div>
        </motion.div>
    )
}
