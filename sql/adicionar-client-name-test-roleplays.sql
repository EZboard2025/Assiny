-- Adicionar colunas faltantes na tabela test_roleplays
-- Execute no Supabase SQL Editor

-- Coluna client_name
ALTER TABLE test_roleplays
ADD COLUMN IF NOT EXISTS client_name TEXT;

-- Coluna referrer
ALTER TABLE test_roleplays
ADD COLUMN IF NOT EXISTS referrer TEXT;

-- Coluna user_agent
ALTER TABLE test_roleplays
ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- Coluna objective (objetivo da venda)
ALTER TABLE test_roleplays
ADD COLUMN IF NOT EXISTS objective TEXT;

-- Comentários
COMMENT ON COLUMN test_roleplays.client_name IS 'Nome gerado para o cliente virtual';
COMMENT ON COLUMN test_roleplays.referrer IS 'URL de origem do visitante';
COMMENT ON COLUMN test_roleplays.user_agent IS 'User agent do navegador';
COMMENT ON COLUMN test_roleplays.objective IS 'Objetivo do vendedor nessa simulação';
