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
    const storageKey = useMemo(() => `defcon_banner_hidden_${level}`, [level])
    const [hidden, setHidden] = useState(false)
    const content = DEFCON_CONTENT[level]

    useEffect(() => {
        try {
            const saved = window.localStorage.getItem(storageKey)
            setHidden(saved === '1')
        } catch {
            setHidden(false)
        }
    }, [storageKey])

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
            window.localStorage.setItem(storageKey, '1')
        } catch {
        }
    }

    if (hidden) {
        return null
    }

    const tickerText = `${content.title} • ${content.message} • ${content.title} • ${content.message}`

    return (
        <div className={`fixed top-0 right-0 left-0 md:left-[280px] z-40 h-10 border-b backdrop-blur-md overflow-hidden ${content.className}`}>
            <div className="h-full px-3 md:px-4 flex items-center gap-3">
                <span className="font-display text-[10px] md:text-xs tracking-wider uppercase font-bold shrink-0">
                    FLASH INFO
                </span>

                <div className="relative flex-1 overflow-hidden">
                    <div className="defcon-news-track whitespace-nowrap text-[11px] md:text-sm opacity-95">
                        <span className="pr-10">{tickerText}</span>
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
