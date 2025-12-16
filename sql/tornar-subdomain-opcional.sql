-- Tornar o campo subdomain opcional (permitir NULL) já que não usamos mais subdomínios
ALTER TABLE companies
ALTER COLUMN subdomain DROP NOT NULL;

-- Adicionar um valor padrão vazio para subdomains existentes que sejam NULL
UPDATE companies
SET subdomain = ''
WHERE subdomain IS NULL;