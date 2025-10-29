-- Script para verificar isolamento de dados entre empresas
-- Execute este script para garantir que cada empresa tem seus próprios dados

-- 1. Verificar personas por empresa
SELECT
    c.name as empresa,
    c.subdomain,
    COUNT(p.id) as total_personas,
    STRING_AGG(DISTINCT p.business_type, ', ') as tipos,
    STRING_AGG(
        CASE
            WHEN p.job_title IS NOT NULL THEN p.job_title
            ELSE p.profession
        END,
        ', '
    ) as titulos
FROM companies c
LEFT JOIN personas p ON p.company_id = c.id
GROUP BY c.id, c.name, c.subdomain
ORDER BY c.name;

-- 2. Verificar objeções por empresa
SELECT
    c.name as empresa,
    c.subdomain,
    COUNT(o.id) as total_objections,
    STRING_AGG(o.name, ', ' ORDER BY o.name) as objections_list
FROM companies c
LEFT JOIN objections o ON o.company_id = c.id
GROUP BY c.id, c.name, c.subdomain
ORDER BY c.name;

-- 3. Verificar company_data por empresa
SELECT
    c.name as empresa,
    c.subdomain,
    CASE
        WHEN cd.id IS NOT NULL THEN 'Configurado'
        ELSE 'Não configurado'
    END as dados_empresa,
    cd.nome,
    LEFT(cd.descricao, 50) || '...' as descricao_preview
FROM companies c
LEFT JOIN company_data cd ON cd.company_id = c.id
ORDER BY c.name;

-- 4. Verificar company_type por empresa
SELECT
    c.name as empresa,
    c.subdomain,
    ct.name as business_type
FROM companies c
LEFT JOIN company_type ct ON ct.company_id = c.id
ORDER BY c.name;

-- 5. ALERTA: Verificar personas SEM company_id (problema crítico!)
SELECT
    'ALERTA: Personas sem company_id!' as warning,
    COUNT(*) as total,
    STRING_AGG(
        CASE
            WHEN job_title IS NOT NULL THEN job_title
            ELSE profession
        END,
        ', '
    ) as personas_orphaned
FROM personas
WHERE company_id IS NULL;

-- 6. ALERTA: Verificar objeções SEM company_id (problema crítico!)
SELECT
    'ALERTA: Objeções sem company_id!' as warning,
    COUNT(*) as total,
    STRING_AGG(name, ', ') as objections_orphaned
FROM objections
WHERE company_id IS NULL;

-- 7. Resumo geral de isolamento
WITH isolation_summary AS (
    SELECT
        c.id,
        c.name,
        c.subdomain,
        (SELECT COUNT(*) FROM personas WHERE company_id = c.id) as personas_count,
        (SELECT COUNT(*) FROM objections WHERE company_id = c.id) as objections_count,
        (SELECT COUNT(*) FROM company_data WHERE company_id = c.id) as has_company_data,
        (SELECT COUNT(*) FROM company_type WHERE company_id = c.id) as has_company_type,
        (SELECT COUNT(*) FROM employees WHERE company_id = c.id) as employees_count
    FROM companies c
)
SELECT
    '========== RESUMO DE ISOLAMENTO ==========' as info,
    name as empresa,
    subdomain,
    personas_count || ' personas' as personas,
    objections_count || ' objeções' as objections,
    employees_count || ' funcionários' as employees,
    CASE WHEN has_company_data > 0 THEN '✅' ELSE '❌' END || ' Dados' as data,
    CASE WHEN has_company_type > 0 THEN '✅' ELSE '❌' END || ' Tipo' as type
FROM isolation_summary
ORDER BY name;