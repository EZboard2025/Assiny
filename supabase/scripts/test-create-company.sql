-- Script para testar criação de empresa via API
-- Este script verifica se todas as tabelas foram populadas corretamente

-- 1. Verificar empresas criadas recentemente
SELECT
    id,
    name,
    subdomain,
    created_at
FROM companies
ORDER BY created_at DESC
LIMIT 5;

-- 2. Verificar últimos usuários criados (no auth)
SELECT
    id,
    email,
    raw_user_meta_data->>'name' as name,
    created_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 5;

-- 3. Verificar employees vinculados
SELECT
    e.id,
    e.name,
    e.email,
    e.role,
    c.name as company_name,
    c.subdomain as company_subdomain
FROM employees e
JOIN companies c ON c.id = e.company_id
ORDER BY e.created_at DESC
LIMIT 5;

-- 4. Verificar company_type configurados
SELECT
    ct.name as business_type,
    c.name as company_name,
    c.subdomain
FROM company_type ct
JOIN companies c ON c.id = ct.company_id
ORDER BY ct.created_at DESC
LIMIT 5;

-- 5. Contar personas por empresa
SELECT
    c.name as company_name,
    c.subdomain,
    COUNT(p.id) as total_personas,
    STRING_AGG(p.business_type, ', ') as tipos
FROM companies c
LEFT JOIN personas p ON p.company_id = c.id
GROUP BY c.id, c.name, c.subdomain
ORDER BY c.created_at DESC
LIMIT 5;

-- 6. Contar objeções por empresa
SELECT
    c.name as company_name,
    c.subdomain,
    COUNT(o.id) as total_objections
FROM companies c
LEFT JOIN objections o ON o.company_id = c.id
GROUP BY c.id, c.name, c.subdomain
ORDER BY c.created_at DESC
LIMIT 5;

-- 7. Verificar company_data
SELECT
    cd.nome,
    cd.descricao,
    c.name as company_name,
    c.subdomain
FROM company_data cd
JOIN companies c ON c.id = cd.company_id
ORDER BY cd.created_at DESC
LIMIT 5;

-- 8. Resumo geral de uma empresa específica (substitua o subdomínio)
-- Exemplo: para verificar a empresa 'techsolutions'
/*
WITH target_company AS (
    SELECT id, name, subdomain
    FROM companies
    WHERE subdomain = 'techsolutions' -- ALTERE AQUI PARA O SUBDOMÍNIO CRIADO
)
SELECT
    'Empresa' as tipo,
    tc.name as valor
FROM target_company tc
UNION ALL
SELECT
    'Admin' as tipo,
    e.name || ' (' || e.email || ')' as valor
FROM employees e
JOIN target_company tc ON tc.id = e.company_id
WHERE e.role = 'admin'
UNION ALL
SELECT
    'Business Type' as tipo,
    ct.name as valor
FROM company_type ct
JOIN target_company tc ON tc.id = ct.company_id
UNION ALL
SELECT
    'Personas' as tipo,
    COUNT(p.id)::text as valor
FROM personas p
JOIN target_company tc ON tc.id = p.company_id
UNION ALL
SELECT
    'Objeções' as tipo,
    COUNT(o.id)::text as valor
FROM objections o
JOIN target_company tc ON tc.id = o.company_id
UNION ALL
SELECT
    'Company Data' as tipo,
    CASE WHEN cd.id IS NOT NULL THEN 'Configurado' ELSE 'Não configurado' END as valor
FROM target_company tc
LEFT JOIN company_data cd ON cd.company_id = tc.id;
*/