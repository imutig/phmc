"use client";

import { Modal } from "@/components/ui/Modal";
import { motion } from "framer-motion";
import { HeartPulse, Stethoscope, Users, ArrowLeft, ChevronRight, Ambulance, Heart, Syringe } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function EMSPage() {
    const router = useRouter();
    const [isModalOpen, setIsModalOpen] = useState(false);

    const features = [
        { icon: Heart, title: "Soins d'Urgence", desc: "Premiers secours et réanimation sur le terrain." },
        { icon: Users, title: "Travail d'Équipe", desc: "Collaboration étroite avec tous les services d'urgence." },
        { icon: Stethoscope, title: "Expertise Médicale", desc: "Formation continue et protocoles de soins avancés." },
    ];

    const units = [
        { icon: Ambulance, title: "Ambulanciers", desc: "Transport et soins pré-hospitaliers.", color: "red" },
        { icon: Syringe, title: "Médecins Urgentistes", desc: "Interventions médicales avancées.", color: "red" },
        { icon: HeartPulse, title: "Équipe de Réanimation", desc: "Gestion des urgences vitales.", color: "red" },
    ];

    const handleApplyClick = () => {
        setIsModalOpen(true);
    };

    const handleConfirmPrerequisites = () => {
        setIsModalOpen(false);
        router.push("/candidature?service=ems");
    };

    return (
        <>
            <main className="min-h-screen bg-[#0a0a0a] text-white">
                {/* Navigation */}
                <nav className="fixed w-full z-40 py-6 px-8 border-b border-red-500/20 backdrop-blur-sm bg-black/50">
                    <div className="max-w-7xl mx-auto flex justify-between items-center">
                        <Link href="/" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
                            <ArrowLeft className="w-5 h-5" />
                            <span className="font-sans text-sm">Retour</span>
                        </Link>
                        <div className="text-red-400 font-display font-bold tracking-widest text-sm">EMS RECRUITMENT</div>
                    </div>
                </nav>

                {/* Hero Section */}
                <header className="relative h-screen flex items-center bg-cover bg-center" style={{
                    backgroundImage: "linear-gradient(to bottom, rgba(127, 29, 29, 0.3), rgba(10,10,10,1)), url('/phmc_image1.png')"
                }}>
                    <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-12 items-center pt-20">
                        <motion.div
                            initial={{ opacity: 0, x: -50 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.8 }}
                        >
                            <div className="mb-4 inline-block px-4 py-1 border border-red-500/50 bg-red-500/10 rounded backdrop-blur-md">
                                <span className="text-red-400 text-xs font-bold tracking-widest uppercase">Pillbox Hill Medical Center</span>
                            </div>

                            <h1 className="font-display text-6xl md:text-8xl font-bold uppercase tracking-tighter mb-4">
                                EMS
                            </h1>
                            <h2 className="font-display text-2xl md:text-3xl text-red-400 mb-8 tracking-widest uppercase">
                                Sauver des Vies
                            </h2>
                            <p className="font-sans text-gray-300 text-lg leading-relaxed mb-8 max-w-lg">
                                Le Pillbox Hill Medical Center recherche des professionnels dévoués pour rejoindre nos équipes médicales d'urgence. Une carrière au service des citoyens de San Andreas.
                            </p>

                            <button
                                onClick={handleApplyClick}
                                className="group relative px-8 py-4 bg-red-600 hover:bg-red-500 transition-all overflow-hidden font-display font-bold tracking-widest uppercase btn-primary"
                            >
                                <span className="relative z-10 flex items-center gap-2">
                                    Postuler Maintenant
                                    <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                </span>
                            </button>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.8, delay: 0.2 }}
                            className="hidden md:flex justify-center items-center"
                        >
                            <div className="relative">
                                <div className="absolute inset-0 bg-red-500/20 blur-3xl rounded-full" />
                                <HeartPulse className="w-64 h-64 text-red-900/80 drop-shadow-2xl" strokeWidth={0.5} />
                            </div>
                        </motion.div>
                    </div>
                </header>

                {/* Features Grid */}
                <section className="py-20 bg-[#050505] border-y border-red-500/10">
                    <div className="max-w-7xl mx-auto px-6">
                        <div className="grid md:grid-cols-3 gap-8">
                            {features.map((feature, idx) => (
                                <motion.div
                                    key={idx}
                                    initial={{ opacity: 0, y: 20 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: idx * 0.1 }}
                                    className="p-6 border border-red-500/10 bg-white/[0.02] hover:bg-red-500/5 transition-colors"
                                >
                                    <feature.icon className="w-10 h-10 text-red-500 mb-4" />
                                    <h3 className="font-display text-xl font-bold mb-2 uppercase">{feature.title}</h3>
                                    <p className="font-sans text-gray-400 text-sm">{feature.desc}</p>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Specializations */}
                <section className="py-24 bg-[#0a0a0a]">
                    <div className="max-w-7xl mx-auto px-6">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            className="mb-12"
                        >
                            <h2 className="font-display text-4xl font-bold uppercase mb-2">Postes Disponibles</h2>
                            <div className="h-1 w-24 bg-red-600" />
                            <p className="mt-4 text-gray-400 font-sans max-w-2xl">
                                Commencez comme ambulancier et évoluez vers des postes à responsabilités au sein de notre équipe médicale.
                            </p>
                        </motion.div>

                        <div className="space-y-4">
                            {units.map((unit, idx) => (
                                <motion.div
                                    key={idx}
                                    initial={{ opacity: 0, x: -20 }}
                                    whileInView={{ opacity: 1, x: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: idx * 0.1 }}
                                    className="flex items-center gap-4 p-4 border-l-4 border-red-600 bg-white/5 hover:bg-white/10 transition-colors"
                                >
                                    <div className="p-3 rounded-full bg-red-600/20">
                                        <unit.icon className="w-5 h-5 text-red-400" />
                                    </div>
                                    <div>
                                        <h4 className="font-display font-bold text-lg">{unit.title}</h4>
                                        <p className="text-xs text-gray-500">{unit.desc}</p>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>

            </main>

            {/* Prerequisites Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title="Conditions d'accès aux EMS"
                footer={
                    <div className="flex justify-end gap-3">
                        <button
                            onClick={() => setIsModalOpen(false)}
                            className="px-4 py-2 text-gray-400 hover:text-white transition-colors font-sans"
                        >
                            Annuler
                        </button>
                        <button
                            onClick={handleConfirmPrerequisites}
                            className="bg-red-600 hover:bg-red-500 text-white px-6 py-2 font-display font-bold tracking-widest uppercase transition-colors"
                        >
                            Confirmer
                        </button>
                    </div>
                }
            >
                <div className="space-y-4 text-gray-300 font-sans">
                    <p className="text-sm border-l-2 border-red-500 pl-4 italic">
                        L'intégration aux EMS du Pillbox Hill Medical Center requiert dévouement et professionnalisme. Confirmez les points suivants :
                    </p>
                    <ul className="space-y-3 list-disc pl-5 text-sm">
                        <li>Être âgé d'au moins <span className="text-white font-bold">21 ans</span>.</li>
                        <li>Aucun antécédent judiciaire majeur.</li>
                        <li>Disponibilité minimale de <span className="text-white font-bold">5h/semaine</span>.</li>
                        <li>Capacité à garder son sang-froid en situation d'urgence.</li>
                    </ul>
                    <div className="bg-red-900/20 p-4 rounded-lg mt-4 border border-red-500/20">
                        <p className="text-xs text-red-400">
                            ⚠️ Toute fausse déclaration lors de l'entretien entraînera un refus définitif.
                        </p>
                    </div>
                </div>
            </Modal>
        </>
    );
}
