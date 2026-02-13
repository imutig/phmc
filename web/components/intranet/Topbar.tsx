"use client"

import { Search, Menu } from "lucide-react"
import Image from "next/image"
import { ServiceButton } from "./ServiceButton"

interface TopbarProps {
    userDiscordId: string
    userName: string
    gradeName: string
    avatarUrl?: string | null
    hasDefconBanner?: boolean
    onMenuClick?: () => void
}

export function Topbar({ userDiscordId, userName, gradeName, avatarUrl, hasDefconBanner = false, onMenuClick }: TopbarProps) {
    // Ouvrir la recherche globale en simulant Cmd+K
    const openSearch = () => {
        document.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'k',
            metaKey: true,
            ctrlKey: true,
            bubbles: true
        }))
    }

    return (
        <header className="fixed right-0 left-0 md:left-[280px] h-16 z-30 bg-[#0a0a0a]/80 backdrop-blur-md border-b border-[#2a2a2a] top-[var(--defcon-banner-offset,0px)]">
            <div className="h-full px-4 md:px-6 flex items-center justify-between gap-4">
                {/* Mobile menu button */}
                <button
                    onClick={onMenuClick}
                    className="md:hidden p-2 -ml-2 text-gray-400 hover:text-white"
                >
                    <Menu className="w-6 h-6" />
                </button>

                {/* Mobile logo */}
                <div className="md:hidden flex items-center">
                    <Image
                        src="/logo_phmc.webp"
                        alt="PHMC"
                        width={32}
                        height={32}
                    />
                </div>

                {/* Barre de recherche */}
                <button
                    onClick={openSearch}
                    className="flex-1 max-w-md flex items-center gap-3 px-4 py-2 rounded-lg bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-colors border border-white/10"
                >
                    <Search className="w-4 h-4 flex-shrink-0" />
                    <span className="text-sm hidden sm:inline">Rechercher...</span>
                    <kbd className="ml-auto text-[10px] bg-gray-800 px-1.5 py-0.5 rounded text-gray-500 hidden sm:inline">
                        ⌘K
                    </kbd>
                </button>

                {/* Spacer */}
                <div className="flex-1 hidden md:block" />

                {/* Bouton de prise de service */}
                <ServiceButton
                    userDiscordId={userDiscordId}
                    userName={userName}
                    gradeName={gradeName}
                    avatarUrl={avatarUrl}
                />
            </div>
        </header>
    )
}

