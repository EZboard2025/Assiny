-- Adicionar coluna metadata que o N8N espera
ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Preencher metadata com dados das colunas existentes
UPDATE public.documents
SET metadata = jsonb_build_object(
  'category', category,
  'question', question,
  'company_data_id', company_data_id::text
)
WHERE metadata = '{}'::jsonb OR metadata IS NULL;

-- Criar index para buscar por metadata
CREATE INDEX IF NOT EXISTS documents_metadata_idx
  ON public.documents USING gin(metadata);

-- Comentário
COMMENT ON COLUMN public.documents.metadata IS 'Metadados adicionais em formato JSONB (compatível com N8N)';
