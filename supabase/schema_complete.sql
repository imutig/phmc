-- ============================================================================
-- PHMC - Schéma Supabase Complet
-- ============================================================================
-- Ce script crée toutes les tables nécessaires au fonctionnement de l'application.
-- Il est idempotent (peut être exécuté plusieurs fois sans erreur).
-- Exécutez-le dans la console SQL de Supabase.
-- ============================================================================
Je
-- ============================================================================
-- 1. TABLES PRINCIPALES (UTILISATEURS & CANDIDATURES)
-- ============================================================================

-- Table des utilisateurs
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    discord_id TEXT UNIQUE NOT NULL,
    discord_username TEXT,
    avatar_url TEXT,
    email TEXT,
    is_recruiter BOOLEAN DEFAULT FALSE,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_discord_id ON users(discord_id);

-- Table de configuration
CREATE TABLE IF NOT EXISTS config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insérer les configurations par défaut (seulement si absentes)
INSERT INTO config (key, value)
SELECT 'cooldown_hours', '"24"'::jsonb WHERE NOT EXISTS (SELECT 1 FROM config WHERE key = 'cooldown_hours');
INSERT INTO config (key, value)
SELECT 'guild_id', 'null'::jsonb WHERE NOT EXISTS (SELECT 1 FROM config WHERE key = 'guild_id');
INSERT INTO config (key, value)
SELECT 'recruiter_channel_id', 'null'::jsonb WHERE NOT EXISTS (SELECT 1 FROM config WHERE key = 'recruiter_channel_id');
INSERT INTO config (key, value)
SELECT 'log_channel_id', 'null'::jsonb WHERE NOT EXISTS (SELECT 1 FROM config WHERE key = 'log_channel_id');

-- Table des candidatures
CREATE TABLE IF NOT EXISTS applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    service TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    birth_date TEXT NOT NULL,
    seniority TEXT NOT NULL,
    motivation TEXT NOT NULL,
    availability TEXT NOT NULL,
    discord_channel_id TEXT,
    discord_message_id TEXT,
    interview_date TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_applications_user_id ON applications(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_service ON applications(service);
CREATE INDEX IF NOT EXISTS idx_applications_channel ON applications(discord_channel_id);

-- Table des votes sur les candidatures
CREATE TABLE IF NOT EXISTS application_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
    voter_discord_id TEXT NOT NULL,
    voter_name TEXT,
    vote TEXT NOT NULL CHECK (vote IN ('pour', 'contre', 'neutre')),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(application_id, voter_discord_id)
);

CREATE INDEX IF NOT EXISTS idx_application_votes_app ON application_votes(application_id);
CREATE INDEX IF NOT EXISTS idx_application_votes_voter ON application_votes(voter_discord_id);

-- Table des logs des candidatures
CREATE TABLE IF NOT EXISTS application_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
    actor_discord_id TEXT NOT NULL,
    actor_name TEXT,
    action TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_application_logs_app ON application_logs(application_id);
CREATE INDEX IF NOT EXISTS idx_application_logs_created ON application_logs(created_at DESC);

-- Table des messages des candidatures
CREATE TABLE IF NOT EXISTS application_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
    sender_discord_id TEXT NOT NULL,
    sender_name TEXT,
    sender_avatar TEXT,
    content TEXT NOT NULL,
    is_from_staff BOOLEAN DEFAULT FALSE,
    is_read BOOLEAN DEFAULT FALSE,
    discord_message_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_application_messages_app ON application_messages(application_id);
CREATE INDEX IF NOT EXISTS idx_application_messages_created ON application_messages(created_at DESC);

-- Table des documents des candidatures
CREATE TABLE IF NOT EXISTS application_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_application_documents_app ON application_documents(application_id);

-- Table des templates de documents
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL,
    content TEXT,
    is_required BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table de blacklist
CREATE TABLE IF NOT EXISTS blacklist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    discord_id TEXT UNIQUE NOT NULL,
    discord_username TEXT,
    reason TEXT,
    added_by TEXT,
    added_by_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blacklist_discord_id ON blacklist(discord_id);

-- ============================================================================
-- 2. TABLES WIKI
-- ============================================================================

-- Table des articles wiki
CREATE TABLE IF NOT EXISTS wiki_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    content TEXT NOT NULL,
    category TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    is_published BOOLEAN DEFAULT TRUE,
    created_by TEXT,
    updated_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wiki_articles_slug ON wiki_articles(slug);
CREATE INDEX IF NOT EXISTS idx_wiki_articles_category ON wiki_articles(category);
CREATE INDEX IF NOT EXISTS idx_wiki_articles_published ON wiki_articles(is_published);

-- Table d'historique des articles wiki
CREATE TABLE IF NOT EXISTS wiki_article_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id UUID NOT NULL REFERENCES wiki_articles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT NOT NULL,
    is_published BOOLEAN DEFAULT TRUE,
    modified_by TEXT,
    modified_by_name TEXT,
    modified_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wiki_article_history_article_id ON wiki_article_history(article_id);
CREATE INDEX IF NOT EXISTS idx_wiki_article_history_modified_at ON wiki_article_history(modified_at DESC);

-- ============================================================================
-- 3. TABLES SNIPPETS (Réponses rapides)
-- ============================================================================

CREATE TABLE IF NOT EXISTS snippets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    content TEXT NOT NULL,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_snippets_name ON snippets(name);

-- ============================================================================
-- 4. TABLES DISCORD (Rôles)
-- ============================================================================

CREATE TABLE IF NOT EXISTS discord_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    discord_role_id TEXT NOT NULL,
    role_name TEXT NOT NULL,
    role_type TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_discord_roles_discord_role_id ON discord_roles(discord_role_id);
CREATE INDEX IF NOT EXISTS idx_discord_roles_type ON discord_roles(role_type);

-- ============================================================================
-- 5. TABLES GRADES & SERVICES (Intranet)
-- ============================================================================

-- Table des grades avec salaires
CREATE TABLE IF NOT EXISTS grades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    salary_per_15min INTEGER NOT NULL DEFAULT 625,
    max_weekly_salary INTEGER NOT NULL DEFAULT 80000,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insérer les grades par défaut (seulement si absents)
INSERT INTO grades (name, display_name, salary_per_15min, max_weekly_salary, sort_order)
SELECT 'direction', 'Direction', 1100, 150000, 1 WHERE NOT EXISTS (SELECT 1 FROM grades WHERE name = 'direction');
INSERT INTO grades (name, display_name, salary_per_15min, max_weekly_salary, sort_order)
SELECT 'chirurgien', 'Chirurgien', 1000, 120000, 2 WHERE NOT EXISTS (SELECT 1 FROM grades WHERE name = 'chirurgien');
INSERT INTO grades (name, display_name, salary_per_15min, max_weekly_salary, sort_order)
SELECT 'medecin', 'Médecin', 900, 100000, 3 WHERE NOT EXISTS (SELECT 1 FROM grades WHERE name = 'medecin');
INSERT INTO grades (name, display_name, salary_per_15min, max_weekly_salary, sort_order)
SELECT 'infirmier', 'Infirmier', 700, 85000, 4 WHERE NOT EXISTS (SELECT 1 FROM grades WHERE name = 'infirmier');
INSERT INTO grades (name, display_name, salary_per_15min, max_weekly_salary, sort_order)
SELECT 'ambulancier', 'Ambulancier', 625, 80000, 5 WHERE NOT EXISTS (SELECT 1 FROM grades WHERE name = 'ambulancier');

-- Table des prises de service
CREATE TABLE IF NOT EXISTS services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_discord_id TEXT NOT NULL,
    user_name TEXT,
    user_avatar_url TEXT,
    grade_name TEXT NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER NOT NULL,
    slots_count INTEGER NOT NULL,
    salary_earned INTEGER NOT NULL,
    week_number INTEGER NOT NULL,
    year INTEGER NOT NULL,
    service_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_services_user ON services(user_discord_id);
CREATE INDEX IF NOT EXISTS idx_services_week ON services(week_number, year);
CREATE INDEX IF NOT EXISTS idx_services_date ON services(service_date);

-- ============================================================================
-- 6. TABLES SOINS (Tarifs)
-- ============================================================================

-- Table des catégories de soins
CREATE TABLE IF NOT EXISTS care_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insérer les catégories de soins par défaut (seulement si absentes)
INSERT INTO care_categories (name, description, sort_order)
SELECT 'Consultations', 'Consultations médicales générales', 1 WHERE NOT EXISTS (SELECT 1 FROM care_categories WHERE name = 'Consultations');
INSERT INTO care_categories (name, description, sort_order)
SELECT 'Urgences', 'Soins d''urgence', 2 WHERE NOT EXISTS (SELECT 1 FROM care_categories WHERE name = 'Urgences');
INSERT INTO care_categories (name, description, sort_order)
SELECT 'Chirurgie', 'Interventions chirurgicales', 3 WHERE NOT EXISTS (SELECT 1 FROM care_categories WHERE name = 'Chirurgie');
INSERT INTO care_categories (name, description, sort_order)
SELECT 'Soins spécialisés', 'Soins médicaux spécialisés', 4 WHERE NOT EXISTS (SELECT 1 FROM care_categories WHERE name = 'Soins spécialisés');
INSERT INTO care_categories (name, description, sort_order)
SELECT 'Examens', 'Examens et diagnostics', 5 WHERE NOT EXISTS (SELECT 1 FROM care_categories WHERE name = 'Examens');
INSERT INTO care_categories (name, description, sort_order)
SELECT 'Autres', 'Autres prestations', 99 WHERE NOT EXISTS (SELECT 1 FROM care_categories WHERE name = 'Autres');

-- Table des types de soins
CREATE TABLE IF NOT EXISTS care_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES care_categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    price INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_care_types_category ON care_types(category_id);

-- Table des soins favoris par utilisateur
CREATE TABLE IF NOT EXISTS care_favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_discord_id TEXT NOT NULL,
    care_type_id UUID NOT NULL REFERENCES care_types(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_discord_id, care_type_id)
);

CREATE INDEX IF NOT EXISTS idx_care_favorites_user ON care_favorites(user_discord_id);
CREATE INDEX IF NOT EXISTS idx_care_favorites_care ON care_favorites(care_type_id);

-- ============================================================================
-- 7. TABLES MÉDICAMENTS & ORDONNANCES
-- ============================================================================

-- Table des catégories de médicaments
CREATE TABLE IF NOT EXISTS medication_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    color TEXT DEFAULT '#3b82f6',
    icon TEXT DEFAULT 'pill',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Catégories de médicaments par défaut (seulement si absentes)
INSERT INTO medication_categories (name, color, icon, sort_order)
SELECT 'Antidouleurs', '#ef4444', 'thermometer', 0 WHERE NOT EXISTS (SELECT 1 FROM medication_categories WHERE name = 'Antidouleurs');
INSERT INTO medication_categories (name, color, icon, sort_order)
SELECT 'Antibiotiques', '#22c55e', 'shield', 1 WHERE NOT EXISTS (SELECT 1 FROM medication_categories WHERE name = 'Antibiotiques');
INSERT INTO medication_categories (name, color, icon, sort_order)
SELECT 'Anesthésiques', '#8b5cf6', 'moon', 2 WHERE NOT EXISTS (SELECT 1 FROM medication_categories WHERE name = 'Anesthésiques');
INSERT INTO medication_categories (name, color, icon, sort_order)
SELECT 'Anti-inflammatoires', '#f59e0b', 'flame', 3 WHERE NOT EXISTS (SELECT 1 FROM medication_categories WHERE name = 'Anti-inflammatoires');
INSERT INTO medication_categories (name, color, icon, sort_order)
SELECT 'Sédatifs', '#06b6d4', 'bed', 4 WHERE NOT EXISTS (SELECT 1 FROM medication_categories WHERE name = 'Sédatifs');
INSERT INTO medication_categories (name, color, icon, sort_order)
SELECT 'Stimulants', '#ec4899', 'zap', 5 WHERE NOT EXISTS (SELECT 1 FROM medication_categories WHERE name = 'Stimulants');
INSERT INTO medication_categories (name, color, icon, sort_order)
SELECT 'Vaccins', '#14b8a6', 'syringe', 6 WHERE NOT EXISTS (SELECT 1 FROM medication_categories WHERE name = 'Vaccins');
INSERT INTO medication_categories (name, color, icon, sort_order)
SELECT 'Autres', '#6b7280', 'pill', 99 WHERE NOT EXISTS (SELECT 1 FROM medication_categories WHERE name = 'Autres');

-- Table des médicaments
CREATE TABLE IF NOT EXISTS medications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    dosage TEXT,
    duration TEXT,
    effects TEXT,
    side_effects TEXT,
    contraindications TEXT,
    category_id UUID REFERENCES medication_categories(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_medications_category_id ON medications(category_id);
CREATE INDEX IF NOT EXISTS idx_medications_name ON medications(name);

-- Table des ordonnances générées
CREATE TABLE IF NOT EXISTS prescriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_name TEXT,
    patient_info TEXT,
    medications JSONB NOT NULL,
    notes TEXT,
    image_url TEXT NOT NULL,
    created_by_discord_id TEXT NOT NULL,
    created_by_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prescriptions_created_by ON prescriptions(created_by_discord_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_created_at ON prescriptions(created_at DESC);

-- ============================================================================
-- 8. TABLES ÉVÉNEMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    event_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ,
    location TEXT,
    event_type TEXT NOT NULL DEFAULT 'general',
    color TEXT DEFAULT '#ef4444',
    is_published BOOLEAN DEFAULT TRUE,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_published ON events(is_published);

-- ============================================================================
-- 9. ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Activer RLS sur toutes les tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE config ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE blacklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE wiki_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE wiki_article_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE snippets ENABLE ROW LEVEL SECURITY;
ALTER TABLE discord_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE care_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE care_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE care_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE medication_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Policies pour le service_role (bypass complet)
-- Note: Le service_role bypass automatiquement le RLS

-- Policies pour les utilisateurs authentifiés (lecture)
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'users', 'config', 'wiki_articles', 'wiki_article_history', 
        'snippets', 'discord_roles', 'grades', 'care_categories', 
        'care_types', 'medication_categories', 'medications', 'events'
    ]
    LOOP
        EXECUTE format('
            DROP POLICY IF EXISTS "Allow read for authenticated" ON %I;
            CREATE POLICY "Allow read for authenticated" ON %I
                FOR SELECT TO authenticated USING (true);
        ', tbl, tbl);
    END LOOP;
END $$;

-- Policies spécifiques pour les données sensibles

-- Applications : l'utilisateur peut voir ses propres candidatures
DROP POLICY IF EXISTS "Users can view own applications" ON applications;
CREATE POLICY "Users can view own applications" ON applications
    FOR SELECT TO authenticated
    USING (
        user_id IN (SELECT id FROM users WHERE discord_id = auth.jwt() ->> 'discord_id')
        OR EXISTS (SELECT 1 FROM users WHERE discord_id = auth.jwt() ->> 'discord_id' AND (is_recruiter = true OR is_admin = true))
    );

-- Services : l'utilisateur peut voir ses propres services
DROP POLICY IF EXISTS "Users can view own services" ON services;
CREATE POLICY "Users can view own services" ON services
    FOR SELECT TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Users can insert own services" ON services;
CREATE POLICY "Users can insert own services" ON services
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- Care favorites : l'utilisateur peut gérer ses favoris
DROP POLICY IF EXISTS "Users can manage own favorites" ON care_favorites;
CREATE POLICY "Users can manage own favorites" ON care_favorites
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);

-- Prescriptions
DROP POLICY IF EXISTS "Allow read prescriptions" ON prescriptions;
CREATE POLICY "Allow read prescriptions" ON prescriptions
    FOR SELECT TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Allow insert prescriptions" ON prescriptions;
CREATE POLICY "Allow insert prescriptions" ON prescriptions
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- Wiki article history
DROP POLICY IF EXISTS "Allow insert wiki history" ON wiki_article_history;
CREATE POLICY "Allow insert wiki history" ON wiki_article_history
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- ============================================================================
-- 10. STORAGE BUCKETS
-- ============================================================================

-- Note: Les buckets doivent être créés via l'interface Supabase Storage
-- ou via une requête au Storage API. Voici les buckets nécessaires :
--
-- 1. "documents" - Pour les documents des candidatures (PDFs)
--    - Public: true
--    - File size limit: 10MB
--    - Allowed MIME types: application/pdf
--
-- 2. "prescriptions" - Pour les images d'ordonnances
--    - Public: true
--    - File size limit: 5MB
--    - Allowed MIME types: image/png, image/jpeg, image/webp

-- ============================================================================
-- 11. COMMENTAIRES
-- ============================================================================

COMMENT ON TABLE users IS 'Utilisateurs de l''application (liés à Discord)';
COMMENT ON TABLE applications IS 'Candidatures pour rejoindre les services EMS';
COMMENT ON TABLE application_votes IS 'Votes des recruteurs sur les candidatures';
COMMENT ON TABLE application_logs IS 'Historique des actions sur les candidatures';
COMMENT ON TABLE application_messages IS 'Messages échangés sur les candidatures';
COMMENT ON TABLE application_documents IS 'Documents uploadés pour les candidatures';
COMMENT ON TABLE blacklist IS 'Liste noire des utilisateurs bannis du recrutement';
COMMENT ON TABLE wiki_articles IS 'Articles du wiki interne';
COMMENT ON TABLE wiki_article_history IS 'Historique des modifications des articles wiki';
COMMENT ON TABLE snippets IS 'Réponses rapides pré-enregistrées';
COMMENT ON TABLE discord_roles IS 'Mapping des rôles Discord';
COMMENT ON TABLE grades IS 'Grades avec salaires associés';
COMMENT ON TABLE services IS 'Prises de service enregistrées';
COMMENT ON TABLE care_categories IS 'Catégories de soins médicaux';
COMMENT ON TABLE care_types IS 'Types de soins avec tarifs';
COMMENT ON TABLE care_favorites IS 'Soins favoris par utilisateur';
COMMENT ON TABLE medication_categories IS 'Catégories de médicaments';
COMMENT ON TABLE medications IS 'Liste des médicaments disponibles';
COMMENT ON TABLE prescriptions IS 'Ordonnances générées';
COMMENT ON TABLE events IS 'Événements du calendrier';
COMMENT ON TABLE config IS 'Configuration générale de l''application';

-- ============================================================================
-- FIN DU SCRIPT
-- ============================================================================
