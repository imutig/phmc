"use client"

import confetti from 'canvas-confetti'

/**
 * Hook pour les animations de confirmation
 * Utilise canvas-confetti pour les effets de célébration
 */
export function useConfirmAnimation() {
    /**
     * Lance des confettis de célébration (pour recrutement, succès majeurs)
     */
    const fireConfetti = () => {
        // Confettis depuis le centre
        confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#dc2626', '#f97316', '#fbbf24', '#22c55e', '#3b82f6']
        })

        // Petit délai puis deuxième salve
        setTimeout(() => {
            confetti({
                particleCount: 50,
                angle: 60,
                spread: 55,
                origin: { x: 0 },
                colors: ['#dc2626', '#f97316', '#fbbf24']
            })
            confetti({
                particleCount: 50,
                angle: 120,
                spread: 55,
                origin: { x: 1 },
                colors: ['#22c55e', '#3b82f6', '#8b5cf6']
            })
        }, 150)
    }

    /**
     * Confettis légers (pour créations, validations)
     */
    const fireSuccess = () => {
        confetti({
            particleCount: 30,
            spread: 50,
            origin: { y: 0.7 },
            colors: ['#22c55e', '#10b981', '#34d399'],
            scalar: 0.8
        })
    }

    /**
     * Étoiles/paillettes (pour favoris, accomplissements)
     */
    const fireStars = () => {
        const defaults = {
            spread: 360,
            ticks: 50,
            gravity: 0.5,
            decay: 0.94,
            startVelocity: 20,
            shapes: ['star'] as confetti.Shape[],
            colors: ['#fbbf24', '#f59e0b', '#d97706']
        }

        confetti({
            ...defaults,
            particleCount: 20,
            scalar: 1.2,
            origin: { y: 0.5, x: 0.5 }
        })

        confetti({
            ...defaults,
            particleCount: 10,
            scalar: 0.75,
            origin: { y: 0.6, x: 0.5 }
        })
    }

    return {
        fireConfetti,
        fireSuccess,
        fireStars
    }
}
