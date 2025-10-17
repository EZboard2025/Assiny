-- Adiciona coluna de score de avaliação para objeções
ALTER TABLE public.objections
ADD COLUMN IF NOT EXISTS evaluation_score DECIMAL(3,1) DEFAULT NULL;

-- Comentário explicativo:
-- evaluation_score armazena a nota da última avaliação (0.0 a 10.0)
-- NULL indica que a objeção nunca foi avaliada ou foi editada após última avaliação
-- Quando objection.name ou objection.rebuttals são atualizados, este campo deve ser resetado para NULL
