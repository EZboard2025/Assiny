-- Tabela para rastrear gerações de conteúdo com IA
-- Cada registro representa uma geração (0.5 créditos)

CREATE TABLE IF NOT EXISTS ai_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  generation_type TEXT NOT NULL, -- 'ai-extract', 'ai-generate-objections', 'ai-generate-personas', 'ai-generate-objectives', 'ai-refine-objections', etc.
  credits_used DECIMAL(4,2) NOT NULL DEFAULT 0.5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_ai_generations_company_id ON ai_generations(company_id);
CREATE INDEX IF NOT EXISTS idx_ai_generations_created_at ON ai_generations(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_generations_company_created ON ai_generations(company_id, created_at);

-- RLS para segurança
ALTER TABLE ai_generations ENABLE ROW LEVEL SECURITY;

-- Policy: Service role tem acesso total
CREATE POLICY "Service role has full access to ai_generations"
ON ai_generations
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Policy: Usuários autenticados podem ver gerações da sua empresa
CREATE POLICY "Users can view their company ai_generations"
ON ai_generations
FOR SELECT
TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM employees WHERE user_id = auth.uid()
  )
);

-- Comentário na tabela
COMMENT ON TABLE ai_generations IS 'Registra cada geração de conteúdo com IA para tracking de uso (0.5 créditos cada)';
