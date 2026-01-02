-- Ajout de la colonne fingerprint (empreinte) à la table patients
ALTER TABLE patients 
ADD COLUMN IF NOT EXISTS fingerprint TEXT;

-- Contrainte d'unicité sur fingerprint (si non null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_fingerprint ON patients(fingerprint) WHERE fingerprint IS NOT NULL;

-- Index pour la recherche rapide
CREATE INDEX IF NOT EXISTS idx_patients_fingerprint_search ON patients(fingerprint);
