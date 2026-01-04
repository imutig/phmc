-- Migration: Table pour stocker les primes des salaires
-- Date: 2026-01-04

CREATE TABLE IF NOT EXISTS salary_primes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    discord_id TEXT NOT NULL,
    week_number INTEGER NOT NULL,
    year INTEGER NOT NULL,
    prime_amount INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(discord_id, week_number, year)
);

-- Index pour recherche par semaine
CREATE INDEX IF NOT EXISTS idx_salary_primes_week ON salary_primes(week_number, year);

-- Commentaire
COMMENT ON TABLE salary_primes IS 'Primes hebdomadaires des employés';
