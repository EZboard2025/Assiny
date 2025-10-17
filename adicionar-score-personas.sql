-- Adicionar coluna de score de avaliação na tabela personas
ALTER TABLE personas
ADD COLUMN IF NOT EXISTS evaluation_score DECIMAL(3,1) DEFAULT NULL;

COMMENT ON COLUMN personas.evaluation_score IS 'Score da última avaliação da persona (0-10)';
