-- Criar tabela para armazenar resultados de follow-ups
-- Permite que vendedores marquem se o follow-up funcionou ou não

CREATE TABLE IF NOT EXISTS followup_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  followup_analysis_id UUID NOT NULL REFERENCES followup_analyses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Resultado do follow-up (boolean simples para começar)
  funcionou BOOLEAN NOT NULL, -- true = funcionou, false = não funcionou

  -- Detalhes opcionais
  lead_respondeu BOOLEAN, -- Cliente respondeu?
  lead_avancou_fase BOOLEAN, -- Avançou para próxima fase?
  proxima_fase_id UUID REFERENCES funnel_stages(id), -- Para qual fase avançou (se aplicável)
  observacoes TEXT, -- Observações do vendedor

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para busca rápida
CREATE INDEX IF NOT EXISTS idx_followup_results_analysis_id ON followup_results(followup_analysis_id);
CREATE INDEX IF NOT EXISTS idx_followup_results_user_id ON followup_results(user_id);
CREATE INDEX IF NOT EXISTS idx_followup_results_company_id ON followup_results(company_id);
CREATE INDEX IF NOT EXISTS idx_followup_results_funcionou ON followup_results(funcionou);

-- RLS (Row Level Security) para isolamento multi-tenant
ALTER TABLE followup_results ENABLE ROW LEVEL SECURITY;

-- Policy: Usuários podem ver apenas resultados da sua empresa
CREATE POLICY "Users can view followup results from their company"
  ON followup_results
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id
      FROM employees
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Usuários podem inserir resultados para sua empresa
CREATE POLICY "Users can insert followup results for their company"
  ON followup_results
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id
      FROM employees
      WHERE user_id = auth.uid()
    )
    AND user_id = auth.uid()
  );

-- Policy: Usuários podem atualizar seus próprios resultados
CREATE POLICY "Users can update their own followup results"
  ON followup_results
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Policy: Usuários podem deletar seus próprios resultados
CREATE POLICY "Users can delete their own followup results"
  ON followup_results
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Policy: Service role tem acesso total
CREATE POLICY "Service role has full access to followup_results"
  ON followup_results
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Comentários para documentação
COMMENT ON TABLE followup_results IS 'Resultados de follow-ups marcados pelos vendedores para aprendizado da IA';
COMMENT ON COLUMN followup_results.funcionou IS 'Se o follow-up funcionou (true) ou não funcionou (false)';
COMMENT ON COLUMN followup_results.lead_respondeu IS 'Se o lead respondeu ao follow-up';
COMMENT ON COLUMN followup_results.lead_avancou_fase IS 'Se o lead avançou para próxima fase do funil';
COMMENT ON COLUMN followup_results.observacoes IS 'Observações adicionais do vendedor sobre o resultado';
