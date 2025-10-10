-- Habilitar extensão vector (necessário para embeddings)
CREATE EXTENSION IF NOT EXISTS vector;

-- Tabela para armazenar documentos e seus embeddings
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  file_name TEXT NOT NULL,
  file_type TEXT,
  content TEXT NOT NULL,
  embedding VECTOR(1536), -- Dimensão padrão do OpenAI text-embedding-ada-002
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Criar índice para busca vetorial eficiente
CREATE INDEX IF NOT EXISTS documents_embedding_idx
ON public.documents
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso (permitir leitura para usuários autenticados)
CREATE POLICY "Permitir leitura de documentos para usuários autenticados"
  ON public.documents FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Permitir inserção de documentos para usuários autenticados"
  ON public.documents FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Permitir atualização de documentos para usuários autenticados"
  ON public.documents FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Permitir exclusão de documentos para usuários autenticados"
  ON public.documents FOR DELETE
  TO authenticated
  USING (true);

-- Função para buscar documentos similares usando busca semântica
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  file_name TEXT,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    documents.id,
    documents.file_name,
    documents.content,
    documents.metadata,
    1 - (documents.embedding <=> query_embedding) AS similarity
  FROM public.documents
  WHERE 1 - (documents.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
$$;

-- Comentários para documentação
COMMENT ON TABLE public.documents IS 'Armazena documentos processados e seus embeddings para busca semântica';
COMMENT ON COLUMN public.documents.embedding IS 'Vetor de embedding gerado pelo OpenAI (dimensão 1536)';
COMMENT ON COLUMN public.documents.metadata IS 'Informações adicionais sobre o documento (chunk index, timestamps, etc)';
COMMENT ON FUNCTION match_documents IS 'Busca documentos similares usando similaridade de cosseno';
