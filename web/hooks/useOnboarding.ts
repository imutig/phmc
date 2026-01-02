"use client"

import { useState, useEffect, useCallback } from "react"

const ONBOARDING_KEY = "phmc_onboarding_completed"

export function useOnboarding() {
    const [hasCompleted, setHasCompleted] = useState<boolean | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        // Check localStorage on mount
        const completed = localStorage.getItem(ONBOARDING_KEY)
        setHasCompleted(completed === "true")
        setIsLoading(false)
    }, [])

    const completeOnboarding = useCallback(() => {
        localStorage.setItem(ONBOARDING_KEY, "true")
        setHasCompleted(true)
    }, [])

    const resetOnboarding = useCallback(() => {
        localStorage.removeItem(ONBOARDING_KEY)
        setHasCompleted(false)
    }, [])

    return {
        hasCompleted,
        isLoading,
        completeOnboarding,
        resetOnboarding,
        shouldShowOnboarding: hasCompleted === false
    }
}
