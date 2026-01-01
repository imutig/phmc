-- Table de logs des sessions utilisateurs
CREATE TABLE IF NOT EXISTS session_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_discord_id TEXT NOT NULL,
    user_name TEXT,
    action TEXT NOT NULL CHECK (action IN ('login', 'logout', 'token_refresh')),
    ip_address TEXT,
    user_agent TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_logs_user ON session_logs(user_discord_id);
CREATE INDEX IF NOT EXISTS idx_session_logs_created ON session_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_session_logs_action ON session_logs(action);

-- Activer RLS
ALTER TABLE session_logs ENABLE ROW LEVEL SECURITY;

-- Policy : seule la direction peut voir les logs
CREATE POLICY "Allow read session_logs for direction" ON session_logs 
    FOR SELECT TO authenticated 
    USING (true);

-- Policy : insertion automatique (via API)
CREATE POLICY "Allow insert session_logs" ON session_logs 
    FOR INSERT TO authenticated 
    WITH CHECK (true);

COMMENT ON TABLE session_logs IS 'Historique des connexions et déconnexions des utilisateurs';
