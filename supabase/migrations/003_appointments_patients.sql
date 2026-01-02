-- ============================================================================
-- PHMC - Système de Rendez-vous et Dossiers Patients
-- ============================================================================

-- Table des patients
CREATE TABLE IF NOT EXISTS patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Infos de base (remplies lors du RDV)
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone TEXT,
    birth_date TEXT,
    discord_id TEXT,
    discord_username TEXT,
    -- Infos complémentaires (remplies par médecin)
    photo_url TEXT,
    address TEXT,
    blood_type TEXT,
    allergies TEXT,
    medical_history TEXT,
    emergency_contact TEXT,
    emergency_phone TEXT,
    notes TEXT,
    -- Métadonnées
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_patients_discord_id ON patients(discord_id);
CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(last_name, first_name);

-- Table des rendez-vous
CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
    discord_id TEXT NOT NULL,
    discord_username TEXT,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, scheduled, completed, cancelled
    reason_category TEXT, -- Type de rendez-vous (Visite médicale, PPA, etc.)
    reason TEXT,
    discord_channel_id TEXT,
    discord_message_id TEXT,
    scheduled_date TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_discord ON appointments(discord_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_channel ON appointments(discord_channel_id);

-- Table des messages de rendez-vous
CREATE TABLE IF NOT EXISTS appointment_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE,
    sender_discord_id TEXT NOT NULL,
    sender_name TEXT,
    sender_avatar TEXT,
    content TEXT NOT NULL,
    is_from_staff BOOLEAN DEFAULT FALSE,
    discord_message_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appointment_messages_app ON appointment_messages(appointment_id);
CREATE INDEX IF NOT EXISTS idx_appointment_messages_created ON appointment_messages(created_at DESC);

-- Activer RLS
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_messages ENABLE ROW LEVEL SECURITY;

-- Policies pour les tables
DROP POLICY IF EXISTS "Allow read patients" ON patients;
CREATE POLICY "Allow read patients" ON patients
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow insert patients" ON patients;
CREATE POLICY "Allow insert patients" ON patients
    FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update patients" ON patients;
CREATE POLICY "Allow update patients" ON patients
    FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow read appointments" ON appointments;
CREATE POLICY "Allow read appointments" ON appointments
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow insert appointments" ON appointments;
CREATE POLICY "Allow insert appointments" ON appointments
    FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update appointments" ON appointments;
CREATE POLICY "Allow update appointments" ON appointments
    FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow read appointment_messages" ON appointment_messages;
CREATE POLICY "Allow read appointment_messages" ON appointment_messages
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow insert appointment_messages" ON appointment_messages;
CREATE POLICY "Allow insert appointment_messages" ON appointment_messages
    FOR INSERT TO authenticated WITH CHECK (true);

-- Commentaires
COMMENT ON TABLE patients IS 'Dossiers patients avec informations médicales';
COMMENT ON TABLE appointments IS 'Rendez-vous pris par les patients';
COMMENT ON TABLE appointment_messages IS 'Messages échangés sur les rendez-vous';
