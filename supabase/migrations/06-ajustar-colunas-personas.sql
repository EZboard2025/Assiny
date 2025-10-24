-- Ajustar colunas da tabela personas para corresponder ao código

-- Adicionar colunas que estão no código mas não no banco
ALTER TABLE personas ADD COLUMN IF NOT EXISTS context TEXT;
ALTER TABLE personas ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE personas ADD COLUMN IF NOT EXISTS profession TEXT;
ALTER TABLE personas ADD COLUMN IF NOT EXISTS interests TEXT;
ALTER TABLE personas ADD COLUMN IF NOT EXISTS lifestyle_goal TEXT;
ALTER TABLE personas ADD COLUMN IF NOT EXISTS job_title TEXT;
ALTER TABLE personas ADD COLUMN IF NOT EXISTS company_type TEXT;
ALTER TABLE personas ADD COLUMN IF NOT EXISTS company_goals TEXT;
ALTER TABLE personas ADD COLUMN IF NOT EXISTS business_challenges TEXT;
ALTER TABLE personas ADD COLUMN IF NOT EXISTS prior_knowledge TEXT;
ALTER TABLE personas ADD COLUMN IF NOT EXISTS main_pains TEXT;
ALTER TABLE personas ADD COLUMN IF NOT EXISTS what_seeks TEXT;

-- Migrar dados existentes se houver (mapear colunas PT-BR para EN)
UPDATE personas SET context = contexto WHERE context IS NULL AND contexto IS NOT NULL;
UPDATE personas SET what_seeks = busca WHERE what_seeks IS NULL AND busca IS NOT NULL;
UPDATE personas SET main_pains = dores WHERE main_pains IS NULL AND dores IS NOT NULL;
UPDATE personas SET profession = cargo WHERE profession IS NULL AND cargo IS NOT NULL;

-- Para manter compatibilidade, vamos manter ambas as colunas por enquanto
-- contexto (PT-BR) e context (EN)
-- busca (PT-BR) e what_seeks (EN)
-- dores (PT-BR) e main_pains (EN)
-- cargo (PT-BR) e profession (EN)