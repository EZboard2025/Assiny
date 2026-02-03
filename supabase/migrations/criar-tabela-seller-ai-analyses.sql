-- Tabela para armazenar análises de IA dos vendedores
-- Permite salvar o histórico de análises geradas pelo gestor

CREATE TABLE IF NOT EXISTS seller_ai_analyses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Referências
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  generated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Quem gerou (gestor)

  -- Dados da análise
  ai_summary JSONB NOT NULL, -- O resumo completo gerado pela IA
  raw_metrics JSONB, -- Métricas brutas no momento da geração

  -- Metadados
  credits_used INTEGER DEFAULT 1,
  model_used VARCHAR(50) DEFAULT 'gpt-4.1',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_seller_ai_analyses_seller_id ON seller_ai_analyses(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_ai_analyses_company_id ON seller_ai_analyses(company_id);
CREATE INDEX IF NOT EXISTS idx_seller_ai_analyses_created_at ON seller_ai_analyses(created_at DESC);

-- Índice composto para buscar análises de um vendedor em uma empresa
CREATE INDEX IF NOT EXISTS idx_seller_ai_analyses_seller_company
ON seller_ai_analyses(seller_id, company_id, created_at DESC);

-- RLS (Row Level Security)
ALTER TABLE seller_ai_analyses ENABLE ROW LEVEL SECURITY;

-- Policy: Admins podem ver análises da sua empresa
CREATE POLICY "Admins can view analyses from their company" ON seller_ai_analyses
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM employees WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Policy: Admins podem inserir análises na sua empresa
CREATE POLICY "Admins can insert analyses for their company" ON seller_ai_analyses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM employees WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Policy: Service role tem acesso total
CREATE POLICY "Service role has full access to seller_ai_analyses" ON seller_ai_analyses
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_seller_ai_analyses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_seller_ai_analyses_updated_at
  BEFORE UPDATE ON seller_ai_analyses
  FOR EACH ROW
  EXECUTE FUNCTION update_seller_ai_analyses_updated_at();

-- Comentários
COMMENT ON TABLE seller_ai_analyses IS 'Armazena análises de IA geradas para vendedores';
COMMENT ON COLUMN seller_ai_analyses.ai_summary IS 'JSON completo com summary, highlights, concerns, recommendations, spin_analysis, etc';
COMMENT ON COLUMN seller_ai_analyses.raw_metrics IS 'Métricas brutas do vendedor no momento da geração';
COMMENT ON COLUMN seller_ai_analyses.generated_by IS 'ID do usuário (gestor) que solicitou a análise';
