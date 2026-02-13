"use client"

import { useEffect, useMemo, useState } from "react"

interface DefconBannerProps {
    level: 'orange' | 'rouge' | 'noir'
}

const DEFCON_CONTENT: Record<DefconBannerProps['level'], { title: string; message: string; className: string }> = {
    orange: {
        title: 'DEFCON ORANGE',
        message: 'Niveau d\'alerte moyen — vigilance renforcée recommandée.',
        className: 'bg-orange-500/20 border-orange-500/40 text-orange-200'
    },
    rouge: {
        title: 'DEFCON ROUGE',
        message: 'Port du gilet obligatoire • 2 agents minimum par intervention • Prime de risque active.',
        className: 'bg-red-500/20 border-red-500/40 text-red-200'
    },
    noir: {
        title: 'DEFCON NOIR',
        message: 'Mesures DEFCON ROUGE renforcées • Gilet obligatoire • 2 agents minimum par intervention • Prime de risque active.',
        className: 'bg-neutral-800 border-neutral-600 text-gray-100'
    }
}

export function DefconBanner({ level }: DefconBannerProps) {
    const hiddenKey = useMemo(() => 'defcon_banner_hidden', [])
    const lastLevelKey = useMemo(() => 'defcon_banner_last_level', [])
    const [hidden, setHidden] = useState(false)
    const content = DEFCON_CONTENT[level]

    useEffect(() => {
        try {
            const lastLevel = window.localStorage.getItem(lastLevelKey)
            const savedHidden = window.localStorage.getItem(hiddenKey) === '1'

            if (lastLevel !== level) {
                setHidden(false)
                window.localStorage.setItem(lastLevelKey, level)
                window.localStorage.removeItem(hiddenKey)
            } else {
                setHidden(savedHidden)
            }
        } catch {
            setHidden(false)
        }
    }, [hiddenKey, lastLevelKey, level])

    useEffect(() => {
        const offset = hidden ? '0px' : '40px'
        document.documentElement.style.setProperty('--defcon-banner-offset', offset)

        return () => {
            document.documentElement.style.setProperty('--defcon-banner-offset', '0px')
        }
    }, [hidden])

    const hideBanner = () => {
        setHidden(true)
        try {
            window.localStorage.setItem(hiddenKey, '1')
            window.localStorage.setItem(lastLevelKey, level)
        } catch {
        }
    }

    if (hidden) {
        return null
    }

    const tickerText = `${content.message}`

    return (
        <div className={`fixed top-0 right-0 left-0 md:left-[280px] z-40 h-10 border-b backdrop-blur-md overflow-hidden ${content.className}`}>
            <div className="h-full px-3 md:px-4 flex items-center gap-3 relative">
                <span className="font-display text-[10px] md:text-xs tracking-wider uppercase font-bold shrink-0 opacity-90">
                    FLASH INFO
                </span>

                <span className="font-display text-[11px] md:text-sm tracking-[0.12em] uppercase font-extrabold shrink-0 px-2 py-1 rounded bg-black/25 border border-white/20">
                    {content.title}
                </span>

                <div className="relative flex-1 overflow-hidden">
                    <div className="defcon-news-item whitespace-nowrap text-[11px] md:text-sm opacity-95">
                        <span>{tickerText}</span>
                    </div>
                </div>

                <button
                    onClick={hideBanner}
                    className="shrink-0 text-[10px] md:text-xs uppercase tracking-wider font-semibold px-2 py-1 rounded border border-white/20 hover:bg-white/10 transition-colors"
                >
                    Masquer
                </button>
            </div>
        </div>
    )
}
