-- =====================================================
-- ADICIONAR COLUNA DE AVALIAÇÃO NA TABELA CHALLENGE_LEADS
-- =====================================================

-- Adicionar coluna evaluation (JSONB) para guardar a avaliação SPIN completa
ALTER TABLE challenge_leads
ADD COLUMN IF NOT EXISTS evaluation JSONB;

-- Adicionar coluna para a transcrição completa do roleplay
ALTER TABLE challenge_leads
ADD COLUMN IF NOT EXISTS transcription TEXT;

-- Adicionar coluna para o score geral (facilitando queries)
ALTER TABLE challenge_leads
ADD COLUMN IF NOT EXISTS overall_score DECIMAL(4,2);

-- Índice para buscar por score
CREATE INDEX IF NOT EXISTS idx_challenge_leads_score ON challenge_leads(overall_score);

-- Comentários para documentação
COMMENT ON COLUMN challenge_leads.evaluation IS 'Avaliação SPIN completa retornada pelo N8N (JSON)';
COMMENT ON COLUMN challenge_leads.transcription IS 'Transcrição completa da conversa do roleplay';
COMMENT ON COLUMN challenge_leads.overall_score IS 'Score geral da avaliação (0-10) para facilitar queries';
