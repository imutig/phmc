'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * Hook pour debounce une valeur
 * Utile pour les recherches et filtres en temps réel
 * 
 * @example
 * const [search, setSearch] = useState('')
 * const debouncedSearch = useDebounce(search, 300)
 * 
 * useEffect(() => {
 *   if (debouncedSearch) fetchResults(debouncedSearch)
 * }, [debouncedSearch])
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value)

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedValue(value)
        }, delay)

        return () => clearTimeout(timer)
    }, [value, delay])

    return debouncedValue
}

/**
 * Hook pour debounce une fonction callback
 * 
 * @example
 * const debouncedSave = useDebouncedCallback((value: string) => {
 *   saveToServer(value)
 * }, 500)
 * 
 * <input onChange={(e) => debouncedSave(e.target.value)} />
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
    callback: T,
    delay: number = 300
): T {
    const timeoutRef = useRef<NodeJS.Timeout | null>(null)
    const callbackRef = useRef(callback)

    // Garder la référence à jour
    useEffect(() => {
        callbackRef.current = callback
    }, [callback])

    const debouncedCallback = useCallback((...args: Parameters<T>) => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current)
        }

        timeoutRef.current = setTimeout(() => {
            callbackRef.current(...args)
        }, delay)
    }, [delay])

    // Cleanup au unmount
    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current)
            }
        }
    }, [])

    return debouncedCallback as T
}

/**
 * Hook pour throttle une fonction (limiter les appels)
 * Utile pour les événements fréquents comme scroll/resize
 * 
 * @example
 * const throttledScroll = useThrottle(() => {
 *   console.log('Scroll position:', window.scrollY)
 * }, 100)
 * 
 * useEffect(() => {
 *   window.addEventListener('scroll', throttledScroll)
 *   return () => window.removeEventListener('scroll', throttledScroll)
 * }, [])
 */
export function useThrottle<T extends (...args: any[]) => any>(
    callback: T,
    delay: number = 100
): T {
    const lastRanRef = useRef<number>(0)
    const timeoutRef = useRef<NodeJS.Timeout | null>(null)
    const callbackRef = useRef(callback)

    useEffect(() => {
        callbackRef.current = callback
    }, [callback])

    const throttledCallback = useCallback((...args: Parameters<T>) => {
        const now = Date.now()

        if (now - lastRanRef.current >= delay) {
            lastRanRef.current = now
            callbackRef.current(...args)
        } else {
            // Planifier un dernier appel après le délai
            if (timeoutRef.current) clearTimeout(timeoutRef.current)
            timeoutRef.current = setTimeout(() => {
                lastRanRef.current = Date.now()
                callbackRef.current(...args)
            }, delay - (now - lastRanRef.current))
        }
    }, [delay])

    useEffect(() => {
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current)
        }
    }, [])

    return throttledCallback as T
}
