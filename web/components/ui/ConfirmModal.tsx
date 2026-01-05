"use client";

import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Trash2, X } from "lucide-react";
import { useEffect } from "react";

type ConfirmVariant = 'danger' | 'warning' | 'info';

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: ConfirmVariant;
    isLoading?: boolean;
}

const variantStyles: Record<ConfirmVariant, {
    icon: typeof Trash2;
    iconBg: string;
    iconColor: string;
    confirmBg: string;
    confirmHover: string;
    border: string;
}> = {
    danger: {
        icon: Trash2,
        iconBg: 'bg-red-500/20',
        iconColor: 'text-red-400',
        confirmBg: 'bg-red-600',
        confirmHover: 'hover:bg-red-500',
        border: 'border-red-500/30'
    },
    warning: {
        icon: AlertTriangle,
        iconBg: 'bg-orange-500/20',
        iconColor: 'text-orange-400',
        confirmBg: 'bg-orange-600',
        confirmHover: 'hover:bg-orange-500',
        border: 'border-orange-500/30'
    },
    info: {
        icon: AlertTriangle,
        iconBg: 'bg-blue-500/20',
        iconColor: 'text-blue-400',
        confirmBg: 'bg-blue-600',
        confirmHover: 'hover:bg-blue-500',
        border: 'border-blue-500/30'
    }
};

export function ConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = "Confirmer",
    cancelText = "Annuler",
    variant = 'danger',
    isLoading = false
}: ConfirmModalProps) {
    const styles = variantStyles[variant];
    const Icon = styles.icon;

    // Prevent scrolling when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "unset";
        }
        return () => {
            document.body.style.overflow = "unset";
        };
    }, [isOpen]);

    // Handle escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen && !isLoading) {
                onClose();
            }
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, isLoading, onClose]);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={isLoading ? undefined : onClose}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
                    />

                    {/* Modal */}
                    <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className={`max-w-md w-full p-6 bg-[#0a0a0f] border ${styles.border} rounded-xl shadow-2xl`}
                        >
                            {/* Header */}
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 ${styles.iconBg} rounded-lg`}>
                                        <Icon className={`w-6 h-6 ${styles.iconColor}`} />
                                    </div>
                                    <h3 className="text-xl font-bold text-white">{title}</h3>
                                </div>
                                {!isLoading && (
                                    <button
                                        onClick={onClose}
                                        className="p-1 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                )}
                            </div>

                            {/* Message */}
                            <p className="text-gray-400 mb-6">{message}</p>

                            {/* Actions */}
                            <div className="flex gap-3">
                                <button
                                    onClick={onClose}
                                    disabled={isLoading}
                                    className="flex-1 px-4 py-3 border border-white/10 text-gray-400 hover:text-white hover:border-white/30 transition-colors rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {cancelText}
                                </button>
                                <button
                                    onClick={onConfirm}
                                    disabled={isLoading}
                                    className={`flex-1 px-4 py-3 ${styles.confirmBg} ${styles.confirmHover} text-white font-medium transition-colors rounded-lg disabled:opacity-50 disabled:cursor-not-allowed`}
                                >
                                    {isLoading ? "..." : confirmText}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );
}
