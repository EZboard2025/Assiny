-- Script para apagar a empresa teste e todos os dados relacionados
-- CUIDADO: Isso apagará TODOS os dados da empresa!

-- Apagar empresa teste (CASCADE apagará todos os dados relacionados)
DELETE FROM companies
WHERE subdomain = 'teste1761761854330';

-- Verificar se foi apagada
SELECT COUNT(*) as empresas_restantes
FROM companies
WHERE subdomain LIKE 'teste%';

-- Listar empresas que sobraram
SELECT id, name, subdomain, created_at
FROM companies
ORDER BY created_at DESC;