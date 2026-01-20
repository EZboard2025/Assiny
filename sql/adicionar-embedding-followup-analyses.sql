-- Adicionar coluna de embedding na tabela followup_analyses
-- Permite busca semântica de follow-ups similares para aprendizado da IA

-- Garantir que a extensão pgvector está habilitada
CREATE EXTENSION IF NOT EXISTS vector;

-- Adicionar coluna embedding (1536 dimensões - padrão do OpenAI text-embedding-ada-002)
ALTER TABLE followup_analyses
ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Criar índice para busca de similaridade (HNSW - Hierarchical Navigable Small World)
-- Usa distância de cosseno (cosine) para medir similaridade
CREATE INDEX IF NOT EXISTS idx_followup_analyses_embedding
ON followup_analyses
USING hnsw (embedding vector_cosine_ops);

-- Comentários para documentação
COMMENT ON COLUMN followup_analyses.embedding IS 'Vector embedding da transcrição filtrada (1536 dim) para busca semântica';
COMMENT ON INDEX idx_followup_analyses_embedding IS 'Índice HNSW para busca rápida de follow-ups similares por cosseno';
