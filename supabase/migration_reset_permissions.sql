-- 1. Supprimer les tables existantes pour repartir sur une base propre
DROP TABLE IF EXISTS grade_permissions CASCADE;
DROP TABLE IF EXISTS permissions CASCADE;

-- 2. Créer la table permissions
CREATE TABLE permissions (
    key TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Créer la table grade_permissions
CREATE TABLE grade_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grade TEXT NOT NULL,
    permission_key TEXT NOT NULL REFERENCES permissions(key) ON DELETE CASCADE,
    granted BOOLEAN DEFAULT TRUE,
    updated_by TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(grade, permission_key)
);

-- 4. Insérer toutes les définitions de permissions
INSERT INTO permissions (key, label, description, category) VALUES
-- SERVICES
('services.view', 'Voir ses services', 'Consulter l''historique de ses propres prises de service', 'services'),
('services.add', 'Ajouter des services', 'Déclarer manuellement une prise de service', 'services'),
('services.live', 'Service en direct', 'Utiliser le bouton de prise de service en temps réel', 'services'),
('services.manage_all', 'Gérer tous les services', 'Voir, modifier et supprimer les services de tous les employés', 'services'),

-- MEDICAMENTS
('medications.view', 'Consulter les médicaments', 'Voir la liste des médicaments et leurs informations', 'medications'),
('medications.edit', 'Modifier les médicaments', 'Ajouter, modifier ou supprimer des médicaments', 'medications'),

-- TARIFS
('tarifs.view', 'Consulter les tarifs', 'Voir la grille tarifaire des soins', 'tarifs'),
('tarifs.edit', 'Modifier les tarifs', 'Ajouter, modifier ou supprimer des tarifs', 'tarifs'),

-- ORDONNANCES
('ordonnance.create', 'Créer des ordonnances', 'Générer des ordonnances pour les patients', 'ordonnance'),
('ordonnance.view_history', 'Voir l''historique', 'Consulter les ordonnances précédemment créées', 'ordonnance'),

-- WIKI
('wiki.view', 'Consulter le wiki', 'Lire les articles de la documentation interne', 'wiki'),
('wiki.edit', 'Modifier le wiki', 'Créer et modifier des articles wiki', 'wiki'),
('wiki.manage', 'Gérer le wiki', 'Supprimer des articles et réorganiser la structure', 'wiki'),

-- PLANNING
('planning.view', 'Voir le planning', 'Consulter le calendrier des événements', 'planning'),
('planning.edit', 'Modifier le planning', 'Ajouter, modifier ou supprimer des événements', 'planning'),

-- CANDIDATURES
('candidatures.view', 'Voir les candidatures', 'Consulter les dossiers de candidature', 'candidatures'),
('candidatures.vote', 'Voter sur les candidatures', 'Donner son avis sur les candidats', 'candidatures'),
('candidatures.manage', 'Gérer les candidatures', 'Accepter, refuser et gérer le processus de recrutement', 'candidatures'),

-- DASHBOARD
('dashboard.view', 'Accéder au dashboard', 'Voir le tableau de bord de gestion', 'dashboard'),
('dashboard.stats', 'Voir les statistiques', 'Consulter les statistiques détaillées de l''entreprise', 'dashboard'),

-- ADMIN
('admin.permissions', 'Gérer les permissions', 'Modifier les permissions des différents grades', 'admin'),
('admin.grades', 'Gérer les grades', 'Modifier les grades et les salaires', 'admin'),
('admin.config', 'Configuration système', 'Modifier la configuration générale du système', 'admin');

-- 5. Insérer les permissions par défaut pour les grades (grade_permissions)

-- CHIRURGIEN
INSERT INTO grade_permissions (grade, permission_key, granted) VALUES
('chirurgien', 'services.view', true),
('chirurgien', 'services.add', true),
('chirurgien', 'services.live', true),
('chirurgien', 'medications.view', true),
('chirurgien', 'medications.edit', true),
('chirurgien', 'tarifs.view', true),
('chirurgien', 'ordonnance.create', true),
('chirurgien', 'ordonnance.view_history', true),
('chirurgien', 'wiki.view', true),
('chirurgien', 'wiki.edit', true),
('chirurgien', 'planning.view', true);

-- MEDECIN
INSERT INTO grade_permissions (grade, permission_key, granted) VALUES
('medecin', 'services.view', true),
('medecin', 'services.add', true),
('medecin', 'services.live', true),
('medecin', 'medications.view', true),
('medecin', 'tarifs.view', true),
('medecin', 'ordonnance.create', true),
('medecin', 'ordonnance.view_history', true),
('medecin', 'wiki.view', true),
('medecin', 'wiki.edit', true),
('medecin', 'planning.view', true);

-- INFIRMIER
INSERT INTO grade_permissions (grade, permission_key, granted) VALUES
('infirmier', 'services.view', true),
('infirmier', 'services.add', true),
('infirmier', 'services.live', true),
('infirmier', 'medications.view', true),
('infirmier', 'tarifs.view', true),
('infirmier', 'ordonnance.create', true),
('infirmier', 'ordonnance.view_history', true),
('infirmier', 'wiki.view', true),
('infirmier', 'planning.view', true);

-- AMBULANCIER
INSERT INTO grade_permissions (grade, permission_key, granted) VALUES
('ambulancier', 'services.view', true),
('ambulancier', 'services.add', true),
('ambulancier', 'services.live', true),
('ambulancier', 'medications.view', true),
('ambulancier', 'tarifs.view', true),
('ambulancier', 'ordonnance.view_history', true),
('ambulancier', 'wiki.view', true),
('ambulancier', 'planning.view', true);

-- 6. Activer RLS
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE grade_permissions ENABLE ROW LEVEL SECURITY;

-- 7. Créer les policies
-- Tout le monde peut lire les permissions
CREATE POLICY "Allow read permissions" ON permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read grade_permissions" ON grade_permissions FOR SELECT TO authenticated USING (true);

-- Seule la direction peut modifier (via API, mais ici on met true pour simplifier car l'API vérifie le rôle)
CREATE POLICY "Allow write grade_permissions" ON grade_permissions FOR ALL TO authenticated USING (true) WITH CHECK (true);
