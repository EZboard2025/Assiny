-- Adicionar campo de plano na tabela companies
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS plan VARCHAR(20) DEFAULT 'og';

-- Adicionar comentário explicativo
COMMENT ON COLUMN companies.plan IS 'Plano da empresa: og (original/early adopters), pro, max, ps_starter, ps_scale, ps_growth, ps_pro, ps_max';

-- Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_companies_plan ON companies(plan);

-- Atualizar empresas existentes para plano OG (early adopters)
UPDATE companies
SET plan = 'og'
WHERE plan IS NULL;

-- Adicionar campo para controlar uso de roleplays (contador semanal)
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS weekly_roleplay_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS weekly_roleplay_reset_at TIMESTAMP DEFAULT NOW();

-- Adicionar campo para controlar candidatos em processo seletivo
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS selection_candidates_used INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS selection_plan_expires_at TIMESTAMP;

-- Comentários nos novos campos
COMMENT ON COLUMN companies.weekly_roleplay_count IS 'Contador de roleplays usados na semana atual';
COMMENT ON COLUMN companies.weekly_roleplay_reset_at IS 'Data/hora do último reset do contador semanal';
COMMENT ON COLUMN companies.selection_candidates_used IS 'Quantidade de candidatos já avaliados no plano de seleção atual';
COMMENT ON COLUMN companies.selection_plan_expires_at IS 'Data de expiração do plano de processo seletivo (30 dias após ativação)';

-- Função para resetar contador semanal automaticamente
CREATE OR REPLACE FUNCTION reset_weekly_roleplay_counter()
RETURNS void AS $$
BEGIN
  UPDATE companies
  SET
    weekly_roleplay_count = 0,
    weekly_roleplay_reset_at = NOW()
  WHERE
    weekly_roleplay_reset_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Criar uma trigger para chamar a função periodicamente (opcional - melhor usar cron job)
-- Esta função deve ser chamada pela aplicação ou por um cron job externo