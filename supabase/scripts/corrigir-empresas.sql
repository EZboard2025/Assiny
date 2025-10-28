-- ============================================
-- CORRIGIR ESTRUTURA DE EMPRESAS
-- ============================================

-- 1. Verificar empresas existentes
SELECT id, name, subdomain FROM public.companies;

-- ============================================
-- 2. GARANTIR QUE AS DUAS EMPRESAS EXISTEM
-- ============================================

-- Inserir Assiny (se não existir)
INSERT INTO public.companies (name, subdomain)
VALUES ('Assiny', 'assiny')
ON CONFLICT (subdomain) DO UPDATE
  SET name = EXCLUDED.name;

-- Inserir Mania Foods (se não existir)
INSERT INTO public.companies (name, subdomain)
VALUES ('Mania Foods', 'maniafoods')
ON CONFLICT (subdomain) DO UPDATE
  SET name = EXCLUDED.name;

-- ============================================
-- 3. MOSTRAR IDs DAS EMPRESAS
-- ============================================

-- Pegar ID da Assiny
DO $$
DECLARE
  assiny_id UUID;
  maniafoods_id UUID;
BEGIN
  SELECT id INTO assiny_id FROM public.companies WHERE subdomain = 'assiny';
  SELECT id INTO maniafoods_id FROM public.companies WHERE subdomain = 'maniafoods';

  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ EMPRESAS CRIADAS/VERIFICADAS';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Assiny ID: %', assiny_id;
  RAISE NOTICE 'Mania Foods ID: %', maniafoods_id;
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '📝 Agora você precisa:';
  RAISE NOTICE '1. Criar usuário admin@assiny.com no Supabase Dashboard';
  RAISE NOTICE '2. Criar usuário admin@maniafoods.com no Supabase Dashboard';
  RAISE NOTICE '3. Vincular cada admin à sua empresa usando os IDs acima';
  RAISE NOTICE '';
END $$;

-- ============================================
-- 4. VERIFICAR RESULTADO
-- ============================================

SELECT
  c.id,
  c.name,
  c.subdomain,
  COUNT(e.id) as total_employees
FROM public.companies c
LEFT JOIN public.employees e ON e.company_id = c.id
GROUP BY c.id, c.name, c.subdomain
ORDER BY c.name;