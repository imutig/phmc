"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

type Theme = 'dark' | 'light'
type FontSize = 'small' | 'normal' | 'large'

interface ThemeContextType {
    theme: Theme
    fontSize: FontSize
    toggleTheme: () => void
    setTheme: (theme: Theme) => void
    setFontSize: (size: FontSize) => void
    isDark: boolean
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

const THEME_KEY = 'phmc-theme'
const FONT_SIZE_KEY = 'phmc-font-size'

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setThemeState] = useState<Theme>('dark')
    const [fontSize, setFontSizeState] = useState<FontSize>('normal')
    const [mounted, setMounted] = useState(false)

    // Charger les préférences depuis localStorage au montage
    useEffect(() => {
        const storedTheme = localStorage.getItem(THEME_KEY) as Theme | null
        if (storedTheme === 'light' || storedTheme === 'dark') {
            setThemeState(storedTheme)
        }

        const storedFontSize = localStorage.getItem(FONT_SIZE_KEY) as FontSize | null
        if (storedFontSize === 'small' || storedFontSize === 'normal' || storedFontSize === 'large') {
            setFontSizeState(storedFontSize)
        }

        setMounted(true)
    }, [])

    // Appliquer le thème et la taille de police au document
    useEffect(() => {
        if (!mounted) return

        const root = document.documentElement

        // Thème
        root.classList.remove('dark', 'light')
        root.classList.add(theme)

        // Taille de police
        root.classList.remove('font-small', 'font-normal', 'font-large')
        root.classList.add(`font-${fontSize}`)

        // Meta theme-color pour mobile
        const metaTheme = document.querySelector('meta[name="theme-color"]')
        if (metaTheme) {
            metaTheme.setAttribute('content', theme === 'dark' ? '#0a0a0f' : '#f8fafc')
        }
    }, [theme, fontSize, mounted])

    const toggleTheme = () => {
        const newTheme = theme === 'dark' ? 'light' : 'dark'
        setThemeState(newTheme)
        localStorage.setItem(THEME_KEY, newTheme)
    }

    const setTheme = (newTheme: Theme) => {
        setThemeState(newTheme)
        localStorage.setItem(THEME_KEY, newTheme)
    }

    const setFontSize = (newSize: FontSize) => {
        setFontSizeState(newSize)
        localStorage.setItem(FONT_SIZE_KEY, newSize)
    }

    // Éviter le flash de mauvais thème
    if (!mounted) {
        return <>{children}</>
    }

    return (
        <ThemeContext.Provider value={{
            theme,
            fontSize,
            toggleTheme,
            setTheme,
            setFontSize,
            isDark: theme === 'dark'
        }}>
            {children}
        </ThemeContext.Provider>
    )
}

export function useTheme() {
    const context = useContext(ThemeContext)
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider')
    }
    return context
}
