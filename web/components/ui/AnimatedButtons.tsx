"use client"

import { motion } from "framer-motion"
import { LogOut, Trash2, Send } from "lucide-react"
import { signOut } from "next-auth/react"

/**
 * AnimatedLogoutButton - Bouton de déconnexion animé
 * Inspiré de ui_element1 - s'étend au survol pour révéler le texte
 */
export function AnimatedLogoutButton({
    collapsed = false,
    size = "md",
    className = ""
}: {
    collapsed?: boolean
    size?: "sm" | "md"
    className?: string
}) {
    const sizes = {
        sm: {
            button: 'h-9',
            buttonWidth: collapsed ? 'w-9' : 'w-9 hover:w-[160px]',
            iconContainer: collapsed ? 'w-full' : 'w-9 group-hover:w-[30%] group-hover:pl-2.5',
            icon: 'w-4 h-4',
            text: 'text-xs'
        },
        md: {
            button: 'h-11',
            buttonWidth: collapsed ? 'w-11' : 'w-11 hover:w-[170px]',
            iconContainer: collapsed ? 'w-full' : 'w-11 group-hover:w-[30%] group-hover:pl-3',
            icon: 'w-[18px] h-[18px]',
            text: 'text-sm'
        }
    }
    const s = sizes[size]

    return (
        <motion.button
            onClick={() => signOut({ callbackUrl: '/' })}
            className={`
                group relative flex items-center justify-start
                ${s.button} ${s.buttonWidth} rounded-full cursor-pointer overflow-hidden
                transition-all duration-300 ease-out
                bg-red-800 hover:bg-red-700
                shadow-md shadow-red-900/30
                ${className}
            `}
            whileTap={{ scale: 0.95 }}
        >
            {/* Icon */}
            <div className={`
                flex items-center justify-center transition-all duration-300
                ${s.iconContainer}
            `}>
                <LogOut className={`${s.icon} text-white`} />
            </div>

            {/* Text - only visible when not collapsed */}
            {!collapsed && (
                <span className={`
                    absolute right-0 w-0 opacity-0
                    text-white font-semibold ${s.text} whitespace-nowrap
                    transition-all duration-300
                    group-hover:w-[65%] group-hover:opacity-100 group-hover:pr-2.5
                `}>
                    Déconnexion
                </span>
            )}
        </motion.button>
    )
}

/**
 * AnimatedDeleteButton - Bouton de suppression animé
 * Style "Giant Trash Can" : Cercle noir qui devient rouge et s'étend,
 * l'icône poubelle grossit et descend, le texte "Supprimer" descend du haut.
 */
export function AnimatedDeleteButton({
    onClick,
    label = "Supprimer",
    size = "md", // size prop kept for compatibility but has less effect on fixed design
    className = ""
}: {
    onClick: () => void
    label?: string
    size?: "sm" | "md"
    className?: string
}) {
    // Base size scaling
    const baseSize = size === 'sm' ? 'w-9 h-9' : 'w-11 h-11'
    const expandedWidth = size === 'sm' ? 'hover:w-[110px]' : 'hover:w-[140px]'

    return (
        <motion.button
            onClick={onClick}
            className={`
                group relative flex items-center justify-center
                ${baseSize} ${expandedWidth}
                rounded-full cursor-pointer overflow-hidden
                transition-all duration-300 ease-out
                bg-[#1a1a1a] hover:bg-red-600
                shadow-[0px_0px_20px_rgba(0,0,0,0.164)]
                ${className}
            `}
            whileTap={{ scale: 0.95 }}
        >
            {/* Giant Icon */}
            <Trash2 className={`
                w-3 h-3 text-white
                transition-all duration-300
                group-hover:w-[50px] group-hover:h-[50px]
                group-hover:translate-y-[40%]
            `} />

            {/* Floating Label */}
            <span className={`
                absolute top-[-20px] 
                text-white font-semibold
                text-[2px] opacity-100
                transition-all duration-300
                group-hover:translate-y-[35px] group-hover:text-xs group-hover:opacity-100
            `}>
                {label}
            </span>
        </motion.button>
    )
}

/**
 * AnimatedSendButton - Bouton d'envoi animé
 * Inspiré de ui_element3 - icône qui vole au survol
 */
export function AnimatedSendButton({
    onClick,
    label = "Envoyer",
    disabled = false,
    loading = false,
    type = "button",
    className = ""
}: {
    onClick?: () => void
    label?: string
    disabled?: boolean
    loading?: boolean
    type?: "button" | "submit"
    className?: string
}) {
    return (
        <motion.button
            type={type}
            onClick={onClick}
            disabled={disabled || loading}
            className={`
                group relative flex items-center gap-2
                px-5 py-2.5 rounded-xl
                bg-red-600 hover:bg-red-500 disabled:bg-gray-700
                text-white font-bold text-sm
                transition-all duration-200 overflow-hidden
                disabled:cursor-not-allowed
                ${className}
            `}
            whileTap={{ scale: disabled ? 1 : 0.95 }}
        >
            {/* SVG wrapper - animated */}
            <div className="relative flex items-center justify-center">
                <motion.div
                    className="group-hover:animate-[fly_0.6s_ease-in-out_infinite_alternate]"
                >
                    <Send className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-3 group-hover:rotate-45 group-hover:scale-110" />
                </motion.div>
            </div>

            {/* Label - slides out on hover */}
            <span className="transition-transform duration-300 group-hover:translate-x-12">
                {loading ? 'Envoi...' : label}
            </span>
        </motion.button>
    )
}

/**
 * AnimatedInput - Champ de saisie avec label animé
 * Inspiré de ui_element5 - lettres qui montent une par une
 */
export function AnimatedInput({
    label,
    type = "text",
    value,
    onChange,
    required = false,
    className = ""
}: {
    label: string
    type?: string
    value: string
    onChange: (value: string) => void
    required?: boolean
    className?: string
}) {
    const letters = label.split('')

    return (
        <div className={`relative w-full ${className}`}>
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                required={required}
                className="
                    peer w-full bg-transparent
                    border-0 border-b-2 border-gray-600
                    py-3 px-0 text-lg text-white
                    focus:outline-none focus:border-red-500
                    transition-colors duration-300
                    placeholder-transparent
                "
                placeholder={label}
            />
            <label className="
                absolute top-3 left-0
                pointer-events-none
                flex
            ">
                {letters.map((letter, i) => (
                    <span
                        key={i}
                        className="
                            text-lg text-gray-400 min-w-[5px]
                            transition-all duration-300
                            peer-focus:text-red-400 peer-focus:-translate-y-7 peer-focus:text-sm
                            peer-[:not(:placeholder-shown)]:text-red-400 
                            peer-[:not(:placeholder-shown)]:-translate-y-7 
                            peer-[:not(:placeholder-shown)]:text-sm
                        "
                        style={{
                            transitionDelay: `${i * 50}ms`,
                        }}
                    >
                        {letter === ' ' ? '\u00A0' : letter}
                    </span>
                ))}
            </label>
        </div>
    )
}
