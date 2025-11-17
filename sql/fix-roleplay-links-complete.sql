-- Migration: Corrigir estrutura da tabela roleplay_links
-- Data: 2025-11-17
-- Motivo: Adicionar colunas faltantes e padronizar nomenclatura

-- 1. Adicionar colunas faltantes
ALTER TABLE roleplay_links
ADD COLUMN IF NOT EXISTS link_code TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS name TEXT,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- 2. Gerar link_code para registros existentes (se não tiverem)
UPDATE roleplay_links
SET link_code = UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8))
WHERE link_code IS NULL;

-- 3. Gerar name padrão para registros existentes (se não tiverem)
UPDATE roleplay_links
SET name = 'Roleplay Link ' || SUBSTRING(id::TEXT FROM 1 FOR 8)
WHERE name IS NULL;

-- 4. Renomear 'age_range' para 'age' no config JSONB
UPDATE roleplay_links
SET config = config - 'age_range' || jsonb_build_object('age', config->>'age_range')
WHERE config ? 'age_range';

-- 5. Tornar colunas obrigatórias (NOT NULL)
ALTER TABLE roleplay_links
ALTER COLUMN link_code SET NOT NULL,
ALTER COLUMN name SET NOT NULL;

-- 6. Verificar resultado
SELECT
  id,
  link_code,
  name,
  description,
  is_active,
  config->'age' as age,
  config->'temperament' as temperament,
  config->'persona_id' as persona_id,
  config
FROM roleplay_links
ORDER BY created_at DESC
LIMIT 10;
