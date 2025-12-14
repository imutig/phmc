"use client"

import Link from "next/link"
import { ChevronRight, Home } from "lucide-react"

export interface BreadcrumbItem {
    label: string
    href?: string
}

interface BreadcrumbsProps {
    items: BreadcrumbItem[]
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
    return (
        <nav className="flex items-center gap-1 text-sm text-gray-500 mb-4">
            <Link
                href="/intranet"
                className="flex items-center gap-1 hover:text-white transition-colors"
            >
                <Home className="w-4 h-4" />
                <span className="hidden sm:inline">Intranet</span>
            </Link>

            {items.map((item, index) => (
                <div key={index} className="flex items-center gap-1">
                    <ChevronRight className="w-4 h-4 text-gray-600" />
                    {item.href ? (
                        <Link
                            href={item.href}
                            className="hover:text-white transition-colors truncate max-w-[200px]"
                        >
                            {item.label}
                        </Link>
                    ) : (
                        <span className="text-gray-400 truncate max-w-[200px]">
                            {item.label}
                        </span>
                    )}
                </div>
            ))}
        </nav>
    )
}
