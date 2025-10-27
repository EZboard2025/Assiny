-- Criar segunda empresa para testar multi-tenant
INSERT INTO companies (name, subdomain)
VALUES ('Empresa Teste', 'teste')
ON CONFLICT (subdomain) DO NOTHING
RETURNING *;

-- Criar um funcionário admin para a empresa teste
-- Primeiro, criar o usuário no auth (isso precisa ser feito via API)
-- Depois, vincular na tabela employees

-- Para criar o usuário, use o ConfigHub ou a API:
-- POST /api/employees/create
-- {
--   "name": "Admin Teste",
--   "email": "admin@teste.com",
--   "password": "teste123"
-- }

-- Nota: O company_id será automaticamente vinculado ao usuário logado que criou
