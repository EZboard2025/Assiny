-- Criar tabela para sessões de análise de calls reais
CREATE TABLE IF NOT EXISTS real_call_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id VARCHAR(255) UNIQUE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  meet_link TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'active', -- active, recording, completed, error
  transcript JSONB DEFAULT '[]'::jsonb, -- Array of {speaker, text, timestamp}
  evaluation JSONB, -- SPIN evaluation from N8N
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE
);

-- Criar índices
CREATE INDEX idx_real_call_sessions_user_id ON real_call_sessions(user_id);
CREATE INDEX idx_real_call_sessions_session_id ON real_call_sessions(session_id);
CREATE INDEX idx_real_call_sessions_status ON real_call_sessions(status);
CREATE INDEX idx_real_call_sessions_created_at ON real_call_sessions(created_at DESC);

-- Habilitar RLS (Row Level Security)
ALTER TABLE real_call_sessions ENABLE ROW LEVEL SECURITY;

-- Política de RLS: usuários só veem suas próprias sessões
CREATE POLICY "Users can view own real call sessions" ON real_call_sessions
  FOR ALL USING (auth.uid() = user_id);

-- Política de RLS: service role tem acesso total
CREATE POLICY "Service role has full access to real call sessions" ON real_call_sessions
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_real_call_sessions_updated_at
  BEFORE UPDATE ON real_call_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comentários na tabela
COMMENT ON TABLE real_call_sessions IS 'Armazena sessões de análise de calls reais do Google Meet';
COMMENT ON COLUMN real_call_sessions.session_id IS 'ID único da sessão';
COMMENT ON COLUMN real_call_sessions.user_id IS 'ID do usuário que iniciou a análise';
COMMENT ON COLUMN real_call_sessions.meet_link IS 'Link do Google Meet analisado';
COMMENT ON COLUMN real_call_sessions.status IS 'Status da sessão: active, recording, completed, error';
COMMENT ON COLUMN real_call_sessions.transcript IS 'Array JSONB com a transcrição [{speaker, text, timestamp}]';
COMMENT ON COLUMN real_call_sessions.evaluation IS 'Avaliação SPIN do N8N';
COMMENT ON COLUMN real_call_sessions.error_message IS 'Mensagem de erro se houver';