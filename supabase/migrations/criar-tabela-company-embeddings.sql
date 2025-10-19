-- Habilitar extensão pgvector para embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Tabela de embeddings para busca semântica
CREATE TABLE IF NOT EXISTS public.company_knowledge_embeddings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_data_id UUID REFERENCES public.company_data(id) ON DELETE CASCADE,
  category TEXT NOT NULL, -- 'identidade', 'produtos', 'diferenciais', 'concorrentes', 'metricas', 'erros', 'posicionamento'
  question TEXT NOT NULL, -- Pergunta que esse chunk responde
  content TEXT NOT NULL, -- Conteúdo textual do chunk
  embedding VECTOR(1536), -- Embedding OpenAI ada-002
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index para busca vetorial ultra-rápida
CREATE INDEX IF NOT EXISTS company_embeddings_vector_idx
  ON public.company_knowledge_embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Index para filtrar por categoria
CREATE INDEX IF NOT EXISTS company_embeddings_category_idx
  ON public.company_knowledge_embeddings(category);

-- Index para buscar por company_data_id
CREATE INDEX IF NOT EXISTS company_embeddings_company_id_idx
  ON public.company_knowledge_embeddings(company_data_id);

-- Enable Row Level Security
ALTER TABLE public.company_knowledge_embeddings ENABLE ROW LEVEL SECURITY;

-- Policy: Todos podem ler
CREATE POLICY "Permitir leitura para todos"
  ON public.company_knowledge_embeddings
  FOR SELECT
  USING (true);

-- Policy: Apenas autenticados podem inserir/atualizar/deletar
CREATE POLICY "Permitir insert/update/delete para autenticados"
  ON public.company_knowledge_embeddings
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Função de busca semântica por similaridade
CREATE OR REPLACE FUNCTION match_company_knowledge(
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  company_data_id UUID,
  category TEXT,
  question TEXT,
  content TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    company_knowledge_embeddings.id,
    company_knowledge_embeddings.company_data_id,
    company_knowledge_embeddings.category,
    company_knowledge_embeddings.question,
    company_knowledge_embeddings.content,
    1 - (company_knowledge_embeddings.embedding <=> query_embedding) AS similarity
  FROM company_knowledge_embeddings
  WHERE 1 - (company_knowledge_embeddings.embedding <=> query_embedding) > match_threshold
  ORDER BY company_knowledge_embeddings.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Comentários para documentação
COMMENT ON TABLE public.company_knowledge_embeddings IS 'Embeddings vetoriais dos dados da empresa para busca semântica';
COMMENT ON COLUMN public.company_knowledge_embeddings.category IS 'Categoria do conhecimento (identidade, produtos, diferenciais, etc)';
COMMENT ON COLUMN public.company_knowledge_embeddings.question IS 'Pergunta que esse chunk de conhecimento responde';
COMMENT ON COLUMN public.company_knowledge_embeddings.content IS 'Conteúdo textual do conhecimento';
COMMENT ON COLUMN public.company_knowledge_embeddings.embedding IS 'Vetor de embedding 1536 dimensões (OpenAI ada-002)';
COMMENT ON FUNCTION match_company_knowledge IS 'Busca semântica de conhecimento da empresa por similaridade vetorial';
