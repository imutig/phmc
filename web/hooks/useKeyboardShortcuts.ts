"use client"

import { useEffect, useCallback, useRef } from "react"

interface Shortcut {
    key: string
    ctrlKey?: boolean
    shiftKey?: boolean
    altKey?: boolean
    action: () => void
    description?: string
}

interface UseKeyboardShortcutsOptions {
    shortcuts: Shortcut[]
    enabled?: boolean
}

export function useKeyboardShortcuts({ shortcuts, enabled = true }: UseKeyboardShortcutsOptions) {
    const shortcutsRef = useRef(shortcuts)
    shortcutsRef.current = shortcuts

    const handleKeyDown = useCallback((event: KeyboardEvent) => {
        // Ne pas intercepter si on est dans un input/textarea
        const target = event.target as HTMLElement
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
            // Sauf pour Escape qui ferme toujours les modals
            if (event.key !== 'Escape') return
        }

        for (const shortcut of shortcutsRef.current) {
            const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase()
            const ctrlMatch = shortcut.ctrlKey ? event.ctrlKey || event.metaKey : !event.ctrlKey && !event.metaKey
            const shiftMatch = shortcut.shiftKey ? event.shiftKey : !event.shiftKey
            const altMatch = shortcut.altKey ? event.altKey : !event.altKey

            if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
                event.preventDefault()
                shortcut.action()
                return
            }
        }
    }, [])

    useEffect(() => {
        if (!enabled) return

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [handleKeyDown, enabled])
}

// Hook simplifié pour les modals
export function useEscapeKey(onEscape: () => void, enabled = true) {
    useKeyboardShortcuts({
        shortcuts: [{ key: 'Escape', action: onEscape }],
        enabled
    })
}
