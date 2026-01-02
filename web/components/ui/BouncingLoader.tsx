"use client"

/**
 * BouncingLoader - Animated loader with 3 bouncing circles
 * Inspired by ui_element4 from uiverse.io
 */
export function BouncingLoader({
    size = "md",
    color = "red"
}: {
    size?: "sm" | "md" | "lg"
    color?: "red" | "white" | "gray"
}) {
    const sizeClasses = {
        sm: "w-[100px] h-[30px]",
        md: "w-[150px] h-[45px]",
        lg: "w-[200px] h-[60px]"
    }

    const circleSizes = {
        sm: "w-2.5 h-2.5",
        md: "w-4 h-4",
        lg: "w-5 h-5"
    }

    const colorClasses = {
        red: "bg-red-500",
        white: "bg-white",
        gray: "bg-gray-400"
    }

    return (
        <div className={`relative ${sizeClasses[size]}`}>
            {/* Circles */}
            {[0, 1, 2].map((i) => (
                <div
                    key={`circle-${i}`}
                    className={`
                        absolute ${circleSizes[size]} rounded-full ${colorClasses[color]}
                        animate-bounce-loader
                    `}
                    style={{
                        left: i === 0 ? '15%' : i === 1 ? '45%' : 'auto',
                        right: i === 2 ? '15%' : 'auto',
                        animationDelay: `${i * 0.1}s`
                    }}
                />
            ))}
            {/* Shadows */}
            {[0, 1, 2].map((i) => (
                <div
                    key={`shadow-${i}`}
                    className="absolute w-5 h-1 rounded-full bg-black/30 blur-[1px] bottom-0 animate-shadow-loader"
                    style={{
                        left: i === 0 ? '15%' : i === 1 ? '45%' : 'auto',
                        right: i === 2 ? '15%' : 'auto',
                        animationDelay: `${i * 0.1}s`
                    }}
                />
            ))}
        </div>
    )
}

/**
 * Simple spinner fallback for very small spaces
 */
export function MiniLoader({ className = "" }: { className?: string }) {
    return (
        <div className={`flex items-center justify-center gap-1 ${className}`}>
            {[0, 1, 2].map((i) => (
                <div
                    key={i}
                    className="w-2 h-2 rounded-full bg-red-500 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                />
            ))}
        </div>
    )
}
