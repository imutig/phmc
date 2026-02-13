"use client"

import { usePathname } from "next/navigation"
import { ReactNode } from "react"

export function DynamicLayout({ children, hasDefconBanner = false }: { children: ReactNode; hasDefconBanner?: boolean }) {
    const pathname = usePathname()
    const isMedicalExam = pathname?.includes('/medical-exam/')

    return (
        <main className="ml-0 md:ml-[280px] min-h-screen pt-[calc(3.5rem+1rem+var(--defcon-banner-offset,0px))] md:pt-[calc(5rem+var(--defcon-banner-offset,0px))]">
            <div className={`
                mx-auto px-4 md:px-6
                ${isMedicalExam ? 'w-full max-w-full' : 'max-w-7xl'}
            `}>
                {children}
            </div>
        </main>
    )
}
