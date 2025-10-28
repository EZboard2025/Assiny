-- Script para adicionar company_id nas personas e objeções que foram criadas sem

-- 1. Verificar personas sem company_id
SELECT
    p.id,
    p.business_type,
    COALESCE(p.job_title, p.profession) as titulo,
    p.company_id,
    'SEM COMPANY_ID - SERÁ ATRIBUÍDO BASEADO NO BUSINESS_TYPE' as status
FROM personas p
WHERE p.company_id IS NULL;

-- 2. Verificar objeções sem company_id
SELECT
    o.id,
    o.name,
    o.company_id,
    'SEM COMPANY_ID' as status
FROM objections o
WHERE o.company_id IS NULL;

-- 3. Buscar os IDs das empresas
DO $$
DECLARE
    assiny_id UUID;
    maniafoods_id UUID;
BEGIN
    -- Buscar ID da Assiny
    SELECT id INTO assiny_id
    FROM public.companies
    WHERE subdomain = 'assiny'
    LIMIT 1;

    -- Buscar ID da Mania Foods
    SELECT id INTO maniafoods_id
    FROM public.companies
    WHERE subdomain = 'maniafoods'
    LIMIT 1;

    RAISE NOTICE 'Assiny ID: %', assiny_id;
    RAISE NOTICE 'Mania Foods ID: %', maniafoods_id;

    -- 4. Atualizar personas B2B sem company_id para Assiny
    UPDATE personas
    SET company_id = assiny_id
    WHERE company_id IS NULL
    AND business_type = 'B2B';

    RAISE NOTICE 'Personas B2B atualizadas para Assiny';

    -- 5. Atualizar personas B2C sem company_id para Mania Foods
    UPDATE personas
    SET company_id = maniafoods_id
    WHERE company_id IS NULL
    AND business_type = 'B2C';

    RAISE NOTICE 'Personas B2C atualizadas para Mania Foods';

    -- 6. Atualizar TODAS as objeções sem company_id
    -- Por padrão, vamos atribuir à empresa baseada no contexto
    -- Se você tem objeções específicas para cada empresa, ajuste manualmente

    -- Atribuir objeções genéricas à Assiny (você pode mudar isso)
    UPDATE objections
    SET company_id = assiny_id
    WHERE company_id IS NULL
    AND name IN (
        'É muito caro',
        'Preciso pensar',
        'Já tenho um fornecedor',
        'Não é o momento',
        'Não vejo valor nisso'
    );

    -- Atribuir objeções de B2C à Mania Foods
    UPDATE objections
    SET company_id = maniafoods_id
    WHERE company_id IS NULL
    AND name IN (
        'Não confio em comprar online',
        'O frete é muito caro',
        'Demora muito para entregar'
    );

    -- Se ainda houver objeções sem company_id, atribuir à Assiny por padrão
    UPDATE objections
    SET company_id = assiny_id
    WHERE company_id IS NULL;

    RAISE NOTICE 'Objeções atualizadas com company_id';

END $$;

-- 7. Verificar o resultado final
SELECT
    'Personas' as tabela,
    c.name as empresa,
    c.subdomain,
    p.business_type,
    COUNT(*) as total
FROM personas p
JOIN companies c ON c.id = p.company_id
GROUP BY c.name, c.subdomain, p.business_type
UNION ALL
SELECT
    'Objections' as tabela,
    c.name as empresa,
    c.subdomain,
    NULL as business_type,
    COUNT(*) as total
FROM objections o
JOIN companies c ON c.id = o.company_id
GROUP BY c.name, c.subdomain
ORDER BY tabela, empresa;