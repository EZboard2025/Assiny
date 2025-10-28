-- Verificar e corrigir personas e objeções por empresa

-- 1. Verificar company_type de cada empresa
SELECT
    c.name as empresa,
    c.subdomain,
    ct.name as tipo_empresa,
    ct.company_id
FROM companies c
LEFT JOIN company_type ct ON ct.company_id = c.id
ORDER BY c.name;

-- 2. Verificar personas por empresa e tipo
SELECT
    c.name as empresa,
    p.business_type,
    COUNT(*) as total_personas
FROM personas p
JOIN companies c ON c.id = p.company_id
GROUP BY c.name, p.business_type
ORDER BY c.name, p.business_type;

-- 3. Verificar objeções por empresa
SELECT
    c.name as empresa,
    COUNT(o.*) as total_objecoes
FROM objections o
JOIN companies c ON c.id = o.company_id
GROUP BY c.name
ORDER BY c.name;

-- 4. Listar todas as personas da Mania Foods
SELECT
    p.id,
    p.business_type,
    p.job_title,
    p.profession,
    p.company_type,
    p.context
FROM personas p
JOIN companies c ON c.id = p.company_id
WHERE c.subdomain = 'maniafoods';

-- 5. Se necessário, atualizar o business_type das personas da Mania Foods para B2C
-- DESCOMENTE A LINHA ABAIXO APENAS SE QUISER CONVERTER TODAS AS PERSONAS DA MANIA FOODS PARA B2C
-- UPDATE personas SET business_type = 'B2C' WHERE company_id = (SELECT id FROM companies WHERE subdomain = 'maniafoods');