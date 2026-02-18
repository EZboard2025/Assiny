-- Adicionar UNIQUE constraint em meeting_id na tabela meet_evaluations
-- Previne duplicatas causadas por race condition entre frontend e background processing

-- 1. Remover duplicatas existentes (manter o mais recente de cada meeting_id)
DELETE FROM meet_evaluations
WHERE id NOT IN (
  SELECT DISTINCT ON (meeting_id) id
  FROM meet_evaluations
  ORDER BY meeting_id, created_at DESC
);

-- 2. Adicionar UNIQUE constraint
ALTER TABLE meet_evaluations
ADD CONSTRAINT meet_evaluations_meeting_id_unique UNIQUE (meeting_id);
