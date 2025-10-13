-- Adicionar coluna de avaliação na tabela roleplay_sessions
ALTER TABLE roleplay_sessions
ADD COLUMN IF NOT EXISTS evaluation JSONB;

-- Comentário explicativo
COMMENT ON COLUMN roleplay_sessions.evaluation IS 'Avaliação completa retornada pelo agente N8N após finalização do roleplay. Contém scores SPIN, análise de objeções, feedbacks e plano de melhorias.';

-- Verificar resultado
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'roleplay_sessions'
  AND column_name = 'evaluation';
