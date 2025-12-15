-- Migration: Wiki Article History
-- Description: Table pour stocker l'historique des modifications des articles wiki
-- Exécutez ce script dans la console SQL de Supabase

-- Table d'historique des articles wiki
CREATE TABLE IF NOT EXISTS wiki_article_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id UUID NOT NULL REFERENCES wiki_articles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT NOT NULL,
    is_published BOOLEAN DEFAULT true,
    modified_by TEXT,
    modified_by_name TEXT,
    modified_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour recherche rapide par article
CREATE INDEX IF NOT EXISTS idx_wiki_article_history_article_id ON wiki_article_history(article_id);
CREATE INDEX IF NOT EXISTS idx_wiki_article_history_modified_at ON wiki_article_history(modified_at DESC);

-- RLS (Row Level Security) - Lecture pour tous les employés authentifiés
ALTER TABLE wiki_article_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read for authenticated users" ON wiki_article_history
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow insert for authenticated users" ON wiki_article_history
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Commentaire sur la table
COMMENT ON TABLE wiki_article_history IS 'Historique des modifications des articles wiki';
