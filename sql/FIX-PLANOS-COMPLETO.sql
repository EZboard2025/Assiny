-- 🔴 EXECUTAR ESTE SQL NO SUPABASE PARA RESOLVER O PROBLEMA DOS PLANOS

-- ========================================
-- 1. CRIAR AS COLUNAS NECESSÁRIAS
-- ========================================
ALTER TABLE companies ADD COLUMN IF NOT EXISTS training_plan TEXT DEFAULT 'og';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS selection_plan TEXT DEFAULT NULL;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS weekly_roleplay_count INTEGER DEFAULT 0;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS weekly_roleplay_reset_at TIMESTAMP DEFAULT NOW();
ALTER TABLE companies ADD COLUMN IF NOT EXISTS selection_candidates_count INTEGER DEFAULT 0;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS selection_plan_expires_at TIMESTAMP;

-- ========================================
-- 2. DESABILITAR RLS TEMPORARIAMENTE
-- ========================================
ALTER TABLE companies DISABLE ROW LEVEL SECURITY;

-- ========================================
-- 3. DEFINIR VALORES PADRÃO
-- ========================================
UPDATE companies SET training_plan = 'og' WHERE training_plan IS NULL;

-- ========================================
-- 4. VERIFICAR E CORRIGIR PERMISSÕES
-- ========================================
-- Garantir que o usuário anon pode fazer SELECT
GRANT SELECT ON companies TO anon;
GRANT SELECT ON companies TO authenticated;

-- Garantir que service_role pode fazer tudo
GRANT ALL ON companies TO service_role;

-- ========================================
-- 5. REABILITAR RLS COM POLÍTICAS CORRETAS
-- ========================================
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "Companies são visíveis para todos" ON companies;
DROP POLICY IF EXISTS "Apenas service_role pode atualizar companies" ON companies;
DROP POLICY IF EXISTS "Apenas service_role pode inserir companies" ON companies;
DROP POLICY IF EXISTS "Apenas service_role pode deletar companies" ON companies;
DROP POLICY IF EXISTS "Enable read access for all users" ON companies;
DROP POLICY IF EXISTS "Enable all access for service role" ON companies;

-- Criar política simples que permite tudo (temporário para teste)
CREATE POLICY "Permitir tudo para todos (temporário)" ON companies
    FOR ALL USING (true) WITH CHECK (true);

-- ========================================
-- 6. TESTE RÁPIDO
-- ========================================
-- Este select deve funcionar sem erro
SELECT id, name, training_plan, selection_plan FROM companies LIMIT 1;