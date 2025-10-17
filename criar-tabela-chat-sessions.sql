-- Tabela para armazenar sessões de chat com histórico de mensagens
-- Compatível com Postgres Chat Memory do LangChain

CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL, -- ID da sessão usado pelo LangChain
  message JSONB NOT NULL, -- Mensagem individual no formato LangChain

  -- Metadados
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_chat_sessions_session_id ON chat_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_created ON chat_sessions(created_at DESC);

-- RLS (Row Level Security)
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

-- Policy: Service role tem acesso total (para N8N)
CREATE POLICY "Service role has full access"
  ON chat_sessions
  FOR ALL
  USING (auth.role() = 'service_role');

-- Policy: Todos podem ler (para o frontend buscar histórico)
CREATE POLICY "Everyone can read"
  ON chat_sessions
  FOR SELECT
  USING (true);

-- Comentários
COMMENT ON TABLE chat_sessions IS 'Sessões de chat com histórico de mensagens para Chat Memory do LangChain';
COMMENT ON COLUMN chat_sessions.session_id IS 'ID único da sessão usado pelo LangChain/N8N';
COMMENT ON COLUMN chat_sessions.message IS 'Mensagem individual no formato LangChain: {type: "human"|"ai", data: {content: string}}';
