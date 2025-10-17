-- Adicionar coluna user_id à tabela chat_sessions para filtrar por usuário

-- Adicionar coluna user_id
ALTER TABLE chat_sessions
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);

-- Atualizar RLS policies para filtrar por usuário

-- Remover policy antiga que permitia ler tudo
DROP POLICY IF EXISTS "chat_sessions_read_access" ON chat_sessions;

-- Nova policy: usuários só veem suas próprias sessões
CREATE POLICY "chat_sessions_user_read_access"
  ON chat_sessions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: usuários podem inserir suas próprias sessões
CREATE POLICY "chat_sessions_user_insert_access"
  ON chat_sessions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Comentário
COMMENT ON COLUMN chat_sessions.user_id IS 'ID do usuário dono da sessão';
