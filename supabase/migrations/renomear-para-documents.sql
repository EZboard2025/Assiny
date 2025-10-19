-- Renomear tabela para compatibilidade com N8N Supabase Vector Store
ALTER TABLE IF EXISTS public.company_knowledge_embeddings
RENAME TO documents;

-- Renomear indexes
ALTER INDEX IF EXISTS company_embeddings_vector_idx
RENAME TO documents_embedding_idx;

ALTER INDEX IF EXISTS company_embeddings_category_idx
RENAME TO documents_category_idx;

ALTER INDEX IF EXISTS company_embeddings_company_id_idx
RENAME TO documents_company_id_idx;

-- Atualizar comentários
COMMENT ON TABLE public.documents IS 'Embeddings vetoriais dos dados da empresa (compatível com N8N Vector Store)';
