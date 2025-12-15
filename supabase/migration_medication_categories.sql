-- Migration: Medication Categories + Contraindications
-- Description: Catégories de médicaments et champ contre-indications
-- Exécutez ce script dans la console SQL de Supabase

-- Table des catégories de médicaments
CREATE TABLE IF NOT EXISTS medication_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    color TEXT DEFAULT '#3b82f6',
    icon TEXT DEFAULT 'pill',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ajouter les colonnes à la table medications existante
ALTER TABLE medications 
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES medication_categories(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS contraindications TEXT;

-- Index pour la jointure
CREATE INDEX IF NOT EXISTS idx_medications_category_id ON medications(category_id);

-- Catégories par défaut
INSERT INTO medication_categories (name, color, icon, sort_order) VALUES
('Antidouleurs', '#ef4444', 'thermometer', 0),
('Antibiotiques', '#22c55e', 'shield', 1),
('Anesthésiques', '#8b5cf6', 'moon', 2),
('Anti-inflammatoires', '#f59e0b', 'flame', 3),
('Sédatifs', '#06b6d4', 'bed', 4),
('Stimulants', '#ec4899', 'zap', 5),
('Vaccins', '#14b8a6', 'syringe', 6),
('Autres', '#6b7280', 'pill', 99)
ON CONFLICT (name) DO NOTHING;

-- RLS pour medication_categories
ALTER TABLE medication_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read for authenticated users" ON medication_categories
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow all for service role" ON medication_categories
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Commentaires
COMMENT ON TABLE medication_categories IS 'Catégories de médicaments (Antidouleurs, Antibiotiques, etc.)';
COMMENT ON COLUMN medications.contraindications IS 'Contre-indications du médicament';
