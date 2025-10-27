-- Adicionar colunas faltantes na tabela roleplay_sessions
ALTER TABLE roleplay_sessions
ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE roleplay_sessions
ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;

ALTER TABLE roleplay_sessions
ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;

-- Corrigir o default do status para 'in_progress'
ALTER TABLE roleplay_sessions
ALTER COLUMN status SET DEFAULT 'in_progress';

-- Adicionar CHECK constraint para valores válidos de status
ALTER TABLE roleplay_sessions
DROP CONSTRAINT IF EXISTS roleplay_sessions_status_check;

ALTER TABLE roleplay_sessions
ADD CONSTRAINT roleplay_sessions_status_check
CHECK (status IN ('in_progress', 'completed', 'abandoned', 'active'));