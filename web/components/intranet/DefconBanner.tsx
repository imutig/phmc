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
    const content = DEFCON_CONTENT[level]

    return (
        <div className={`fixed top-0 right-0 left-0 md:left-[280px] z-40 h-10 border-b backdrop-blur-md ${content.className}`}>
            <div className="h-full px-4 md:px-6 flex items-center">
                <span className="font-display text-xs md:text-sm tracking-wider uppercase font-bold mr-3">
                    {content.title}
                </span>
                <span className="text-[11px] md:text-sm opacity-95">
                    {content.message}
                </span>
            </div>
        </div>
    )
}
