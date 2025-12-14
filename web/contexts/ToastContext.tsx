"use client"

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
    id: string
    type: ToastType
    message: string
}

interface ToastContextType {
    showToast: (type: ToastType, message: string) => void
    success: (message: string) => void
    error: (message: string) => void
    warning: (message: string) => void
    info: (message: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

const TOAST_DURATION = 4000

const icons: Record<ToastType, typeof CheckCircle> = {
    success: CheckCircle,
    error: XCircle,
    warning: AlertTriangle,
    info: Info
}

const colors: Record<ToastType, string> = {
    success: 'bg-green-500/10 border-green-500/30 text-green-400',
    error: 'bg-red-500/10 border-red-500/30 text-red-400',
    warning: 'bg-orange-500/10 border-orange-500/30 text-orange-400',
    info: 'bg-blue-500/10 border-blue-500/30 text-blue-400'
}

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([])

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id))
    }, [])

    const showToast = useCallback((type: ToastType, message: string) => {
        const id = Date.now().toString()
        setToasts(prev => [...prev, { id, type, message }])
        setTimeout(() => removeToast(id), TOAST_DURATION)
    }, [removeToast])

    const success = (message: string) => showToast('success', message)
    const error = (message: string) => showToast('error', message)
    const warning = (message: string) => showToast('warning', message)
    const info = (message: string) => showToast('info', message)

    return (
        <ToastContext.Provider value={{ showToast, success, error, warning, info }}>
            {children}

            {/* Toast Container */}
            <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
                <AnimatePresence>
                    {toasts.map(toast => {
                        const Icon = icons[toast.type]
                        return (
                            <motion.div
                                key={toast.id}
                                initial={{ opacity: 0, x: 100, scale: 0.9 }}
                                animate={{ opacity: 1, x: 0, scale: 1 }}
                                exit={{ opacity: 0, x: 100, scale: 0.9 }}
                                className={`
                                    pointer-events-auto flex items-center gap-3 px-4 py-3 
                                    border rounded-lg shadow-lg min-w-[300px] max-w-[400px]
                                    ${colors[toast.type]}
                                `}
                            >
                                <Icon className="w-5 h-5 flex-shrink-0" />
                                <span className="flex-1 text-sm font-medium">{toast.message}</span>
                                <button
                                    onClick={() => removeToast(toast.id)}
                                    className="p-1 hover:bg-white/10 rounded transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </motion.div>
                        )
                    })}
                </AnimatePresence>
            </div>
        </ToastContext.Provider>
    )
}

export function useToast() {
    const context = useContext(ToastContext)
    if (context === undefined) {
        throw new Error('useToast must be used within a ToastProvider')
    }
    return context
}
