"use client"

import { motion, AnimatePresence } from "framer-motion"
import { useState, useEffect, useCallback } from "react"
import { X, ChevronRight, ChevronLeft, Check, Sparkles } from "lucide-react"
import { createPortal } from "react-dom"

interface SpotlightStep {
    target: string // CSS selector for the element to highlight
    title: string
    description: string
    position?: "top" | "bottom" | "left" | "right"
}

const ONBOARDING_STEPS: SpotlightStep[] = [
    {
        target: "[data-onboarding='welcome']",
        title: "Bienvenue sur l'Intranet PHMC ! 🎉",
        description: "Ce tutoriel va vous guider à travers les principales fonctionnalités. Cliquez sur Suivant pour commencer !",
        position: "bottom"
    },
    {
        target: "[data-onboarding='quick-actions']",
        title: "Actions Rapides",
        description: "Accédez rapidement aux fonctionnalités les plus utilisées : créer une ordonnance, consulter les tarifs, les médicaments ou le wiki.",
        position: "bottom"
    },
    {
        target: "[data-onboarding='user-stats']",
        title: "Vos Statistiques",
        description: "Suivez votre temps de service en direct, vos heures cette semaine et vos gains. Lancez un service depuis la page 'Mes Services'.",
        position: "bottom"
    },
    {
        target: "[data-onboarding='sidebar-nav']",
        title: "Navigation",
        description: "Utilisez la sidebar pour naviguer entre les différentes sections : Services, Planning, Candidatures, Wiki et plus encore.",
        position: "right"
    },
    {
        target: "[data-onboarding='tutorial-btn']",
        title: "Refaire le Tutoriel",
        description: "Vous pouvez refaire ce tutoriel à tout moment en cliquant sur ce bouton. Bonne utilisation de l'intranet !",
        position: "right"
    }
]

interface SpotlightOnboardingProps {
    onComplete: () => void
}

export function SpotlightOnboarding({ onComplete }: SpotlightOnboardingProps) {
    const [currentStep, setCurrentStep] = useState(0)
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
    const [mounted, setMounted] = useState(false)

    const step = ONBOARDING_STEPS[currentStep]
    const isLastStep = currentStep === ONBOARDING_STEPS.length - 1
    const isFirstStep = currentStep === 0

    // Find and highlight target element
    const updateTargetRect = useCallback(() => {
        const element = document.querySelector(step.target)
        if (element) {
            const rect = element.getBoundingClientRect()
            setTargetRect(rect)
        } else {
            setTargetRect(null)
        }
    }, [step.target])

    useEffect(() => {
        setMounted(true)
        updateTargetRect()

        // Update on resize/scroll
        window.addEventListener('resize', updateTargetRect)
        window.addEventListener('scroll', updateTargetRect, true)

        return () => {
            window.removeEventListener('resize', updateTargetRect)
            window.removeEventListener('scroll', updateTargetRect, true)
        }
    }, [updateTargetRect])

    useEffect(() => {
        updateTargetRect()
    }, [currentStep, updateTargetRect])

    const nextStep = () => {
        if (isLastStep) {
            onComplete()
        } else {
            setCurrentStep(s => s + 1)
        }
    }

    const prevStep = () => {
        if (!isFirstStep) {
            setCurrentStep(s => s - 1)
        }
    }

    // Calculate tooltip position
    const getTooltipPosition = () => {
        if (!targetRect) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }

        const padding = 20
        const tooltipWidth = 320
        const tooltipHeight = 200

        switch (step.position) {
            case 'bottom':
                return {
                    top: `${targetRect.bottom + padding}px`,
                    left: `${targetRect.left + targetRect.width / 2}px`,
                    transform: 'translateX(-50%)'
                }
            case 'top':
                return {
                    top: `${targetRect.top - padding - tooltipHeight}px`,
                    left: `${targetRect.left + targetRect.width / 2}px`,
                    transform: 'translateX(-50%)'
                }
            case 'right':
                return {
                    top: `${targetRect.top + targetRect.height / 2}px`,
                    left: `${targetRect.right + padding}px`,
                    transform: 'translateY(-50%)'
                }
            case 'left':
                return {
                    top: `${targetRect.top + targetRect.height / 2}px`,
                    left: `${targetRect.left - padding - tooltipWidth}px`,
                    transform: 'translateY(-50%)'
                }
            default:
                return {
                    top: `${targetRect.bottom + padding}px`,
                    left: `${targetRect.left + targetRect.width / 2}px`,
                    transform: 'translateX(-50%)'
                }
        }
    }

    if (!mounted) return null

    const content = (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999]"
        >
            {/* Overlay with hole for spotlight */}
            <svg className="absolute inset-0 w-full h-full">
                <defs>
                    <mask id="spotlight-mask">
                        <rect width="100%" height="100%" fill="white" />
                        {targetRect && (
                            <motion.rect
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                x={targetRect.left - 8}
                                y={targetRect.top - 8}
                                width={targetRect.width + 16}
                                height={targetRect.height + 16}
                                rx={12}
                                fill="black"
                            />
                        )}
                    </mask>
                </defs>
                <rect
                    width="100%"
                    height="100%"
                    fill="rgba(0, 0, 0, 0.85)"
                    mask="url(#spotlight-mask)"
                />
            </svg>

            {/* Spotlight border glow */}
            {targetRect && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute pointer-events-none"
                    style={{
                        left: targetRect.left - 8,
                        top: targetRect.top - 8,
                        width: targetRect.width + 16,
                        height: targetRect.height + 16,
                        borderRadius: 12,
                        border: '2px solid rgba(220, 38, 38, 0.6)',
                        boxShadow: '0 0 30px rgba(220, 38, 38, 0.4), inset 0 0 20px rgba(220, 38, 38, 0.1)'
                    }}
                />
            )}

            {/* Tooltip card */}
            <motion.div
                key={currentStep}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute z-10 w-[320px] bg-[#1a1a1a] border border-[#333] rounded-xl shadow-2xl overflow-hidden"
                style={getTooltipPosition()}
            >
                {/* Progress bar */}
                <div className="h-1 bg-gray-800">
                    <motion.div
                        className="h-full bg-gradient-to-r from-red-500 to-red-400"
                        initial={{ width: 0 }}
                        animate={{ width: `${((currentStep + 1) / ONBOARDING_STEPS.length) * 100}%` }}
                    />
                </div>

                <div className="p-5">
                    {/* Step counter */}
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs text-gray-500">
                            Étape {currentStep + 1} / {ONBOARDING_STEPS.length}
                        </span>
                        <button
                            onClick={onComplete}
                            className="text-gray-500 hover:text-gray-300 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Title */}
                    <h3 className="font-display text-lg font-bold text-white mb-2 flex items-center gap-2">
                        {step.title}
                        {isFirstStep && <Sparkles className="w-4 h-4 text-amber-400" />}
                    </h3>

                    {/* Description */}
                    <p className="text-gray-400 text-sm leading-relaxed mb-4">
                        {step.description}
                    </p>

                    {/* Navigation */}
                    <div className="flex items-center justify-between">
                        {/* Dots */}
                        <div className="flex gap-1.5">
                            {ONBOARDING_STEPS.map((_, i) => (
                                <div
                                    key={i}
                                    className={`w-1.5 h-1.5 rounded-full transition-all ${i === currentStep ? 'bg-red-500 w-4' : 'bg-gray-600'
                                        }`}
                                />
                            ))}
                        </div>

                        {/* Buttons */}
                        <div className="flex gap-2">
                            {!isFirstStep && (
                                <button
                                    onClick={prevStep}
                                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                            )}
                            <button
                                onClick={nextStep}
                                className="flex items-center gap-1 px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded-lg transition-colors"
                            >
                                {isLastStep ? (
                                    <>
                                        Terminer
                                        <Check className="w-4 h-4" />
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
                </div>
            </motion.div>
        </motion.div>
    )

    return createPortal(content, document.body)
}
