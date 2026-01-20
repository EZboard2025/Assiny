-- =============================================================================
-- CORREÇÃO COMPLETA DO SISTEMA RAG DE FOLLOW-UPS
-- =============================================================================
-- Execute este SQL no Supabase Dashboard para corrigir o problema dos exemplos
-- não sendo enviados ao N8N.
--
-- PROBLEMA: A função match_followup_examples buscava por fa.company_id, mas
-- a tabela followup_analyses não tinha essa coluna.
--
-- SOLUÇÃO:
-- 1. Adicionar coluna company_id em followup_analyses
-- 2. Atualizar dados existentes para vincular ao company_id correto
-- 3. Atualizar a função match_followup_examples para funcionar com ambos os casos
-- =============================================================================

-- PASSO 1: Adicionar coluna company_id na tabela followup_analyses
-- ---------------------------------------------------------------
ALTER TABLE followup_analyses
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

-- Criar índice para busca rápida
CREATE INDEX IF NOT EXISTS idx_followup_analyses_company_id ON followup_analyses(company_id);

-- PASSO 2: Atualizar dados existentes
-- -----------------------------------
-- Vincula follow-ups existentes às empresas através da tabela employees
UPDATE followup_analyses fa
SET company_id = e.company_id
FROM employees e
WHERE fa.user_id = e.user_id
AND fa.company_id IS NULL;

-- PASSO 3: Atualizar a função match_followup_examples
-- ---------------------------------------------------
-- Agora busca por company_id tanto em followup_analyses quanto em followup_results
CREATE OR REPLACE FUNCTION match_followup_examples(
  query_embedding vector(1536),
  company_id_filter uuid,
  tipo_venda_filter text DEFAULT NULL,
  canal_filter text DEFAULT NULL,
  fase_funil_filter text DEFAULT NULL,
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  transcricao_filtrada text,
  tipo_venda text,
  canal text,
  fase_funil text,
  nota_final numeric,
  classificacao text,
  funcionou boolean,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    fa.id,
    fa.transcricao_filtrada,
    fa.tipo_venda,
    fa.canal,
    fa.fase_funil,
    fa.nota_final,
    fa.classificacao,
    fr.funcionou,
    1 - (fa.embedding <=> query_embedding) AS similarity
  FROM followup_analyses fa
  INNER JOIN followup_results fr ON fr.followup_analysis_id = fa.id
  WHERE
    -- Filtro por company_id: aceita tanto pelo company_id direto quanto pelo company_id da tabela results
    (fa.company_id = company_id_filter OR fr.company_id = company_id_filter)
    AND fa.embedding IS NOT NULL
    AND fr.funcionou IS NOT NULL  -- Apenas follow-ups com feedback
    AND (tipo_venda_filter IS NULL OR fa.tipo_venda = tipo_venda_filter)
    AND (canal_filter IS NULL OR fa.canal = canal_filter)
    AND (fase_funil_filter IS NULL OR fa.fase_funil = fase_funil_filter)
    AND 1 - (fa.embedding <=> query_embedding) > match_threshold
  ORDER BY fa.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Comentário para documentação
COMMENT ON FUNCTION match_followup_examples IS 'Busca follow-ups similares usando embeddings vetoriais para aprendizado da IA';

-- VERIFICAÇÃO: Execute estas queries para confirmar que está funcionando
-- ----------------------------------------------------------------------
-- 1. Verificar se a coluna company_id existe:
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'followup_analyses' AND column_name = 'company_id';

-- 2. Verificar se há dados com company_id:
-- SELECT id, user_id, company_id FROM followup_analyses LIMIT 10;

-- 3. Verificar follow-ups com feedback:
-- SELECT fa.id, fa.company_id, fr.funcionou
-- FROM followup_analyses fa
-- JOIN followup_results fr ON fr.followup_analysis_id = fa.id
-- LIMIT 10;

-- 4. Verificar se há embeddings gerados:
-- SELECT id, (embedding IS NOT NULL) as tem_embedding FROM followup_analyses LIMIT 10;
