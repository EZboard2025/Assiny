-- Limpar tabela chat_sessions existente e recriar no formato correto

-- Deletar policies existentes
DROP POLICY IF EXISTS "Service role has full access" ON chat_sessions;
DROP POLICY IF EXISTS "Everyone can read" ON chat_sessions;
DROP POLICY IF EXISTS "Users can view their own sessions" ON chat_sessions;
DROP POLICY IF EXISTS "Users can create their own sessions" ON chat_sessions;
DROP POLICY IF EXISTS "Users can update their own sessions" ON chat_sessions;

-- Deletar triggers e funções
DROP TRIGGER IF EXISTS trigger_update_chat_sessions_timestamp ON chat_sessions;
DROP FUNCTION IF EXISTS update_chat_sessions_updated_at();

-- Deletar tabela
DROP TABLE IF EXISTS chat_sessions;

-- Criar tabela no formato correto para LangChain
CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  message JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_chat_sessions_session_id ON chat_sessions(session_id);
CREATE INDEX idx_chat_sessions_created ON chat_sessions(created_at DESC);

-- RLS
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "chat_sessions_service_role_access"
  ON chat_sessions
  FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "chat_sessions_read_access"
  ON chat_sessions
  FOR SELECT
  USING (true);

-- Comentários
COMMENT ON TABLE chat_sessions IS 'Sessões de chat compatíveis com LangChain Postgres Chat Memory';
COMMENT ON COLUMN chat_sessions.session_id IS 'ID da sessão';
COMMENT ON COLUMN chat_sessions.message IS 'Mensagem no formato LangChain';
