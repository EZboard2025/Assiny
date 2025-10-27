-- Verificar o estado atual do admin@dev.com
SELECT id, user_id, email, company_id FROM employees WHERE email = 'admin@dev.com';

-- Buscar o user_id do admin@dev.com no auth.users
SELECT id, email FROM auth.users WHERE email = 'admin@dev.com';

-- Atualizar o user_id do employee com o ID correto do auth.users
UPDATE employees
SET user_id = (SELECT id FROM auth.users WHERE email = 'admin@dev.com')
WHERE email = 'admin@dev.com';

-- Verificar se funcionou
SELECT id, user_id, email, company_id FROM employees WHERE email = 'admin@dev.com';