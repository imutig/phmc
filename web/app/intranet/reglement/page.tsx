"use client"

import { motion } from "framer-motion"
import { FileText, Clock, AlertTriangle, Users, CreditCard, MessageSquare, HeartPulse } from "lucide-react"

const sections = [
    {
        title: "Exercice des soins",
        icon: HeartPulse,
        color: "emerald",
        rules: [
            "Il est strictement interdit d'effectuer des soins en étant hors service (H.S.).",
            "Toute prise en charge médicale doit se faire en tenue réglementaire et pendant une période de service validée."
        ]
    },
    {
        title: "Matériel médical",
        icon: FileText,
        color: "blue",
        rules: [
            "La vente, l'échange ou le don de matériel médical est formellement interdit.",
            "Le matériel de l'hôpital est destiné exclusivement à un usage professionnel dans le cadre des soins."
        ]
    },
    {
        title: "Temps de service",
        icon: Clock,
        color: "purple",
        rules: [
            "Chaque membre du personnel doit assurer un minimum de 5 heures de service par semaine.",
            "En cas d'impossibilité, une justification ou une demande d'absence doit être transmise à la hiérarchie."
        ]
    },
    {
        title: "Comportement et respect",
        icon: Users,
        color: "teal",
        rules: [
            "Le respect est obligatoire envers tous : patients, collègues, membres des forces de l'ordre ou tout autre citoyen.",
            "Tout comportement insultant, provocateur ou dégradant entraînera des sanctions disciplinaires."
        ]
    },
    {
        title: "Absences et disponibilité",
        icon: MessageSquare,
        color: "orange",
        rules: [
            "Il est obligatoire de notifier toute absence, qu'elle soit ponctuelle ou prolongée.",
            "Les absences non déclarées pourront être considérées comme un abandon de poste."
        ]
    },
    {
        title: "Facturation des patients",
        icon: CreditCard,
        color: "green",
        rules: [
            "Chaque patient doit obligatoirement être facturé pour les soins reçus, selon les tarifs en vigueur.",
            "Les oublis répétés entraîneront un rappel et, si nécessaire, des mesures disciplinaires."
        ]
    }
]

const sanctions = [
    "Un avertissement",
    "Une suspension temporaire",
    "Une rupture du contrat de travail"
]

const colorClasses: Record<string, { bg: string; border: string; text: string; icon: string }> = {
    emerald: { bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-400", icon: "text-emerald-500" },
    blue: { bg: "bg-blue-500/10", border: "border-blue-500/30", text: "text-blue-400", icon: "text-blue-500" },
    purple: { bg: "bg-purple-500/10", border: "border-purple-500/30", text: "text-purple-400", icon: "text-purple-500" },
    teal: { bg: "bg-teal-500/10", border: "border-teal-500/30", text: "text-teal-400", icon: "text-teal-500" },
    orange: { bg: "bg-orange-500/10", border: "border-orange-500/30", text: "text-orange-400", icon: "text-orange-500" },
    green: { bg: "bg-green-500/10", border: "border-green-500/30", text: "text-green-400", icon: "text-green-500" },
}

export default function ReglementPage() {
    return (
        <div className="p-8 max-w-4xl mx-auto">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center mb-12"
            >
                <div className="flex items-center justify-center gap-3 mb-4">
                    <FileText className="w-10 h-10 text-emerald-500" />
                    <h1 className="font-display text-4xl font-bold uppercase tracking-tight">
                        Règlement Interne
                    </h1>
                </div>
                <p className="text-gray-400 font-sans text-lg">
                    Hôpital Pillbox Hill — Code de conduite du personnel médical
                </p>
            </motion.div>

            {/* Intro */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="mb-8 p-6 border border-emerald-500/30 bg-emerald-500/5 rounded-lg"
            >
                <p className="text-gray-300 font-sans leading-relaxed">
                    Afin d'assurer un environnement professionnel, sécurisé et respectueux pour les patients
                    comme pour le personnel, l'ensemble des employés de l'Hôpital Pillbox Hill s'engage
                    à respecter les règles suivantes :
                </p>
            </motion.div>

            {/* Sections */}
            <div className="space-y-6 mb-12">
                {sections.map((section, idx) => {
                    const colors = colorClasses[section.color]
                    return (
                        <motion.div
                            key={section.title}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.1 + idx * 0.1 }}
                            className={`border ${colors.border} ${colors.bg} p-6 rounded-lg`}
                        >
                            <div className="flex items-center gap-3 mb-4">
                                <section.icon className={`w-6 h-6 ${colors.icon}`} />
                                <h2 className={`font-display font-bold text-xl uppercase ${colors.text}`}>
                                    {section.title}
                                </h2>
                            </div>
                            <ul className="space-y-2">
                                {section.rules.map((rule, ruleIdx) => (
                                    <li key={ruleIdx} className="flex items-start gap-3 text-gray-300 font-sans">
                                        <span className={`${colors.text} mt-1`}>•</span>
                                        <span>{rule}</span>
                                    </li>
                                ))}
                            </ul>
                        </motion.div>
                    )
                })}
            </div>

            {/* Sanctions */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="border border-red-500/30 bg-red-500/5 p-6 rounded-lg"
            >
                <div className="flex items-center gap-3 mb-4">
                    <AlertTriangle className="w-6 h-6 text-red-500" />
                    <h2 className="font-display font-bold text-xl uppercase text-red-400">
                        Sanctions
                    </h2>
                </div>
                <p className="text-gray-300 font-sans mb-4">
                    Le non-respect de ce règlement pourra entraîner :
                </p>
                <ul className="space-y-2">
                    {sanctions.map((sanction, idx) => (
                        <li key={idx} className="flex items-center gap-3 text-red-300 font-sans">
                            <span className="w-6 h-6 flex items-center justify-center bg-red-500/20 text-red-400 text-sm font-bold rounded">
                                {idx + 1}
                            </span>
                            <span>{sanction}</span>
                        </li>
                    ))}
                </ul>
            </motion.div>

            {/* Footer */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
                className="mt-12 text-center text-gray-500 text-sm font-sans"
            >
                <p>Ce règlement est applicable à compter de l'intégration au personnel médical.</p>
                <p className="mt-1">Dernière mise à jour : Décembre 2025</p>
            </motion.div>
        </div>
    )
}
