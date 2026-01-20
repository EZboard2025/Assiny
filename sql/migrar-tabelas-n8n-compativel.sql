-- =============================================================================
-- MIGRAÇÃO: Tornar tabelas compatíveis com N8N Supabase Vector Store
-- =============================================================================
-- Execute APENAS se você já criou as tabelas antes desta atualização
-- =============================================================================

-- Adicionar coluna 'content' (N8N usa este nome por padrão)
ALTER TABLE followup_examples_success
ADD COLUMN IF NOT EXISTS content TEXT;

ALTER TABLE followup_examples_failure
ADD COLUMN IF NOT EXISTS content TEXT;

-- Adicionar coluna 'metadata' (JSONB para filtros do N8N)
ALTER TABLE followup_examples_success
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

ALTER TABLE followup_examples_failure
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Migrar dados existentes (se houver)
UPDATE followup_examples_success
SET content = transcricao,
    metadata = jsonb_build_object(
      'company_id', company_id,
      'tipo_venda', tipo_venda,
      'canal', canal,
      'fase_funil', fase_funil,
      'nota_original', nota_original
    )
WHERE content IS NULL AND transcricao IS NOT NULL;

UPDATE followup_examples_failure
SET content = transcricao,
    metadata = jsonb_build_object(
      'company_id', company_id,
      'tipo_venda', tipo_venda,
      'canal', canal,
      'fase_funil', fase_funil,
      'nota_original', nota_original
    )
WHERE content IS NULL AND transcricao IS NOT NULL;

-- Criar índice GIN para busca rápida no metadata
CREATE INDEX IF NOT EXISTS idx_followup_success_metadata ON followup_examples_success USING GIN (metadata);
CREATE INDEX IF NOT EXISTS idx_followup_failure_metadata ON followup_examples_failure USING GIN (metadata);
