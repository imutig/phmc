-- Migration: Refonte events pour emploi du temps collaboratif
-- Date: 2026-01-05

-- 1. Ajouter les nouvelles colonnes à la table events
ALTER TABLE events
ADD COLUMN IF NOT EXISTS event_size TEXT DEFAULT 'minor' CHECK (event_size IN ('major', 'minor')),
ADD COLUMN IF NOT EXISTS start_time TIME,
ADD COLUMN IF NOT EXISTS end_time TIME,
ADD COLUMN IF NOT EXISTS participants_all BOOLEAN DEFAULT false;

-- 2. Mettre à jour event_type avec les nouvelles catégories
-- (Les anciennes valeurs restent valides, on ajoute juste 'rdv' et 'autre')
ALTER TABLE events 
DROP CONSTRAINT IF EXISTS events_event_type_check;

ALTER TABLE events 
ADD CONSTRAINT events_event_type_check 
CHECK (event_type IN ('general', 'ceremonie', 'formation', 'reunion', 'fete', 'rdv', 'autre'));

-- 3. Créer la table event_participants pour les participants spécifiques
CREATE TABLE IF NOT EXISTS event_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_discord_id TEXT NOT NULL,
    user_name TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(event_id, user_discord_id)
);

-- 4. Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_event_participants_event_id ON event_participants(event_id);
CREATE INDEX IF NOT EXISTS idx_event_participants_user ON event_participants(user_discord_id);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date);

-- 5. Commentaires pour documentation
COMMENT ON COLUMN events.event_size IS 'Taille de l''événement: major (bal, cérémonie) ou minor (RDV, réunion)';
COMMENT ON COLUMN events.start_time IS 'Heure de début (HH:MM)';
COMMENT ON COLUMN events.end_time IS 'Heure de fin (HH:MM)';
COMMENT ON COLUMN events.participants_all IS 'Si true, tous les employés sont concernés';
COMMENT ON TABLE event_participants IS 'Participants spécifiques à un événement';
