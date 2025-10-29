-- Verificar empresa específica criada pelo teste
-- Execute este script no Supabase SQL Editor para verificar se todos os dados foram criados

-- Substitua o ID da empresa pelo ID que foi retornado no teste
DEFINE company_id = 'fa07f6f0-a455-4e16-8160-81d77325ecf1';

-- 1. Verificar dados da empresa
SELECT
    'EMPRESA' as categoria,
    name,
    subdomain,
    created_at
FROM companies
WHERE id = 'fa07f6f0-a455-4e16-8160-81d77325ecf1';

-- 2. Verificar employee/admin
SELECT
    'EMPLOYEE/ADMIN' as categoria,
    name,
    email,
    role,
    user_id,
    company_id
FROM employees
WHERE company_id = 'fa07f6f0-a455-4e16-8160-81d77325ecf1';

-- 3. Verificar company_type
SELECT
    'COMPANY_TYPE' as categoria,
    name as business_type,
    company_id,
    created_at
FROM company_type
WHERE company_id = 'fa07f6f0-a455-4e16-8160-81d77325ecf1';

-- 4. Verificar personas criadas
SELECT
    'PERSONAS' as categoria,
    business_type,
    job_title,
    profession,
    context,
    company_id
FROM personas
WHERE company_id = 'fa07f6f0-a455-4e16-8160-81d77325ecf1';

-- 5. Verificar objeções criadas
SELECT
    'OBJECTIONS' as categoria,
    name,
    rebuttals,
    company_id
FROM objections
WHERE company_id = 'fa07f6f0-a455-4e16-8160-81d77325ecf1';

-- 6. Verificar company_data
SELECT
    'COMPANY_DATA' as categoria,
    nome,
    descricao,
    produtos_servicos,
    company_id
FROM company_data
WHERE company_id = 'fa07f6f0-a455-4e16-8160-81d77325ecf1';

-- 7. Resumo geral
WITH company_stats AS (
    SELECT
        c.name as company_name,
        c.subdomain,
        (SELECT COUNT(*) FROM employees WHERE company_id = c.id) as total_employees,
        (SELECT COUNT(*) FROM personas WHERE company_id = c.id) as total_personas,
        (SELECT COUNT(*) FROM objections WHERE company_id = c.id) as total_objections,
        (SELECT COUNT(*) FROM company_data WHERE company_id = c.id) as has_company_data,
        (SELECT COUNT(*) FROM company_type WHERE company_id = c.id) as has_company_type
    FROM companies c
    WHERE c.id = 'fa07f6f0-a455-4e16-8160-81d77325ecf1'
)
SELECT
    '====== RESUMO DA EMPRESA ======' as info,
    company_name,
    subdomain,
    'Funcionários: ' || total_employees as employees,
    'Personas: ' || total_personas as personas,
    'Objeções: ' || total_objections as objections,
    CASE WHEN has_company_data > 0 THEN '✅ Company Data' ELSE '❌ Company Data' END as data_status,
    CASE WHEN has_company_type > 0 THEN '✅ Company Type' ELSE '❌ Company Type' END as type_status
FROM company_stats;