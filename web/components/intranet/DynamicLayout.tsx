"use client"

import { usePathname } from "next/navigation"
import { ReactNode } from "react"

export function DynamicLayout({ children }: { children: ReactNode }) {
    const pathname = usePathname()
    const isMedicalExam = pathname?.includes('/medical-exam/')

    return (
        <main className="ml-0 md:ml-[280px] min-h-screen pt-[calc(3.5rem+1rem)] md:pt-20">
            <div className={`
                mx-auto px-4 md:px-6
                ${isMedicalExam ? 'w-full max-w-full' : 'max-w-7xl'}
            `}>
                {children}
            </div>
        </main>
    )
}
