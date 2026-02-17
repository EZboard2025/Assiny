-- Tabela para rastrear sessões de bot do Recall.ai
-- Mapeia bot_id → user_id para o webhook poder processar em background
CREATE TABLE IF NOT EXISTS meet_bot_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  meeting_url TEXT NOT NULL,
  status TEXT DEFAULT 'created' CHECK (status IN (
    'created', 'joining', 'recording', 'processing', 'evaluating', 'completed', 'error', 'cancelled'
  )),
  transcript JSONB,
  evaluation_id UUID,
  error_message TEXT,
  recall_status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meet_bot_sessions_bot_id ON meet_bot_sessions(bot_id);
CREATE INDEX IF NOT EXISTS idx_meet_bot_sessions_user_id ON meet_bot_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_meet_bot_sessions_status ON meet_bot_sessions(status);

ALTER TABLE meet_bot_sessions ENABLE ROW LEVEL SECURITY;

-- Service role precisa de acesso total (webhook usa service role)
CREATE POLICY "Service role full access meet_bot_sessions"
ON meet_bot_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Usuários podem ver suas próprias sessões
CREATE POLICY "Users can view own meet_bot_sessions"
ON meet_bot_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Usuários podem inserir (via create-bot route autenticada)
CREATE POLICY "Users can insert own meet_bot_sessions"
ON meet_bot_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Usuários podem atualizar (para cancelar)
CREATE POLICY "Users can update own meet_bot_sessions"
ON meet_bot_sessions FOR UPDATE TO authenticated USING (auth.uid() = user_id);
