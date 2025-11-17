-- Migration: Renomear 'age_range' para 'age' no campo config JSONB da tabela roleplay_links
-- Data: 2025-11-17
-- Motivo: Padronizar nomenclatura (age_range → age) para consistência com código

-- Atualizar todos os registros existentes que têm 'age_range' no config
UPDATE roleplay_links
SET config = config - 'age_range' || jsonb_build_object('age', config->>'age_range')
WHERE config ? 'age_range';

-- Verificar resultado
SELECT
  id,
  name,
  link_code,
  config->'age' as age,
  config->'age_range' as age_range_old,
  config
FROM roleplay_links
LIMIT 10;
