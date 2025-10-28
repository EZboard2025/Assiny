-- ============================================
-- VERIFICAR EMPRESAS E EMPLOYEES
-- ============================================

-- 1. Listar todas as empresas
SELECT
  id,
  name,
  subdomain,
  created_at
FROM public.companies
ORDER BY created_at;

-- 2. Listar todos os employees e suas empresas
SELECT
  e.id as employee_id,
  e.name as employee_name,
  e.email,
  e.role,
  e.user_id,
  e.company_id,
  c.name as company_name,
  c.subdomain
FROM public.employees e
LEFT JOIN public.companies c ON c.id = e.company_id
ORDER BY c.name, e.name;

-- 3. Contar employees por empresa
SELECT
  c.name as company_name,
  c.subdomain,
  COUNT(e.id) as total_employees
FROM public.companies c
LEFT JOIN public.employees e ON e.company_id = c.id
GROUP BY c.id, c.name, c.subdomain
ORDER BY c.name;

-- 4. Verificar se há employees sem company_id ou com company_id inválido
SELECT
  e.id,
  e.name,
  e.email,
  e.company_id,
  CASE
    WHEN e.company_id IS NULL THEN '❌ SEM EMPRESA'
    WHEN NOT EXISTS (SELECT 1 FROM companies WHERE id = e.company_id) THEN '❌ EMPRESA INVÁLIDA'
    ELSE '✅ OK'
  END as status
FROM public.employees e;