-- Adicionar colunas de planos na tabela companies
-- Plano de treinamento (og, pro, max)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS training_plan TEXT DEFAULT 'og';

-- Plano de processo seletivo (ps_starter, ps_scale, ps_growth, ps_pro, ps_max, ou NULL se não tem)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS selection_plan TEXT DEFAULT NULL;

-- Adicionar colunas para controle de limites de roleplay semanal
ALTER TABLE companies ADD COLUMN IF NOT EXISTS weekly_roleplay_count INTEGER DEFAULT 0;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS weekly_roleplay_reset_at TIMESTAMP DEFAULT NOW();

-- Adicionar colunas para controle de processo seletivo
ALTER TABLE companies ADD COLUMN IF NOT EXISTS selection_candidates_count INTEGER DEFAULT 0;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS selection_plan_expires_at TIMESTAMP;

-- Comentários sobre os valores possíveis de planos
COMMENT ON COLUMN companies.training_plan IS 'Plano de treinamento da empresa: og, pro, max';
COMMENT ON COLUMN companies.selection_plan IS 'Plano de processo seletivo: ps_starter, ps_scale, ps_growth, ps_pro, ps_max (NULL se não tem)';

-- Migrar dados do campo antigo 'plan' se existir
UPDATE companies SET training_plan = plan WHERE plan IN ('og', 'pro', 'max');
UPDATE companies SET selection_plan = plan WHERE plan IN ('ps_starter', 'ps_scale', 'ps_growth', 'ps_pro', 'ps_max');

-- Remover a coluna antiga 'plan' se existir
ALTER TABLE companies DROP COLUMN IF EXISTS plan;

-- Atualizar todas as empresas existentes para o plano OG se não tiverem plano de treinamento
UPDATE companies SET training_plan = 'og' WHERE training_plan IS NULL;