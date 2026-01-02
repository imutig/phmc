-- Migration 005: Amélioration gestion rendez-vous
-- Ajoute les colonnes pour le suivi complet des rendez-vous

-- Colonnes pour l'assignation
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS assigned_to TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS assigned_to_name TEXT;

-- Colonnes pour la complétion
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS completed_by TEXT;

-- Colonne pour l'annulation
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cancel_reason TEXT;

-- Commentaires
COMMENT ON COLUMN appointments.assigned_to IS 'Discord ID du staff assigné au RDV';
COMMENT ON COLUMN appointments.assigned_to_name IS 'Nom affiché du staff assigné';
COMMENT ON COLUMN appointments.completed_at IS 'Date/heure de complétion du RDV';
COMMENT ON COLUMN appointments.completed_by IS 'Nom du staff ayant terminé le RDV';
COMMENT ON COLUMN appointments.cancel_reason IS 'Raison de l''annulation (optionnel)';
