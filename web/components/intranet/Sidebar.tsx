"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
    Users,
    DollarSign,
    Pill,
    FileText,
    ChevronLeft,
    Home,
    Shield,
    Clock,
    UserCog,
    Book,
    CalendarDays,
    Menu,
    X,
    BarChart3,
    UserSearch,
    HelpCircle
} from "lucide-react"
import { useOnboardingActions } from "@/components/intranet/ClientWrapper"
import { AnimatedLogoutButton } from "@/components/ui/AnimatedButtons"
import { IGNModal } from "@/components/intranet/IGNModal"

interface SidebarProps {
    userRoles?: string[]
}

interface UserProfile {
    displayName: string
    avatarUrl: string | null
    gradeDisplay: string | null
    ign?: string | null
}

// Tous les grades EMS pour l'accès basique
const EMS_GRADES = ['direction', 'chirurgien', 'medecin', 'infirmier', 'ambulancier']

const GRADE_COLORS: Record<string, string> = {
    'Direction': 'text-red-400',
    'Chirurgien': 'text-purple-400',
    'Médecin': 'text-blue-400',
    'Infirmier': 'text-green-400',
    'Ambulancier': 'text-orange-400',
    'Recruteur': 'text-pink-400'
}

const menuItems = [
    {
        href: "/intranet",
        label: "Accueil",
        icon: Home,
        roles: [...EMS_GRADES, 'recruiter']
    },
    {
        href: "/intranet/services",
        label: "Mes Services",
        icon: Clock,
        roles: EMS_GRADES
    },
    {
        href: "/intranet/gestion-services",
        label: "Gestion Services",
        icon: UserCog,
        roles: ['direction']
    },
    {
        href: "/intranet/dashboard",
        label: "Dashboard",
        icon: BarChart3,
        roles: ['direction']
    },
    {
        href: "/intranet/planning",
        label: "Planning",
        icon: CalendarDays,
        roles: [...EMS_GRADES, 'recruiter']
    },
    {
        href: "/intranet/candidatures",
        label: "Candidatures",
        icon: Users,
        roles: ['recruiter', 'direction']
    },
    {
        href: "/intranet/tarifs",
        label: "Tarifs",
        icon: DollarSign,
        roles: [...EMS_GRADES, 'recruiter']
    },
    {
        href: "/intranet/medicaments",
        label: "Médicaments",
        icon: Pill,
        roles: [...EMS_GRADES, 'recruiter']
    },
    {
        href: "/intranet/ordonnance",
        label: "Ordonnance",
        icon: FileText,
        roles: [...EMS_GRADES]
    },
    {
        href: "/intranet/patients",
        label: "Patients",
        icon: UserSearch,
        roles: [...EMS_GRADES]
    },
    {
        href: "/intranet/wiki",
        label: "Wiki",
        icon: Book,
        roles: [...EMS_GRADES, 'recruiter']
    },
    {
        href: "/intranet/reglement",
        label: "Règlement",
        icon: FileText,
        roles: [...EMS_GRADES, 'recruiter']
    },
    {
        href: "/intranet/salaires",
        label: "Salaires",
        icon: DollarSign,
        roles: ['direction']
    },
    {
        href: "/intranet/permissions",
        label: "Permissions",
        icon: Shield,
        roles: ['direction']
    },
]

// Composant bouton Tutoriel
function TutorialButton({ collapsed }: { collapsed: boolean }) {
    const { resetOnboarding } = useOnboardingActions()

    return (
        <button
            onClick={resetOnboarding}
            className="w-full flex items-center px-3 py-2 rounded-md text-gray-500 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
            data-onboarding="tutorial-btn"
        >
            <HelpCircle className="w-5 h-5 flex-shrink-0" />
            {!collapsed && (
                <span className="ml-3 font-sans text-sm font-medium">
                    Tutoriel
                </span>
            )}
        </button>
    )
}

export function Sidebar({ userRoles = [] }: SidebarProps) {
    const [collapsed, setCollapsed] = useState(false)
    const [mobileOpen, setMobileOpen] = useState(false)
    const pathname = usePathname()
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
    const [ignModalOpen, setIgnModalOpen] = useState(false)

    // Fermer le menu mobile lors du changement de page
    useEffect(() => {
        setMobileOpen(false)
    }, [pathname])

    useEffect(() => {
        async function fetchProfile() {
            try {
                const res = await fetch('/api/user/profile')
                if (res.ok) {
                    const data = await res.json()
                    setUserProfile({
                        displayName: data.displayName,
                        avatarUrl: data.avatarUrl,
                        gradeDisplay: data.gradeDisplay,
                        ign: data.ign
                    })
                }
            } catch (e) {
                console.error('Erreur fetch profile:', e)
            }
        }
        fetchProfile()
        // Aussi récupérer l'IGN séparément si pas dans le profile
        async function fetchIgn() {
            try {
                const res = await fetch('/api/user/ign')
                if (res.ok) {
                    const data = await res.json()
                    setUserProfile(prev => prev ? { ...prev, ign: data.ign } : prev)
                }
            } catch (e) {
                console.error('Erreur fetch IGN:', e)
            }
        }
        fetchIgn()
    }, [])

    // Filtrer les items selon les rôles
    const visibleItems = menuItems.filter(item => {
        return item.roles.some(role => userRoles.includes(role))
    })

    // Contenu de la sidebar (partagé entre desktop et mobile)
    const SidebarContent = ({ isMobile = false }: { isMobile?: boolean }) => (
        <>
            {/* Header avec Logo */}
            <div className="h-16 flex items-center justify-between px-4 border-b border-[#2a2a2a]">
                <div className="flex items-center">
                    <Image
                        src="/logo_phmc.webp"
                        alt="PHMC Logo"
                        width={40}
                        height={40}
                        className="flex-shrink-0"
                    />
                    {(isMobile || !collapsed) && (
                        <div className="ml-3 flex flex-col">
                            <span className="font-display font-bold text-sm tracking-wide leading-none">
                                PILLBOX HILL
                            </span>
                            <span className="text-[10px] text-red-500 tracking-[0.15em]">
                                INTRANET
                            </span>
                        </div>
                    )}
                </div>
                {isMobile && (
                    <button
                        onClick={() => setMobileOpen(false)}
                        className="p-2 text-gray-400 hover:text-white"
                    >
                        <X className="w-5 h-5" />
                    </button>
                )}
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto py-4" data-onboarding="sidebar-nav">
                <ul className="space-y-1 px-2">
                    {visibleItems.map((item) => {
                        const isActive = pathname === item.href
                        return (
                            <li key={item.href}>
                                <Link href={item.href} onClick={() => isMobile && setMobileOpen(false)}>
                                    <div
                                        className={`
                                        relative flex items-center px-3 py-2.5 rounded-md transition-colors
                                        ${isActive
                                                ? 'bg-red-500/10 text-red-400'
                                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                                            }
                                    `}>
                                        {/* Active indicator bar */}
                                        {isActive && (
                                            <div
                                                className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[60%] bg-gradient-to-b from-red-500 to-red-400 rounded-r-full"
                                                style={{ boxShadow: '0 0 12px rgba(220, 38, 38, 0.5)' }}
                                            />
                                        )}
                                        <item.icon className="w-5 h-5 flex-shrink-0" />
                                        {(isMobile || !collapsed) && (
                                            <span className="ml-3 font-sans text-sm font-medium">
                                                {item.label}
                                            </span>
                                        )}
                                        {item.roles.length === 1 && item.roles[0] === 'direction' && (isMobile || !collapsed) && (
                                            <Shield className="w-3 h-3 ml-auto text-gray-600" />
                                        )}
                                    </div>
                                </Link>
                            </li>
                        )
                    })}
                    {/* Tutoriel - en bas de la navigation */}
                    <li className="pt-2 mt-2 border-t border-[#2a2a2a]">
                        <TutorialButton collapsed={!isMobile && collapsed} />
                    </li>
                </ul>
            </nav>

            {/* Profil Utilisateur - Cliquable pour configurer l'IGN */}
            {userProfile && (
                <div className={`px-3 py-3 border-t border-[#2a2a2a] ${!isMobile && collapsed ? 'flex justify-center' : ''}`}>
                    <button
                        onClick={() => setIgnModalOpen(true)}
                        className="flex items-center gap-3 w-full text-left hover:bg-white/5 rounded-lg p-1 -m-1 transition-colors group"
                        title="Configurer votre nom RP (In-Game)"
                    >
                        {userProfile.avatarUrl ? (
                            <img
                                src={userProfile.avatarUrl}
                                alt={userProfile.displayName}
                                loading="lazy"
                                className="w-10 h-10 rounded-full flex-shrink-0 border-2 border-[#2a2a2a] group-hover:border-red-500/50 transition-colors"
                            />
                        ) : (
                            <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                                <span className="font-bold text-red-400">
                                    {userProfile.displayName.charAt(0).toUpperCase()}
                                </span>
                            </div>
                        )}
                        {(isMobile || !collapsed) && (
                            <div className="flex-1 min-w-0">
                                <p className="font-display font-bold text-sm text-white truncate">
                                    {userProfile.displayName}
                                </p>
                                {userProfile.ign ? (
                                    <p className="text-xs text-gray-400 truncate">
                                        🎮 {userProfile.ign}
                                    </p>
                                ) : userProfile.gradeDisplay ? (
                                    <p className={`text-xs ${GRADE_COLORS[userProfile.gradeDisplay] || 'text-gray-500'}`}>
                                        {userProfile.gradeDisplay}
                                    </p>
                                ) : (
                                    <p className="text-xs text-yellow-500">
                                        ⚠️ Configurer nom RP
                                    </p>
                                )}
                            </div>
                        )}
                    </button>
                </div>
            )}

            {/* Footer */}
            <div className="p-3 border-t border-[#2a2a2a] flex items-center justify-between">
                <AnimatedLogoutButton collapsed={!isMobile && collapsed} size="sm" />

                {!isMobile && (
                    <button
                        onClick={() => setCollapsed(!collapsed)}
                        className="p-2 text-gray-600 hover:text-white transition-colors rounded-md hover:bg-white/5"
                    >
                        <motion.div animate={{ rotate: collapsed ? 180 : 0 }}>
                            <ChevronLeft className="w-4 h-4" />
                        </motion.div>
                    </button>
                )}
            </div>
        </>
    )

    return (
        <>
            {/* Mobile Header Bar */}
            <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-[#0a0a0a] border-b border-[#2a2a2a] z-40 flex items-center px-4">
                <button
                    onClick={() => setMobileOpen(true)}
                    className="p-2 text-gray-400 hover:text-white -ml-2"
                >
                    <Menu className="w-6 h-6" />
                </button>
                <div className="flex items-center ml-2">
                    <Image
                        src="/logo_phmc.webp"
                        alt="PHMC"
                        width={32}
                        height={32}
                    />
                    <span className="ml-2 font-display font-bold text-sm">PHMC</span>
                </div>
            </div>

            {/* Mobile Sidebar Overlay */}
            <AnimatePresence>
                {mobileOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setMobileOpen(false)}
                            className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
                        />
                        {/* Mobile Sidebar */}
                        <motion.aside
                            initial={{ x: -280 }}
                            animate={{ x: 0 }}
                            exit={{ x: -280 }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            className="md:hidden fixed left-0 top-0 bottom-0 w-[280px] bg-[#0a0a0a] border-r border-[#2a2a2a] flex flex-col z-50"
                        >
                            <SidebarContent isMobile />
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>

            {/* Desktop Sidebar */}
            <motion.aside
                initial={false}
                animate={{ width: collapsed ? 80 : 280 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="hidden md:flex fixed left-0 top-0 bottom-0 bg-[#0a0a0a] border-r border-[#2a2a2a] flex-col z-50"
            >
                <SidebarContent />
            </motion.aside>

            {/* Modal IGN */}
            <IGNModal
                isOpen={ignModalOpen}
                onClose={() => setIgnModalOpen(false)}
                currentIgn={userProfile?.ign}
                onSuccess={(newIgn) => {
                    setUserProfile(prev => prev ? { ...prev, ign: newIgn } : prev)
                }}
            />
        </>
    )
}
