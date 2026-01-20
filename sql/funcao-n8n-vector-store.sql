-- =============================================================================
-- FUNÇÕES PARA N8N SUPABASE VECTOR STORE
-- =============================================================================
-- O N8N Supabase Vector Store espera funções com assinatura específica
-- Documentação: https://docs.n8n.io/integrations/builtin/cluster-nodes/root-nodes/n8n-nodes-langchain.vectorstoresupabase/
-- =============================================================================

-- IMPORTANTE: No N8N, configure:
-- - Table Name: followup_examples_success (ou followup_examples_failure)
-- - Query Name: match_followup_success (ou match_followup_failure)
-- =============================================================================

-- =============================================================================
-- PRIMEIRO: Remover TODAS as versões anteriores das funções
-- =============================================================================
DROP FUNCTION IF EXISTS match_followup_success(vector(1536), uuid, text, text, float, int);
DROP FUNCTION IF EXISTS match_followup_success(vector(1536), int, jsonb);
DROP FUNCTION IF EXISTS match_followup_success(vector(1536), jsonb, int);
DROP FUNCTION IF EXISTS match_followup_success_n8n(vector(1536), jsonb, int);

DROP FUNCTION IF EXISTS match_followup_failure(vector(1536), uuid, text, text, float, int);
DROP FUNCTION IF EXISTS match_followup_failure(vector(1536), int, jsonb);
DROP FUNCTION IF EXISTS match_followup_failure(vector(1536), jsonb, int);
DROP FUNCTION IF EXISTS match_followup_failure_n8n(vector(1536), jsonb, int);

-- =============================================================================
-- CRIAR FUNÇÕES COMPATÍVEIS COM N8N
-- =============================================================================

-- Função para buscar na tabela de SUCESSO
-- Assinatura compatível com N8N: (query_embedding, match_count, filter)
CREATE OR REPLACE FUNCTION match_followup_success(
  query_embedding vector(1536),
  match_count int DEFAULT 5,
  filter jsonb DEFAULT '{}'
)
RETURNS TABLE (
  id uuid,
  content text,
  metadata jsonb,
  embedding vector(1536),
  similarity float
)
LANGUAGE plpgsql
AS $$
DECLARE
  company_filter text;
BEGIN
  -- Extrair company_id do filtro (vem como string do N8N)
  company_filter := filter->>'company_id';

  RETURN QUERY
  SELECT
    fes.id,
    fes.content,
    fes.metadata,
    fes.embedding,
    1 - (fes.embedding <=> query_embedding) AS similarity
  FROM followup_examples_success fes
  WHERE
    fes.embedding IS NOT NULL
    AND (company_filter IS NULL OR fes.metadata->>'company_id' = company_filter)
  ORDER BY fes.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Função para buscar na tabela de FALHA
-- Assinatura compatível com N8N: (query_embedding, match_count, filter)
CREATE OR REPLACE FUNCTION match_followup_failure(
  query_embedding vector(1536),
  match_count int DEFAULT 5,
  filter jsonb DEFAULT '{}'
)
RETURNS TABLE (
  id uuid,
  content text,
  metadata jsonb,
  embedding vector(1536),
  similarity float
)
LANGUAGE plpgsql
AS $$
DECLARE
  company_filter text;
BEGIN
  -- Extrair company_id do filtro (vem como string do N8N)
  company_filter := filter->>'company_id';

  RETURN QUERY
  SELECT
    fef.id,
    fef.content,
    fef.metadata,
    fef.embedding,
    1 - (fef.embedding <=> query_embedding) AS similarity
  FROM followup_examples_failure fef
  WHERE
    fef.embedding IS NOT NULL
    AND (company_filter IS NULL OR fef.metadata->>'company_id' = company_filter)
  ORDER BY fef.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Comentários
COMMENT ON FUNCTION match_followup_success(vector(1536), int, jsonb) IS 'Busca follow-ups de sucesso por similaridade - N8N compatível';
COMMENT ON FUNCTION match_followup_failure(vector(1536), int, jsonb) IS 'Busca follow-ups de falha por similaridade - N8N compatível';
