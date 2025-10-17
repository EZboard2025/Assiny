-- Limpar tabela e função antigas
DROP FUNCTION IF EXISTS match_knowledge(vector, double precision, integer);
DROP TABLE IF EXISTS knowledge_embeddings CASCADE;

-- Tabela para armazenar embeddings de SPIN Selling e Pedagogia
-- Busca semântica para o agente AI
-- Compatível com N8N Supabase Vector Store

CREATE EXTENSION IF NOT EXISTS vector;
  
CREATE TABLE knowledge_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  embedding VECTOR(1536) NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice vetorial para busca de similaridade
CREATE INDEX idx_knowledge_embeddings_vector
  ON knowledge_embeddings
  USING hnsw (embedding vector_cosine_ops);

-- Função de busca por similaridade
CREATE FUNCTION match_knowledge(
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    knowledge_embeddings.id,
    knowledge_embeddings.content,
    knowledge_embeddings.metadata,
    1 - (knowledge_embeddings.embedding <=> query_embedding) AS similarity
  FROM knowledge_embeddings
  WHERE 1 - (knowledge_embeddings.embedding <=> query_embedding) > match_threshold
  ORDER BY knowledge_embeddings.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- RLS
ALTER TABLE knowledge_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can read knowledge"
  ON knowledge_embeddings FOR SELECT USING (true);

CREATE POLICY "Service role can manage knowledge"
  ON knowledge_embeddings FOR ALL USING (auth.role() = 'service_role');
