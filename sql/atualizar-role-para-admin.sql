-- Script para atualizar roles de usuários

-- 1. Primeiro, veja todos os usuários e seus roles atuais
SELECT
    e.id,
    e.name,
    e.email,
    e.role,
    e.user_id,
    c.name as company_name
FROM employees e
LEFT JOIN companies c ON e.company_id = c.id
ORDER BY e.created_at DESC;

-- 2. Para tornar um usuário Admin (substitua o email pelo correto):
UPDATE employees
SET role = 'Admin'
WHERE email = 'seu-email@exemplo.com';

-- 3. Para tornar um usuário Gestor (substitua o email pelo correto):
-- UPDATE employees
-- SET role = 'Gestor'
-- WHERE email = 'outro-email@exemplo.com';

-- 4. Para verificar se a atualização funcionou:
SELECT name, email, role
FROM employees
WHERE email = 'seu-email@exemplo.com';

-- IMPORTANTE: Os valores de role devem ser EXATAMENTE:
-- 'Admin' (com A maiúsculo)
-- 'Gestor' (com G maiúsculo)
-- 'Vendedor' (com V maiúsculo)

-- Se o role estiver em minúsculas ou diferente, corrija:
-- UPDATE employees
-- SET role = CASE
--     WHEN LOWER(role) = 'admin' THEN 'Admin'
--     WHEN LOWER(role) = 'gestor' THEN 'Gestor'
--     WHEN LOWER(role) = 'vendedor' THEN 'Vendedor'
--     ELSE role
-- END
-- WHERE LOWER(role) IN ('admin', 'gestor', 'vendedor');