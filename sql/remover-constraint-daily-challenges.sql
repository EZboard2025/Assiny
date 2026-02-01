-- Remove a constraint UNIQUE para permitir múltiplos desafios por dia por usuário
-- Executar este script no Supabase SQL Editor

-- Remove a constraint
ALTER TABLE daily_challenges
DROP CONSTRAINT IF EXISTS unique_daily_challenge;

-- Verifica se foi removida
SELECT constraint_name
FROM information_schema.table_constraints
WHERE table_name = 'daily_challenges' AND constraint_type = 'UNIQUE';
