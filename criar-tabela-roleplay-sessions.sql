-- Criar tabela de sessões de roleplay
CREATE TABLE IF NOT EXISTS roleplay_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  thread_id TEXT NOT NULL,

  -- Configurações da sessão
  config JSONB NOT NULL,

  -- Transcrição completa da conversa
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Metadados
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,

  -- Status
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS roleplay_sessions_user_id_idx ON roleplay_sessions(user_id);
CREATE INDEX IF NOT EXISTS roleplay_sessions_thread_id_idx ON roleplay_sessions(thread_id);
CREATE INDEX IF NOT EXISTS roleplay_sessions_created_at_idx ON roleplay_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS roleplay_sessions_status_idx ON roleplay_sessions(status);

-- Habilitar Row Level Security (RLS)
ALTER TABLE roleplay_sessions ENABLE ROW LEVEL SECURITY;

-- Política: Usuários só podem ver suas próprias sessões
CREATE POLICY "Usuários podem ver suas próprias sessões"
  ON roleplay_sessions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Política: Usuários podem inserir suas próprias sessões
CREATE POLICY "Usuários podem criar suas próprias sessões"
  ON roleplay_sessions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Política: Usuários podem atualizar suas próprias sessões
CREATE POLICY "Usuários podem atualizar suas próprias sessões"
  ON roleplay_sessions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Política: Usuários podem deletar suas próprias sessões
CREATE POLICY "Usuários podem deletar suas próprias sessões"
  ON roleplay_sessions
  FOR DELETE
  USING (auth.uid() = user_id);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_roleplay_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar updated_at
DROP TRIGGER IF EXISTS update_roleplay_sessions_updated_at_trigger ON roleplay_sessions;
CREATE TRIGGER update_roleplay_sessions_updated_at_trigger
  BEFORE UPDATE ON roleplay_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_roleplay_sessions_updated_at();

-- Comentários para documentação
COMMENT ON TABLE roleplay_sessions IS 'Sessões de roleplay de vendas com transcrições completas';
COMMENT ON COLUMN roleplay_sessions.config IS 'Configurações da sessão: idade, temperamento, segmento, objeções';
COMMENT ON COLUMN roleplay_sessions.messages IS 'Array de mensagens: [{ role: "client"|"seller", text: "...", timestamp: "..." }]';
COMMENT ON COLUMN roleplay_sessions.status IS 'Status da sessão: in_progress, completed, abandoned';
