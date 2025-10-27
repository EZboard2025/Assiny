-- Adicionar coluna thread_id se não existir
ALTER TABLE roleplay_sessions
ADD COLUMN IF NOT EXISTS thread_id TEXT;

-- Criar índice se não existir
CREATE INDEX IF NOT EXISTS roleplay_sessions_thread_id_idx ON roleplay_sessions(thread_id);

-- Adicionar constraint NOT NULL depois de popular dados existentes (se houver)
-- Por enquanto deixar NULL para não quebrar dados existentes
