-- Vincular o admin@dev.com à empresa Assiny
UPDATE employees
SET company_id = '6ff7c701-afce-4c34-b05c-db60355d6384'
WHERE email = 'admin@dev.com';

-- Verificar se funcionou
SELECT * FROM employees WHERE email = 'admin@dev.com';