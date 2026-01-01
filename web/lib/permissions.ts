// ============================================================
// SYSTÈME DE PERMISSIONS GRANULAIRES
// ============================================================

// Types de grades EMS
export type GradeType = 'direction' | 'chirurgien' | 'medecin' | 'infirmier' | 'ambulancier'

// Liste ordonnée des grades (hiérarchie)
export const GRADE_HIERARCHY: GradeType[] = ['direction', 'chirurgien', 'medecin', 'infirmier', 'ambulancier']

// Informations d'affichage des grades
export const GRADE_INFO: Record<GradeType, { name: string; color: string; bgColor: string }> = {
    direction: { name: 'Direction', color: 'text-red-400', bgColor: 'bg-red-500/20' },
    chirurgien: { name: 'Chirurgien', color: 'text-purple-400', bgColor: 'bg-purple-500/20' },
    medecin: { name: 'Médecin', color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
    infirmier: { name: 'Infirmier', color: 'text-green-400', bgColor: 'bg-green-500/20' },
    ambulancier: { name: 'Ambulancier', color: 'text-orange-400', bgColor: 'bg-orange-500/20' }
}

// ============================================================
// DÉFINITION DES PERMISSIONS
// ============================================================

export interface PermissionDefinition {
    key: string
    label: string
    description: string
    category: string
    defaultGrades: GradeType[] // Grades qui ont cette permission par défaut
}

export interface PermissionCategory {
    id: string
    label: string
    icon: string
    description: string
}

// Catégories de permissions
export const PERMISSION_CATEGORIES: PermissionCategory[] = [
    { id: 'services', label: 'Services', icon: '⏱️', description: 'Gestion des prises de service' },
    { id: 'medications', label: 'Médicaments', icon: '💊', description: 'Base de données des médicaments' },
    { id: 'tarifs', label: 'Tarifs', icon: '💰', description: 'Grille tarifaire des soins' },
    { id: 'ordonnance', label: 'Ordonnances', icon: '📋', description: 'Création d\'ordonnances' },
    { id: 'wiki', label: 'Wiki', icon: '📖', description: 'Documentation interne' },
    { id: 'planning', label: 'Planning', icon: '📅', description: 'Calendrier des événements' },
    { id: 'candidatures', label: 'Candidatures', icon: '👥', description: 'Gestion des recrutements' },
    { id: 'admin', label: 'Administration', icon: '⚙️', description: 'Configuration du système' }
]

// Toutes les permissions avec leurs paramètres par défaut
export const ALL_PERMISSIONS: PermissionDefinition[] = [
    // === SERVICES ===
    {
        key: 'services.view',
        label: 'Voir ses services',
        description: 'Consulter l\'historique de ses propres prises de service',
        category: 'services',
        defaultGrades: ['direction', 'chirurgien', 'medecin', 'infirmier', 'ambulancier']
    },
    {
        key: 'services.add',
        label: 'Ajouter des services',
        description: 'Déclarer manuellement une prise de service',
        category: 'services',
        defaultGrades: ['direction', 'chirurgien', 'medecin', 'infirmier', 'ambulancier']
    },
    {
        key: 'services.live',
        label: 'Service en direct',
        description: 'Utiliser le bouton de prise de service en temps réel',
        category: 'services',
        defaultGrades: ['direction', 'chirurgien', 'medecin', 'infirmier', 'ambulancier']
    },
    {
        key: 'services.manage_all',
        label: 'Gérer tous les services',
        description: 'Voir, modifier et supprimer les services de tous les employés',
        category: 'services',
        defaultGrades: ['direction']
    },

    // === MÉDICAMENTS ===
    {
        key: 'medications.view',
        label: 'Consulter les médicaments',
        description: 'Voir la liste des médicaments et leurs informations',
        category: 'medications',
        defaultGrades: ['direction', 'chirurgien', 'medecin', 'infirmier', 'ambulancier']
    },
    {
        key: 'medications.edit',
        label: 'Modifier les médicaments',
        description: 'Ajouter, modifier ou supprimer des médicaments',
        category: 'medications',
        defaultGrades: ['direction', 'chirurgien']
    },

    // === TARIFS ===
    {
        key: 'tarifs.view',
        label: 'Consulter les tarifs',
        description: 'Voir la grille tarifaire des soins',
        category: 'tarifs',
        defaultGrades: ['direction', 'chirurgien', 'medecin', 'infirmier', 'ambulancier']
    },
    {
        key: 'tarifs.edit',
        label: 'Modifier les tarifs',
        description: 'Ajouter, modifier ou supprimer des tarifs',
        category: 'tarifs',
        defaultGrades: ['direction']
    },

    // === ORDONNANCES ===
    {
        key: 'ordonnance.create',
        label: 'Créer des ordonnances',
        description: 'Générer des ordonnances pour les patients',
        category: 'ordonnance',
        defaultGrades: ['direction', 'chirurgien', 'medecin', 'infirmier']
    },
    {
        key: 'ordonnance.view_history',
        label: 'Voir l\'historique',
        description: 'Consulter les ordonnances précédemment créées',
        category: 'ordonnance',
        defaultGrades: ['direction', 'chirurgien', 'medecin', 'infirmier', 'ambulancier']
    },

    // === WIKI ===
    {
        key: 'wiki.view',
        label: 'Consulter le wiki',
        description: 'Lire les articles de la documentation interne',
        category: 'wiki',
        defaultGrades: ['direction', 'chirurgien', 'medecin', 'infirmier', 'ambulancier']
    },
    {
        key: 'wiki.edit',
        label: 'Modifier le wiki',
        description: 'Créer et modifier des articles wiki',
        category: 'wiki',
        defaultGrades: ['direction', 'chirurgien', 'medecin']
    },
    {
        key: 'wiki.manage',
        label: 'Gérer le wiki',
        description: 'Supprimer des articles et réorganiser la structure',
        category: 'wiki',
        defaultGrades: ['direction']
    },

    // === PLANNING ===
    {
        key: 'planning.view',
        label: 'Voir le planning',
        description: 'Consulter le calendrier des événements',
        category: 'planning',
        defaultGrades: ['direction', 'chirurgien', 'medecin', 'infirmier', 'ambulancier']
    },
    {
        key: 'planning.edit',
        label: 'Modifier le planning',
        description: 'Ajouter, modifier ou supprimer des événements',
        category: 'planning',
        defaultGrades: ['direction']
    },

    // === CANDIDATURES ===
    {
        key: 'candidatures.view',
        label: 'Voir les candidatures',
        description: 'Consulter les dossiers de candidature',
        category: 'candidatures',
        defaultGrades: ['direction']
    },
    {
        key: 'candidatures.vote',
        label: 'Voter sur les candidatures',
        description: 'Donner son avis sur les candidats',
        category: 'candidatures',
        defaultGrades: ['direction']
    },
    {
        key: 'candidatures.manage',
        label: 'Gérer les candidatures',
        description: 'Accepter, refuser et gérer le processus de recrutement',
        category: 'candidatures',
        defaultGrades: ['direction']
    },

    // === ADMINISTRATION ===
    {
        key: 'admin.permissions',
        label: 'Gérer les permissions',
        description: 'Modifier les permissions des différents grades',
        category: 'admin',
        defaultGrades: ['direction']
    },
    {
        key: 'admin.grades',
        label: 'Gérer les grades',
        description: 'Modifier les grades et les salaires',
        category: 'admin',
        defaultGrades: ['direction']
    },
    {
        key: 'admin.config',
        label: 'Configuration système',
        description: 'Modifier la configuration générale du système',
        category: 'admin',
        defaultGrades: ['direction']
    }
]

// ============================================================
// UTILITAIRES
// ============================================================

/**
 * Récupère les permissions par catégorie
 */
export function getPermissionsByCategory(): Record<string, PermissionDefinition[]> {
    const byCategory: Record<string, PermissionDefinition[]> = {}
    for (const perm of ALL_PERMISSIONS) {
        if (!byCategory[perm.category]) {
            byCategory[perm.category] = []
        }
        byCategory[perm.category].push(perm)
    }
    return byCategory
}

/**
 * Récupère une permission par sa clé
 */
export function getPermissionByKey(key: string): PermissionDefinition | undefined {
    return ALL_PERMISSIONS.find(p => p.key === key)
}

/**
 * Vérifie si un grade a une permission par défaut
 */
export function hasDefaultPermission(grade: GradeType, permissionKey: string): boolean {
    const perm = getPermissionByKey(permissionKey)
    return perm?.defaultGrades.includes(grade) ?? false
}

/**
 * Génère les permissions par défaut pour un grade
 */
export function getDefaultPermissionsForGrade(grade: GradeType): Record<string, boolean> {
    const permissions: Record<string, boolean> = {}
    for (const perm of ALL_PERMISSIONS) {
        permissions[perm.key] = perm.defaultGrades.includes(grade)
    }
    return permissions
}
