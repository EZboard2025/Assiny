-- EXECUTAR ESTE SQL NO SUPABASE

-- 1. Primeiro adicionar as colunas (sem tentar acessar 'plan' que não existe)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS training_plan TEXT DEFAULT 'og';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS selection_plan TEXT DEFAULT NULL;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS weekly_roleplay_count INTEGER DEFAULT 0;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS weekly_roleplay_reset_at TIMESTAMP DEFAULT NOW();
ALTER TABLE companies ADD COLUMN IF NOT EXISTS selection_candidates_count INTEGER DEFAULT 0;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS selection_plan_expires_at TIMESTAMP;

-- 2. Adicionar comentários
COMMENT ON COLUMN companies.training_plan IS 'Plano de treinamento da empresa: og, pro, max';
COMMENT ON COLUMN companies.selection_plan IS 'Plano de processo seletivo: ps_starter, ps_scale, ps_growth, ps_pro, ps_max (NULL se não tem)';

-- 3. Definir valores padrão para empresas existentes
UPDATE companies SET training_plan = 'og' WHERE training_plan IS NULL;

-- 4. Garantir permissões corretas na tabela companies
GRANT ALL ON companies TO authenticated;
GRANT ALL ON companies TO anon;
GRANT ALL ON companies TO service_role;

-- 5. Se houver RLS, criar políticas apropriadas
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- Política para leitura (todos podem ler todas as empresas)
CREATE POLICY "Companies são visíveis para todos" ON companies
    FOR SELECT USING (true);

-- Política para update (apenas service_role pode atualizar)
CREATE POLICY "Apenas service_role pode atualizar companies" ON companies
    FOR UPDATE USING (auth.role() = 'service_role');

-- Política para insert (apenas service_role pode inserir)
CREATE POLICY "Apenas service_role pode inserir companies" ON companies
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Política para delete (apenas service_role pode deletar)
CREATE POLICY "Apenas service_role pode deletar companies" ON companies
    FOR DELETE USING (auth.role() = 'service_role');