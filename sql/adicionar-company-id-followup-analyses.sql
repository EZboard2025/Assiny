-- Adicionar coluna company_id na tabela followup_analyses
-- IMPORTANTE: Execute este SQL no Supabase Dashboard

-- 1. Adicionar a coluna company_id (pode ser NULL temporariamente para dados existentes)
ALTER TABLE followup_analyses
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

-- 2. Criar índice para busca rápida por company_id
CREATE INDEX IF NOT EXISTS idx_followup_analyses_company_id ON followup_analyses(company_id);

-- 3. Atualizar dados existentes buscando o company_id através da tabela employees
-- Isso vincula os follow-ups existentes às suas respectivas empresas
UPDATE followup_analyses fa
SET company_id = e.company_id
FROM employees e
WHERE fa.user_id = e.user_id
AND fa.company_id IS NULL;

-- 4. Verificar se a atualização funcionou
-- SELECT id, user_id, company_id FROM followup_analyses LIMIT 10;

-- Nota: A coluna é nullable para permitir dados existentes sem company_id
-- Novos registros devem sempre incluir o company_id
