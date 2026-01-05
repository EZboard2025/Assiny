-- Adicionar coluna 'interested' na tabela test_roleplays
-- Esta coluna marca se o lead demonstrou interesse após o teste

ALTER TABLE test_roleplays
ADD COLUMN IF NOT EXISTS interested BOOLEAN DEFAULT FALSE;

-- Adicionar coluna para timestamp de quando demonstrou interesse
ALTER TABLE test_roleplays
ADD COLUMN IF NOT EXISTS interested_at TIMESTAMP WITH TIME ZONE;

-- Comentário para documentação
COMMENT ON COLUMN test_roleplays.interested IS 'Indica se o lead clicou em "Tenho Interesse" após a avaliação';
COMMENT ON COLUMN test_roleplays.interested_at IS 'Timestamp de quando o lead demonstrou interesse';
