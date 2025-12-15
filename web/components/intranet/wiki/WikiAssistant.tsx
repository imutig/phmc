"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { MessageCircle, X, Send, Loader2, Bot, User, Sparkles } from "lucide-react"

interface Message {
    role: "user" | "assistant"
    content: string
}

export function WikiAssistant() {
    const [isOpen, setIsOpen] = useState(false)
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [messages])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!input.trim() || isLoading) return

        const question = input.trim()
        setInput("")
        setMessages(prev => [...prev, { role: "user", content: question }])
        setIsLoading(true)

        try {
            const response = await fetch("/api/wiki-assistant", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ question }),
            })

            const data = await response.json()

            if (response.ok) {
                setMessages(prev => [...prev, { role: "assistant", content: data.answer }])
            } else {
                setMessages(prev => [...prev, {
                    role: "assistant",
                    content: data.error || "Une erreur est survenue."
                }])
            }
        } catch (error) {
            setMessages(prev => [...prev, {
                role: "assistant",
                content: "Erreur de connexion. Veuillez réessayer."
            }])
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <>
            {/* Floating Button */}
            <motion.button
                onClick={() => setIsOpen(true)}
                className={`fixed bottom-6 right-6 z-40 p-4 rounded-full bg-red-600 hover:bg-red-500 text-white shadow-lg transition-colors ${isOpen ? 'hidden' : ''}`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
            >
                <div className="relative">
                    <MessageCircle className="w-6 h-6" />
                    <Sparkles className="w-3 h-3 absolute -top-1 -right-1 text-yellow-300" />
                </div>
            </motion.button>

            {/* Chat Window */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        className="fixed bottom-6 right-6 z-50 w-[380px] max-w-[calc(100vw-48px)] bg-[#0a0a0f] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
                        style={{ height: "min(500px, calc(100vh - 100px))" }}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-gradient-to-r from-red-600/10 to-transparent">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                                    <Bot className="w-5 h-5 text-red-400" />
                                </div>
                                <div>
                                    <h3 className="font-display font-bold text-white">Medibot</h3>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {messages.length === 0 && (
                                <div className="text-center py-8">
                                    <Bot className="w-12 h-12 mx-auto text-gray-600 mb-3" />
                                    <p className="text-gray-500 text-sm">
                                        Posez-moi une question sur le wiki !
                                    </p>
                                    <p className="text-gray-600 text-xs mt-2">
                                        Ex: "Quelle est la procédure pour..."
                                    </p>
                                </div>
                            )}

                            {messages.map((msg, i) => (
                                <div
                                    key={i}
                                    className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                                >
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === "user"
                                        ? "bg-blue-500/20"
                                        : "bg-red-500/20"
                                        }`}>
                                        {msg.role === "user"
                                            ? <User className="w-4 h-4 text-blue-400" />
                                            : <Bot className="w-4 h-4 text-red-400" />
                                        }
                                    </div>
                                    <div className={`max-w-[80%] p-3 rounded-xl text-sm ${msg.role === "user"
                                        ? "bg-blue-500/20 text-white"
                                        : "bg-white/5 text-gray-300"
                                        }`}>
                                        <p className="whitespace-pre-wrap">{msg.content}</p>
                                    </div>
                                </div>
                            ))}

                            {isLoading && (
                                <div className="flex gap-3">
                                    <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
                                        <Bot className="w-4 h-4 text-red-400" />
                                    </div>
                                    <div className="bg-white/5 p-3 rounded-xl">
                                        <Loader2 className="w-5 h-5 animate-spin text-red-400" />
                                    </div>
                                </div>
                            )}

                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input */}
                        <form onSubmit={handleSubmit} className="p-4 border-t border-white/10">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder="Posez votre question..."
                                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-red-500/50"
                                    disabled={isLoading}
                                />
                                <button
                                    type="submit"
                                    disabled={!input.trim() || isLoading}
                                    className="p-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white transition-colors"
                                >
                                    <Send className="w-5 h-5" />
                                </button>
                            </div>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    )
}
