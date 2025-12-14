-- Table des soins favoris par utilisateur
CREATE TABLE IF NOT EXISTS care_favorites (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_discord_id TEXT NOT NULL,
    care_type_id UUID NOT NULL REFERENCES care_types(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(user_discord_id, care_type_id)
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_care_favorites_user ON care_favorites(user_discord_id);
CREATE INDEX IF NOT EXISTS idx_care_favorites_care ON care_favorites(care_type_id);

-- RLS
ALTER TABLE care_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own favorites" ON care_favorites
    FOR ALL USING (true);
