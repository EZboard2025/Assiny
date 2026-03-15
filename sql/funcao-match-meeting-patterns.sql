-- ============================================================================
-- Funções RPC para busca semântica de padrões de reuniões reais
-- ============================================================================

-- match_meeting_patterns: Busca padrões similares ao contexto do roleplay
CREATE OR REPLACE FUNCTION match_meeting_patterns(
  query_embedding VECTOR(1536),
  company_id_filter UUID,
  pattern_type_filter TEXT DEFAULT NULL,
  match_threshold FLOAT DEFAULT 0.6,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  pattern_type TEXT,
  pattern_data JSONB,
  content TEXT,
  frequency INTEGER,
  similarity FLOAT
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    mp.id,
    mp.pattern_type::TEXT,
    mp.pattern_data,
    mp.content,
    mp.frequency,
    (1 - (mp.embedding <=> query_embedding))::FLOAT AS similarity
  FROM meeting_patterns mp
  WHERE mp.company_id = company_id_filter
    AND mp.embedding IS NOT NULL
    AND (pattern_type_filter IS NULL OR mp.pattern_type = pattern_type_filter)
    AND 1 - (mp.embedding <=> query_embedding) > match_threshold
  ORDER BY mp.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- match_real_objections: Busca objeções reais similares
CREATE OR REPLACE FUNCTION match_real_objections(
  query_embedding VECTOR(1536),
  company_id_filter UUID,
  objection_type_filter TEXT DEFAULT NULL,
  match_threshold FLOAT DEFAULT 0.6,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  objection_type TEXT,
  objection_text TEXT,
  client_exact_phrases JSONB,
  frequency INTEGER,
  avg_resolution_score NUMERIC,
  similarity FLOAT
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    rob.id,
    rob.objection_type::TEXT,
    rob.objection_text,
    rob.client_exact_phrases,
    rob.frequency,
    rob.avg_resolution_score,
    (1 - (rob.embedding <=> query_embedding))::FLOAT AS similarity
  FROM real_objection_bank rob
  WHERE rob.company_id = company_id_filter
    AND rob.embedding IS NOT NULL
    AND (objection_type_filter IS NULL OR rob.objection_type = objection_type_filter)
    AND 1 - (rob.embedding <=> query_embedding) > match_threshold
  ORDER BY rob.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
