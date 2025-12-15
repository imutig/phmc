-- Migration: Prescriptions (Ordonnances)
-- Description: Storage bucket et table pour les ordonnances générées
-- Exécutez ce script dans la console SQL de Supabase

-- Table des ordonnances générées
CREATE TABLE IF NOT EXISTS prescriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_name TEXT,
    patient_info TEXT,
    medications JSONB NOT NULL, -- Array of {medication_id, name, dosage, custom_dosage, duration}
    notes TEXT,
    image_url TEXT NOT NULL,
    created_by_discord_id TEXT NOT NULL,
    created_by_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_prescriptions_created_by ON prescriptions(created_by_discord_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_created_at ON prescriptions(created_at DESC);

-- RLS
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read for authenticated users" ON prescriptions
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow insert for authenticated users" ON prescriptions
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Commentaire
COMMENT ON TABLE prescriptions IS 'Ordonnances générées avec image uploadée';

-- Note: Vous devez également créer un bucket "prescriptions" dans Storage
-- avec les paramètres suivants:
-- - Public: true (pour que les liens soient accessibles)
-- - File size limit: 5MB
-- - Allowed MIME types: image/png, image/jpeg, image/webp
