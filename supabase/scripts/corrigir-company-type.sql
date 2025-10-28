-- ============================================
-- CORRIGIR COMPANY_TYPE - Multi-Tenant
-- ============================================
-- Problema: Apenas 1 registro na tabela company_type
-- Solução: Criar um registro para cada empresa
-- ============================================

-- 1. Ver estado atual
SELECT
  ct.*,
  c.name as company_name,
  c.subdomain
FROM company_type ct
LEFT JOIN companies c ON c.id = ct.company_id;

-- 2. Deletar registros antigos (se houver conflito)
-- DELETE FROM company_type;

-- 3. Criar company_type para CADA empresa
DO $$
DECLARE
  assiny_id UUID;
  maniafoods_id UUID;
BEGIN
  -- Pegar IDs das empresas
  SELECT id INTO assiny_id FROM public.companies WHERE subdomain = 'assiny';
  SELECT id INTO maniafoods_id FROM public.companies WHERE subdomain = 'maniafoods';

  -- Verificar se foram encontradas
  IF assiny_id IS NULL THEN
    RAISE EXCEPTION 'Empresa Assiny não encontrada!';
  END IF;

  IF maniafoods_id IS NULL THEN
    RAISE EXCEPTION 'Empresa Mania Foods não encontrada!';
  END IF;

  -- Criar/Atualizar company_type para Assiny
  INSERT INTO public.company_type (name, company_id)
  VALUES ('B2B', assiny_id)
  ON CONFLICT (name, company_id) DO NOTHING;

  RAISE NOTICE '✅ Company type criado para Assiny (B2B)';

  -- Criar/Atualizar company_type para Mania Foods
  INSERT INTO public.company_type (name, company_id)
  VALUES ('B2C', maniafoods_id)  -- Ou 'B2B' se preferir
  ON CONFLICT (name, company_id) DO NOTHING;

  RAISE NOTICE '✅ Company type criado para Mania Foods (B2C)';

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ COMPANY_TYPE CORRIGIDO';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Assiny: B2B';
  RAISE NOTICE 'Mania Foods: B2C';
  RAISE NOTICE '';
  RAISE NOTICE '📝 Agora cada empresa tem seu próprio company_type';
  RAISE NOTICE '========================================';

END $$;

-- 4. Verificar resultado final
SELECT
  c.name as empresa,
  c.subdomain,
  ct.name as tipo_negocio,
  ct.id as company_type_id
FROM public.companies c
LEFT JOIN public.company_type ct ON ct.company_id = c.id
ORDER BY c.name;

-- 5. Verificar se há alguma tabela sem company_id definido
SELECT
  'personas' as tabela,
  COUNT(*) as total,
  COUNT(company_id) as com_company_id,
  COUNT(*) - COUNT(company_id) as sem_company_id
FROM personas
UNION ALL
SELECT
  'objections',
  COUNT(*),
  COUNT(company_id),
  COUNT(*) - COUNT(company_id)
FROM objections
UNION ALL
SELECT
  'company_data',
  COUNT(*),
  COUNT(company_id),
  COUNT(*) - COUNT(company_id)
FROM company_data;