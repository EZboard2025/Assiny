-- Remover coluna session_id se existir (o código usa thread_id)
ALTER TABLE roleplay_sessions
DROP COLUMN IF EXISTS session_id;

-- Garantir que thread_id existe
ALTER TABLE roleplay_sessions
ADD COLUMN IF NOT EXISTS thread_id TEXT;

-- Adicionar company_id se não existir
ALTER TABLE roleplay_sessions
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

-- Criar índice para company_id se não existir
CREATE INDEX IF NOT EXISTS idx_roleplay_sessions_company_id ON roleplay_sessions(company_id);