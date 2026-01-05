-- Migration: Ajouter le champ grade à la table users
-- Permet de stocker le grade déterminé depuis les rôles Discord

ALTER TABLE users ADD COLUMN IF NOT EXISTS grade TEXT;

-- Index pour les requêtes filtrées par grade
CREATE INDEX IF NOT EXISTS idx_users_grade ON users(grade);

-- Commentaire sur la colonne
COMMENT ON COLUMN users.grade IS 'Grade EMS de l''utilisateur (direction, chirurgien, medecin, infirmier, ambulancier)';
