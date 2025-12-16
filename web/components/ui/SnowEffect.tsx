"use client"

import { useEffect, useState } from "react"
import styles from "./SnowEffect.module.css"

export function SnowEffect() {
    const [enabled, setEnabled] = useState(false)

    useEffect(() => {
        const isChristmas = process.env.NEXT_PUBLIC_ENABLE_CHRISTMAS_THEME === "true"
        setEnabled(isChristmas)
    }, [])

    if (!enabled) return null

    // Generate random snowflakes
    const snowflakes = Array.from({ length: 50 }).map((_, i) => {
        const left = Math.random() * 100 + "%"
        const animationDuration = Math.random() * 3 + 5 + "s" // 5-8s
        const animationDelay = Math.random() * 5 + "s"
        const opacity = Math.random() * 0.5 + 0.3
        const size = Math.random() * 5 + 3 + "px"

        return (
            <div
                key={i}
                className={styles.snowflake}
                style={{
                    left,
                    animationDuration,
                    animationDelay,
                    opacity,
                    width: size,
                    height: size,
                }}
            />
        )
    })

    return (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden" aria-hidden="true">
            {snowflakes}
        </div>
    )
}
