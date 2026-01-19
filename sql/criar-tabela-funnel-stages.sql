-- Criar tabela de fases do funil (funnel stages)
-- Permite que cada empresa personalize as fases do seu processo de vendas

CREATE TABLE IF NOT EXISTS funnel_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  stage_name TEXT NOT NULL,
  description TEXT,
  stage_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para busca rápida por empresa
CREATE INDEX IF NOT EXISTS idx_funnel_stages_company_id ON funnel_stages(company_id);

-- Índice para ordenação
CREATE INDEX IF NOT EXISTS idx_funnel_stages_order ON funnel_stages(company_id, stage_order);

-- RLS (Row Level Security) para isolamento multi-tenant
ALTER TABLE funnel_stages ENABLE ROW LEVEL SECURITY;

-- Policy: Usuários podem ver apenas as fases da sua empresa
CREATE POLICY "Users can view funnel stages from their company"
  ON funnel_stages
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id
      FROM employees
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Service role tem acesso total
CREATE POLICY "Service role has full access to funnel_stages"
  ON funnel_stages
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Comentários para documentação
COMMENT ON TABLE funnel_stages IS 'Fases personalizadas do funil de vendas por empresa';
COMMENT ON COLUMN funnel_stages.stage_name IS 'Nome da fase (ex: Primeiro Contato, Qualificação, Proposta)';
COMMENT ON COLUMN funnel_stages.description IS 'Descrição do que caracteriza essa fase';
COMMENT ON COLUMN funnel_stages.stage_order IS 'Ordem da fase no funil (para manter sequência)';
