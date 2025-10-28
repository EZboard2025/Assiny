-- ============================================
-- VERIFICAR USUÁRIOS E SUAS EMPRESAS
-- ============================================

-- 1. Listar todos os usuários e suas empresas
SELECT
  u.id as user_id,
  u.email,
  u.created_at as user_created,
  e.name as employee_name,
  e.role,
  e.company_id,
  c.name as company_name,
  c.subdomain
FROM auth.users u
LEFT JOIN public.employees e ON e.user_id = u.id
LEFT JOIN public.companies c ON c.id = e.company_id
ORDER BY c.name, u.email;

-- 2. Ver especificamente quem tem acesso a cada empresa
SELECT
  c.name as empresa,
  c.subdomain,
  COUNT(e.id) as total_funcionarios,
  STRING_AGG(e.email, ', ') as emails
FROM public.companies c
LEFT JOIN public.employees e ON e.company_id = c.id
GROUP BY c.id, c.name, c.subdomain
ORDER BY c.name;

-- 3. Verificar se existe admin para Mania Foods
SELECT
  c.name as empresa,
  c.subdomain,
  e.email,
  e.role,
  CASE
    WHEN u.id IS NOT NULL THEN '✅ Usuário Auth existe'
    ELSE '❌ Usuário Auth NÃO existe'
  END as status_auth
FROM public.companies c
LEFT JOIN public.employees e ON e.company_id = c.id
LEFT JOIN auth.users u ON u.id = e.user_id
WHERE c.subdomain = 'maniafoods';

-- 4. Dados completos de cada empresa
SELECT
  '========== ' || c.name || ' ==========' as header,
  c.id as company_id,
  c.subdomain,
  COUNT(DISTINCT e.id) as funcionarios,
  COUNT(DISTINCT p.id) as personas,
  COUNT(DISTINCT o.id) as objecoes,
  COUNT(DISTINCT ct.id) as company_types
FROM public.companies c
LEFT JOIN public.employees e ON e.company_id = c.id
LEFT JOIN public.personas p ON p.company_id = c.id
LEFT JOIN public.objections o ON o.company_id = c.id
LEFT JOIN public.company_type ct ON ct.company_id = c.id
GROUP BY c.id, c.name, c.subdomain
ORDER BY c.name;