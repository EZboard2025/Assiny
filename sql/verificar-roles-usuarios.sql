-- Verificar roles de todos os usuários
-- Execute este SQL no Supabase SQL Editor

-- 1. Ver todos os employees com seus roles
SELECT
    e.id,
    e.name,
    e.email,
    e.role,
    e.user_id,
    e.company_id,
    c.name as company_name
FROM employees e
LEFT JOIN companies c ON e.company_id = c.id
ORDER BY c.name, e.role, e.name;

-- 2. Contar usuários por role e empresa
SELECT
    c.name as company_name,
    e.role,
    COUNT(*) as total
FROM employees e
LEFT JOIN companies c ON e.company_id = c.id
GROUP BY c.name, e.role
ORDER BY c.name, e.role;

-- 3. Ver apenas admins e gestores
SELECT
    e.name,
    e.email,
    e.role,
    c.name as company_name
FROM employees e
LEFT JOIN companies c ON e.company_id = c.id
WHERE e.role IN ('Admin', 'Gestor')
ORDER BY c.name, e.role, e.name;

-- 4. Verificar se há algum problema com valores de role
SELECT DISTINCT role
FROM employees
ORDER BY role;

-- 5. Para atualizar um usuário específico para Admin ou Gestor:
-- UPDATE employees
-- SET role = 'Admin'
-- WHERE email = 'email@exemplo.com';

-- Valores possíveis de role:
-- 'Admin' - Administrador com acesso total
-- 'Gestor' - Gestor com acesso aos links de roleplay
-- 'Vendedor' - Vendedor sem acesso aos links de roleplay