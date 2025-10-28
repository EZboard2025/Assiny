-- ============================================
-- CORRIGIR COMPANY_TYPE COM NULL
-- ============================================
-- Problema: company_type tem company_id NULL
-- Solução: Deletar o registro velho e criar um para cada empresa
-- ============================================

-- 1. Ver o problema atual
SELECT * FROM company_type;

-- 2. Deletar o registro com company_id NULL
DELETE FROM company_type WHERE company_id IS NULL;

-- 3. Criar company_type correto para cada empresa
DO $$
DECLARE
  assiny_id UUID;
  maniafoods_id UUID;
BEGIN
  -- Pegar IDs das empresas
  SELECT id INTO assiny_id FROM public.companies WHERE subdomain = 'assiny';
  SELECT id INTO maniafoods_id FROM public.companies WHERE subdomain = 'maniafoods';

  -- Verificar se foram encontradas
  IF assiny_id IS NULL OR maniafoods_id IS NULL THEN
    RAISE EXCEPTION 'Empresas não encontradas! Assiny: %, Mania Foods: %', assiny_id, maniafoods_id;
  END IF;

  -- Criar company_type para Assiny
  INSERT INTO public.company_type (name, company_id)
  VALUES ('B2B', assiny_id)
  ON CONFLICT (name, company_id) DO NOTHING;

  RAISE NOTICE '✅ Company type B2B criado para Assiny';

  -- Criar company_type para Mania Foods (pode ser B2C já que é food)
  INSERT INTO public.company_type (name, company_id)
  VALUES ('B2C', maniafoods_id)
  ON CONFLICT (name, company_id) DO NOTHING;

  RAISE NOTICE '✅ Company type B2C criado para Mania Foods';

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ COMPANY_TYPE CORRIGIDO!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Assiny: B2B (company_id: %)', assiny_id;
  RAISE NOTICE 'Mania Foods: B2C (company_id: %)', maniafoods_id;
  RAISE NOTICE '========================================';

END $$;

-- 4. Atualizar outras tabelas que dependem de company_type
-- Se houver personas, objections, etc sem company_id, precisamos vincular

-- Atualizar personas sem company_id
UPDATE personas
SET company_id = (SELECT id FROM companies WHERE subdomain = 'assiny')
WHERE company_id IS NULL;

-- Atualizar objections sem company_id
UPDATE objections
SET company_id = (SELECT id FROM companies WHERE subdomain = 'assiny')
WHERE company_id IS NULL;

-- Atualizar company_data sem company_id
UPDATE company_data
SET company_id = (SELECT id FROM companies WHERE subdomain = 'assiny')
WHERE company_id IS NULL;

-- 5. Verificar resultado final
SELECT
  ct.id,
  ct.name as tipo,
  ct.company_id,
  c.name as empresa,
  c.subdomain
FROM company_type ct
JOIN companies c ON c.id = ct.company_id
ORDER BY c.name;