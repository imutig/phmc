-- Migration: Add medical_exams table for MFL medical visits
-- This table stores all data from the medical visit form

CREATE TABLE IF NOT EXISTS medical_exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    
    -- Metadata
    created_by TEXT NOT NULL, -- Discord ID du médecin
    created_by_name TEXT, -- Nom affiché du médecin
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'completed')),
    
    -- Informations administratives
    visit_date DATE,
    visit_type TEXT CHECK (visit_type IN ('embauche', 'periodique', 'reprise', 'prereprise', 'demande')),
    profession TEXT,
    employer TEXT,
    
    -- Antécédents médicaux
    personal_history TEXT,
    family_history TEXT,
    allergies BOOLEAN DEFAULT FALSE,
    allergies_details TEXT,
    current_treatment TEXT,
    tobacco BOOLEAN DEFAULT FALSE,
    alcohol BOOLEAN DEFAULT FALSE,
    sleep_quality TEXT CHECK (sleep_quality IN ('satisfaisant', 'insuffisant')),
    
    -- Examen clinique
    height_cm INTEGER,
    weight_kg DECIMAL(5,2),
    blood_pressure_systolic INTEGER,
    blood_pressure_diastolic INTEGER,
    heart_rate_bpm INTEGER,
    hearing TEXT CHECK (hearing IN ('normal', 'altered')),
    respiratory TEXT CHECK (respiratory IN ('normal', 'abnormal')),
    cardiovascular TEXT CHECK (cardiovascular IN ('normal', 'abnormal')),
    nervous_system TEXT CHECK (nervous_system IN ('normal', 'abnormal')),
    musculoskeletal TEXT CHECK (musculoskeletal IN ('normal', 'abnormal')),
    skin TEXT CHECK (skin IN ('normal', 'abnormal')),
    blood_test TEXT CHECK (blood_test IN ('normal', 'abnormal')),
    other_observations TEXT,
    
    -- Conclusion
    no_contraindication BOOLEAN DEFAULT FALSE,
    conclusion_date DATE,
    examiner_signature TEXT
);

-- Index pour les recherches
CREATE INDEX idx_medical_exams_patient_id ON medical_exams(patient_id);
CREATE INDEX idx_medical_exams_created_at ON medical_exams(created_at DESC);
CREATE INDEX idx_medical_exams_status ON medical_exams(status);

-- RLS
ALTER TABLE medical_exams ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can do everything
CREATE POLICY "Service role full access" ON medical_exams
    FOR ALL
    USING (auth.role() = 'service_role');

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_medical_exams_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_medical_exams_updated_at
    BEFORE UPDATE ON medical_exams
    FOR EACH ROW
    EXECUTE FUNCTION update_medical_exams_updated_at();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE medical_exams;
