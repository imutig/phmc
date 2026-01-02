"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import Link from "next/link";
import { ChevronDown, Heart, Clock, Users, GraduationCap, LayoutDashboard, LogOut, Sparkles, Stethoscope, Ambulance, HeartPulse, AlertTriangle, X, ArrowRight } from "lucide-react";
import { useSession, signIn, signOut } from "next-auth/react";
import { useRef, useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { SnowEffect } from "@/components/ui/SnowEffect";
import { HorizontalScrollSection, HorizontalSlide } from "@/components/ui/HorizontalScrollSection";
import { TextReveal } from "@/components/ui/TextReveal";
import { MagneticButton } from "@/components/ui/MagneticButton";
import { ParallaxBackground } from "@/components/ui/ParallaxSection";

// Animation variants
const fadeInUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0 }
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: { opacity: 1, scale: 1 }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2
    }
  }
};

// Composant séparé pour gérer useSearchParams (requis par Next.js)
function SearchParamsHandler({ onAccessDenied }: { onAccessDenied: () => void }) {
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get('error') === 'no_access') {
      onAccessDenied();
      window.history.replaceState({}, '', '/');
    }
  }, [searchParams, onAccessDenied]);

  return null;
}

function HomeContent() {
  const { data: session, status } = useSession();
  const isAuthenticated = status === "authenticated";
  const heroRef = useRef(null);
  const [showAccessDenied, setShowAccessDenied] = useState(false);

  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"]
  });

  const heroY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);


  return (
    <>
      <SnowEffect />
      <Suspense fallback={null}>
        <SearchParamsHandler onAccessDenied={() => setShowAccessDenied(true)} />
      </Suspense>
      {/* Modal Accès Refusé */}
      {showAccessDenied && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative bg-[#141414] border border-red-500/30 p-8 max-w-md mx-4 rounded-lg"
          >
            <button
              onClick={() => setShowAccessDenied(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-red-500/20 rounded-full">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
              <h2 className="font-display text-2xl font-bold text-white uppercase">
                Accès Refusé
              </h2>
            </div>

            <p className="text-gray-400 mb-6">
              Vous n'avez pas les permissions nécessaires pour accéder à l'intranet du staff.
              L'accès est réservé aux membres du personnel médical du PHMC.
            </p>

            <p className="text-sm text-gray-500 mb-6">
              Si vous êtes employé et que vous voyez ce message, veuillez contacter la direction
              pour vérifier la configuration de votre rôle Discord.
            </p>

            <button
              onClick={() => setShowAccessDenied(false)}
              className="w-full px-4 py-3 bg-red-600 hover:bg-red-500 text-white font-display font-bold uppercase tracking-wider transition-colors"
            >
              Compris
            </button>
          </motion.div>
        </motion.div>
      )}

      {/* Navigation */}
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="fixed w-full z-40 py-6 px-8 border-b border-red-500/20 backdrop-blur-sm bg-black/50"
      >
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <motion.div
            className="flex items-center gap-3"
            whileHover={{ scale: 1.02 }}
            transition={{ type: "spring", stiffness: 400 }}
          >
            <HeartPulse className="w-8 h-8 text-red-500" strokeWidth={1.5} />
            <div className="flex flex-col">
              <span className="font-display font-bold text-xl tracking-wider leading-none">PILLBOX HILL</span>
              <span className="font-sans text-xs text-red-400 tracking-[0.2em]">MEDICAL CENTER</span>
            </div>
          </motion.div>
          <div className="hidden md:flex gap-8 font-sans text-sm font-semibold tracking-wide">
            {["SERVICES", "PROCESSUS", "SUIVI"].map((item, i) => (
              <motion.div
                key={item}
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.1 }}
              >
                <Link
                  href={item === "SUIVI" ? "/suivi" : `#${item === "SERVICES" ? "services" : "process"}`}
                  className="relative link-hover hover:text-red-400 transition-colors"
                >
                  {item}
                </Link>
              </motion.div>
            ))}
          </div>

          {/* Auth Buttons */}
          <div className="flex items-center gap-2 md:gap-3">
            {isAuthenticated ? (
              <>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Link
                    href="/intranet"
                    className="px-3 md:px-4 py-2 bg-red-600 hover:bg-red-500 transition-all font-display font-bold tracking-widest text-sm uppercase flex items-center gap-2 btn-magnetic"
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    <span className="hidden md:inline">Accès Staff</span>
                  </Link>
                </motion.div>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => signOut()}
                  className="px-3 md:px-4 py-2 border border-white/30 hover:bg-red-600 hover:border-red-600 transition-all font-display font-bold tracking-widest text-sm uppercase flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden md:inline">Déconnexion</span>
                </motion.button>
              </>
            ) : (
              <motion.button
                whileHover={{ scale: 1.05, boxShadow: "0 0 30px rgba(16, 185, 129, 0.3)" }}
                whileTap={{ scale: 0.95 }}
                onClick={() => signIn("discord", { callbackUrl: "/intranet" })}
                className="px-4 md:px-6 py-2 border border-red-500/30 hover:bg-red-500 hover:text-black transition-all font-display font-bold tracking-widest text-xs md:text-sm uppercase"
              >
                Accès Staff
              </motion.button>
            )}
          </div>
        </div>
      </motion.nav>

      {/* Hero Section */}
      <header ref={heroRef} className="relative h-screen flex items-center justify-center bg-cover bg-center bg-fixed overflow-hidden" style={{
        backgroundImage: "linear-gradient(to bottom, rgba(10,10,10,0.7), rgba(10,10,10,1)), url('/phmc_image2.png')"
      }}>
        <div className="absolute inset-0 bg-black/40" />

        <motion.div
          style={{ y: heroY, opacity: heroOpacity }}
          className="relative z-10 max-w-5xl mx-auto px-6 text-center"
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="mb-4 inline-block px-4 py-1 border border-red-500/50 bg-red-500/10 rounded backdrop-blur-md"
          >
            <span className="text-red-400 text-xs font-bold tracking-widest uppercase flex items-center gap-2">
              <motion.span
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-2 h-2 bg-red-400 rounded-full"
              />
              Recrutements Ouverts - Session 2025
              <Sparkles className="w-3 h-3" />
            </span>
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.8, ease: "easeOut" }}
            className="font-display text-6xl md:text-8xl font-bold uppercase tracking-tighter mb-6 leading-tight"
          >
            <motion.span
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="block"
            >
              Soignez.
            </motion.span>
            <motion.span
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5, duration: 0.6 }}
              className="block text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-white to-teal-500"
            >
              Sauvez.
            </motion.span>
            <motion.span
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7, duration: 0.6 }}
              className="block"
            >
              Protégez.
            </motion.span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9, duration: 0.6 }}
            className="font-sans text-gray-300 text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            Le Pillbox Hill Medical Center recherche des professionnels dévoués
            prêts à sauver des vies sur les routes de San Andreas.
            Votre vocation commence ici.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1, duration: 0.6 }}
            className="flex flex-col md:flex-row gap-4 justify-center"
          >
            <motion.div whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.95 }}>
              <Link href="/ems">
                <button className="group relative px-8 py-4 bg-red-600 hover:bg-red-500 transition-all overflow-hidden font-display font-bold tracking-widest uppercase btn-primary">
                  <span className="relative z-10 flex items-center gap-2">
                    Rejoindre les EMS
                    <motion.div
                      animate={{ y: [0, 5, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </motion.div>
                  </span>
                </button>
              </Link>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.95 }}>
              <Link href="/suivi">
                <button className="px-8 py-4 border border-white/30 hover:border-red-500/50 hover:bg-red-500/5 transition-all font-display font-bold tracking-widest uppercase ripple">
                  Suivre ma candidature
                </button>
              </Link>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.95 }}>
              <Link href="/rendez-vous">
                <button className="px-8 py-4 border border-emerald-500/50 bg-emerald-500/10 hover:bg-emerald-500/20 transition-all font-display font-bold tracking-widest uppercase ripple text-emerald-400">
                  <span className="flex items-center gap-2">
                    <HeartPulse className="w-4 h-4" />
                    Prendre Rendez-vous
                  </span>
                </button>
              </Link>
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="w-6 h-10 border-2 border-red-500/30 rounded-full flex justify-center pt-2"
          >
            <motion.div
              animate={{ opacity: [0.5, 1, 0.5], height: ["10px", "15px", "10px"] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="w-1.5 bg-red-500/50 rounded-full"
            />
          </motion.div>
        </motion.div>
      </header>

      {/* Services Section */}
      <section id="services" className="py-32 px-6 bg-[#0a0a0a]">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={fadeInUp}
            transition={{ duration: 0.6 }}
            className="text-center mb-20"
          >
            <span className="text-red-400 text-xs font-bold tracking-widest uppercase block mb-4">Services Médicaux d'Urgence</span>
            <h2 className="font-display text-5xl md:text-6xl font-bold uppercase tracking-tighter">
              Pillbox Hill<br />Medical Center
            </h2>
          </motion.div>

          {/* Single EMS Card - Full Width */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={fadeInUp}
            transition={{ duration: 0.6 }}
            className="group relative overflow-hidden max-w-4xl mx-auto"
          >
            <Link href="/ems">
              <motion.div
                whileHover={{ scale: 1.02 }}
                transition={{ type: "spring", stiffness: 300 }}
                className="relative h-[500px] border border-red-500/20 bg-gradient-to-b from-red-900/20 to-black/50 p-8 flex flex-col justify-end hover:border-red-500/50 transition-all cursor-pointer card-hover overflow-hidden"
              >
                {/* Background Image */}
                <div
                  className="absolute inset-0 bg-cover bg-center opacity-30 group-hover:opacity-40 transition-opacity"
                  style={{ backgroundImage: "url('/phmc_image1.png')" }}
                />
                <motion.div
                  animate={{ rotate: [0, 5, -5, 0] }}
                  transition={{ duration: 6, repeat: Infinity }}
                  className="absolute top-6 right-6"
                >
                  <Ambulance className="w-20 h-20 text-red-500/30" strokeWidth={1} />
                </motion.div>
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-transparent opacity-80" />
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-4">
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: 48 }}
                      transition={{ duration: 0.6 }}
                      className="h-1 bg-red-500"
                    />
                    <span className="text-red-400 text-xs font-bold tracking-widest uppercase">Emergency Medical Services</span>
                  </div>
                  <h3 className="font-display text-4xl font-bold uppercase tracking-tight mb-4">EMS</h3>
                  <p className="font-sans text-gray-400 mb-6 max-w-xl">
                    Premiers secours, interventions d'urgence, soins pré-hospitaliers.
                    Sauvez des vies sur les routes de San Andreas au sein d'une équipe soudée et professionnelle.
                  </p>
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2 text-sm text-red-400">
                      <Stethoscope className="w-4 h-4" />
                      <span>Soins d'urgence</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-red-400">
                      <Heart className="w-4 h-4" />
                      <span>Réanimation</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-red-400">
                      <Ambulance className="w-4 h-4" />
                      <span>Transport médicalisé</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-red-400 font-bold tracking-widest uppercase mt-6 group-hover:gap-4 transition-all">
                    <span>Postuler maintenant</span>
                    <motion.div
                      animate={{ x: [0, 5, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      <ChevronDown className="w-4 h-4 -rotate-90" />
                    </motion.div>
                  </div>
                </div>
              </motion.div>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Horizontal Scroll Section - Nos Valeurs */}
      <HorizontalScrollSection scrollMultiplier={4} slideCount={2} className="bg-[#0a0a0a]">
        <HorizontalSlide className="px-6">
          <div className="max-w-4xl text-center">
            <span className="text-red-400 text-xs font-bold tracking-widest uppercase mb-4 block">Notre Mission</span>
            <h2 className="font-display text-5xl md:text-7xl font-bold uppercase tracking-tighter mb-6">Excellence Médicale</h2>
            <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto">
              Chaque seconde compte. Notre équipe d'élite intervient avec rapidité et précision pour sauver des vies.
            </p>
          </div>
        </HorizontalSlide>

        <HorizontalSlide className="px-6">
          <div className="max-w-4xl text-center">
            <span className="text-red-400 text-xs font-bold tracking-widest uppercase mb-4 block">Notre Équipe</span>
            <h2 className="font-display text-5xl md:text-7xl font-bold uppercase tracking-tighter mb-6">Professionnels Passionnés</h2>
            <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto">
              Des ambulanciers aux chirurgiens, chaque membre partage la même passion : protéger les citoyens de San Andreas.
            </p>
          </div>
        </HorizontalSlide>
      </HorizontalScrollSection>

      {/* Vertical Section - Carrière (ancienne slide 3) */}
      <section className="py-32 px-6 bg-[#0a0a0a] border-t border-white/5">
        <div className="max-w-4xl mx-auto text-center">
          <span className="text-red-400 text-xs font-bold tracking-widest uppercase mb-4 block">Votre Avenir</span>
          <h2 className="font-display text-5xl md:text-7xl font-bold uppercase tracking-tighter mb-6">Carrière d'Exception</h2>
          <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto mb-8">
            Formation continue, évolution de carrière, et une équipe soudée. Votre vocation commence ici.
          </p>
          <Link href="/ems">
            <MagneticButton className="px-8 py-4 bg-red-600 hover:bg-red-500 transition-all font-display font-bold tracking-widest uppercase inline-flex items-center gap-2">
              Commencer l'aventure
              <ArrowRight className="w-4 h-4" />
            </MagneticButton>
          </Link>
        </div>
      </section>

      {/* Text Reveal Section */}
      <section className="py-32 px-6 bg-[#050505]">
        <div className="max-w-4xl mx-auto text-center">
          <TextReveal className="font-display text-3xl md:text-5xl font-bold uppercase tracking-tighter leading-tight">
            Rejoignez une équipe qui fait la différence chaque jour. Votre expertise peut sauver des vies.
          </TextReveal>
        </div>
      </section>

      {/* Process Section */}
      <section id="process" className="py-32 px-6 bg-[#080808]">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={fadeInUp}
            transition={{ duration: 0.6 }}
            className="text-center mb-20"
          >
            <span className="text-red-400 text-xs font-bold tracking-widest uppercase block mb-4">Déroulement</span>
            <h2 className="font-display text-5xl md:text-6xl font-bold uppercase tracking-tighter">
              Processus de Recrutement
            </h2>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={staggerContainer}
            className="grid md:grid-cols-4 gap-8"
          >
            {[
              { icon: Clock, title: "Candidature", desc: "Remplissez le formulaire en ligne avec vos informations." },
              { icon: Users, title: "Examen", desc: "Notre équipe examine votre dossier sous 48h." },
              { icon: GraduationCap, title: "Entretien", desc: "Passage devant un jury de recrutement médical." },
              { icon: HeartPulse, title: "Formation", desc: "Formation aux gestes de premiers secours et interventions." },
            ].map((step, idx) => (
              <motion.div
                key={idx}
                variants={scaleIn}
                whileHover={{ y: -10, transition: { duration: 0.2 } }}
                className="relative border border-white/10 bg-white/[0.02] p-6 hover:bg-red-500/5 hover:border-red-500/20 transition-colors tilt-hover"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  whileInView={{ scale: 1 }}
                  transition={{ delay: idx * 0.1 + 0.3, type: "spring", stiffness: 200 }}
                  className="absolute -top-4 -left-4 w-8 h-8 bg-red-600 flex items-center justify-center font-display font-bold"
                >
                  {idx + 1}
                </motion.div>
                <motion.div
                  animate={{ rotate: [0, 5, -5, 0] }}
                  transition={{ duration: 4, repeat: Infinity, delay: idx * 0.5 }}
                >
                  <step.icon className="w-10 h-10 text-red-500/30 mb-4" strokeWidth={1} />
                </motion.div>
                <h3 className="font-display text-xl font-bold uppercase mb-2">{step.title}</h3>
                <p className="font-sans text-gray-500 text-sm">{step.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <motion.footer
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="border-t border-red-500/20 py-8 px-6 bg-[#0a0a0a]"
      >
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <HeartPulse className="w-5 h-5 text-red-500/50" strokeWidth={1.5} />
            <span className="font-display text-sm tracking-widest text-gray-500">PILLBOX HILL MEDICAL CENTER</span>
          </div>
          <p className="font-mono text-xs text-gray-600">
            © 2025 PHMC // ALL RIGHTS RESERVED // SECURE CONNECTION
          </p>
        </div>
      </motion.footer>
    </>
  );
}

export default function Home() {
  return <HomeContent />;
}
