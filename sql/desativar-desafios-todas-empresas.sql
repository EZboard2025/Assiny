-- Desativa a geração de desafios diários para todas as empresas
-- Execute este comando no Supabase SQL Editor

UPDATE companies
SET daily_challenges_enabled = false;

-- Verificar resultado
SELECT id, name, subdomain, daily_challenges_enabled
FROM companies
ORDER BY name;
