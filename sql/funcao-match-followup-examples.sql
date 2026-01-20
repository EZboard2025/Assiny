-- Função para buscar follow-ups similares usando busca semântica
-- Retorna exemplos de follow-ups que funcionaram ou não, baseado em similaridade de contexto
-- ATUALIZADA: Agora suporta busca por company_id OU user_id (para dados legados)

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

-- Comentários para documentação
COMMENT ON FUNCTION match_followup_examples IS 'Busca follow-ups similares usando embeddings vetoriais para aprendizado da IA';

-- Exemplo de uso:
-- SELECT * FROM match_followup_examples(
--   query_embedding := '[0.1, 0.2, ...]'::vector(1536),
--   company_id_filter := 'uuid-da-empresa',
--   tipo_venda_filter := 'B2B',
--   canal_filter := 'WhatsApp',
--   match_threshold := 0.75,
--   match_count := 5
-- );
