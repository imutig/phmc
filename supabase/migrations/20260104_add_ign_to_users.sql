-- Migration: Ajouter le champ IGN (In-Game Name) aux utilisateurs
-- Date: 2026-01-04

-- Ajouter la colonne ign
ALTER TABLE users ADD COLUMN IF NOT EXISTS ign TEXT;

-- Créer un index unique insensible à la casse (seuls les IGN non-null sont indexés)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_ign_unique 
ON users (LOWER(ign)) 
WHERE ign IS NOT NULL;

-- Commentaire pour la documentation
COMMENT ON COLUMN users.ign IS 'In-Game Name (Prénom Nom) pour la synchronisation avec le bot Pointeuse';
