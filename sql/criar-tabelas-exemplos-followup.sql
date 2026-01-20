-- =============================================================================
-- TABELAS SEPARADAS PARA EXEMPLOS DE FOLLOW-UP (SUCESSO E FALHA)
-- =============================================================================
-- Arquitetura simplificada: duas tabelas separadas para facilitar a busca RAG
-- =============================================================================

-- TABELA 1: Follow-ups que FUNCIONARAM
-- ------------------------------------
CREATE TABLE IF NOT EXISTS followup_examples_success (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Contexto
  tipo_venda VARCHAR(10) NOT NULL,  -- B2B ou B2C
  canal VARCHAR(50) NOT NULL,        -- WhatsApp, E-mail, etc
  fase_funil VARCHAR(100),           -- Fase do funil

  -- Conteúdo (N8N usa 'content' como padrão)
  content TEXT NOT NULL,             -- Texto do follow-up (N8N compatível)
  nota_original DECIMAL(4,2),        -- Nota que recebeu na avaliação

  -- Embedding para busca semântica
  embedding vector(1536),

  -- Metadata para filtros do N8N (JSONB)
  metadata JSONB DEFAULT '{}',       -- { company_id, tipo_venda, canal, fase_funil }

  -- Metadados extras
  followup_analysis_id UUID,         -- Referência opcional ao follow-up original
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABELA 2: Follow-ups que NÃO FUNCIONARAM
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS followup_examples_failure (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Contexto
  tipo_venda VARCHAR(10) NOT NULL,  -- B2B ou B2C
  canal VARCHAR(50) NOT NULL,        -- WhatsApp, E-mail, etc
  fase_funil VARCHAR(100),           -- Fase do funil

  -- Conteúdo (N8N usa 'content' como padrão)
  content TEXT NOT NULL,             -- Texto do follow-up (N8N compatível)
  nota_original DECIMAL(4,2),        -- Nota que recebeu na avaliação

  -- Embedding para busca semântica
  embedding vector(1536),

  -- Metadata para filtros do N8N (JSONB)
  metadata JSONB DEFAULT '{}',       -- { company_id, tipo_venda, canal, fase_funil }

  -- Metadados extras
  followup_analysis_id UUID,         -- Referência opcional ao follow-up original
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ÍNDICES
-- -------
CREATE INDEX IF NOT EXISTS idx_followup_success_company ON followup_examples_success(company_id);
CREATE INDEX IF NOT EXISTS idx_followup_success_tipo ON followup_examples_success(tipo_venda);
CREATE INDEX IF NOT EXISTS idx_followup_success_canal ON followup_examples_success(canal);

CREATE INDEX IF NOT EXISTS idx_followup_failure_company ON followup_examples_failure(company_id);
CREATE INDEX IF NOT EXISTS idx_followup_failure_tipo ON followup_examples_failure(tipo_venda);
CREATE INDEX IF NOT EXISTS idx_followup_failure_canal ON followup_examples_failure(canal);

-- RLS (Row Level Security)
-- ------------------------
ALTER TABLE followup_examples_success ENABLE ROW LEVEL SECURITY;
ALTER TABLE followup_examples_failure ENABLE ROW LEVEL SECURITY;

-- Políticas para followup_examples_success
CREATE POLICY "Users can view success examples from their company"
  ON followup_examples_success FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM employees WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert success examples for their company"
  ON followup_examples_success FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM employees WHERE user_id = auth.uid()));

CREATE POLICY "Service role full access to success examples"
  ON followup_examples_success FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Políticas para followup_examples_failure
CREATE POLICY "Users can view failure examples from their company"
  ON followup_examples_failure FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM employees WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert failure examples for their company"
  ON followup_examples_failure FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM employees WHERE user_id = auth.uid()));

CREATE POLICY "Service role full access to failure examples"
  ON followup_examples_failure FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- FUNÇÕES DE BUSCA SEMÂNTICA
-- --------------------------

-- Buscar exemplos de SUCESSO similares
CREATE OR REPLACE FUNCTION match_followup_success(
  query_embedding vector(1536),
  company_id_filter uuid,
  tipo_venda_filter text DEFAULT NULL,
  canal_filter text DEFAULT NULL,
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 3
)
RETURNS TABLE (
  id uuid,
  transcricao text,
  tipo_venda text,
  canal text,
  nota_original numeric,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    fes.id,
    fes.transcricao,
    fes.tipo_venda,
    fes.canal,
    fes.nota_original,
    1 - (fes.embedding <=> query_embedding) AS similarity
  FROM followup_examples_success fes
  WHERE
    fes.company_id = company_id_filter
    AND fes.embedding IS NOT NULL
    AND (tipo_venda_filter IS NULL OR fes.tipo_venda = tipo_venda_filter)
    AND (canal_filter IS NULL OR fes.canal = canal_filter)
    AND 1 - (fes.embedding <=> query_embedding) > match_threshold
  ORDER BY fes.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Buscar exemplos de FALHA similares
CREATE OR REPLACE FUNCTION match_followup_failure(
  query_embedding vector(1536),
  company_id_filter uuid,
  tipo_venda_filter text DEFAULT NULL,
  canal_filter text DEFAULT NULL,
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 3
)
RETURNS TABLE (
  id uuid,
  transcricao text,
  tipo_venda text,
  canal text,
  nota_original numeric,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    fef.id,
    fef.transcricao,
    fef.tipo_venda,
    fef.canal,
    fef.nota_original,
    1 - (fef.embedding <=> query_embedding) AS similarity
  FROM followup_examples_failure fef
  WHERE
    fef.company_id = company_id_filter
    AND fef.embedding IS NOT NULL
    AND (tipo_venda_filter IS NULL OR fef.tipo_venda = tipo_venda_filter)
    AND (canal_filter IS NULL OR fef.canal = canal_filter)
    AND 1 - (fef.embedding <=> query_embedding) > match_threshold
  ORDER BY fef.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Comentários
COMMENT ON TABLE followup_examples_success IS 'Follow-ups que funcionaram - usados como exemplos positivos para a IA';
COMMENT ON TABLE followup_examples_failure IS 'Follow-ups que não funcionaram - usados como exemplos negativos para a IA';
COMMENT ON FUNCTION match_followup_success IS 'Busca follow-ups de sucesso similares usando embeddings';
COMMENT ON FUNCTION match_followup_failure IS 'Busca follow-ups de falha similares usando embeddings';
