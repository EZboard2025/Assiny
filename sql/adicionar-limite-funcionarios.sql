-- Adicionar coluna employee_limit na tabela companies
-- Esta coluna controla quantos funcionários cada empresa pode ter

ALTER TABLE companies
ADD COLUMN employee_limit INTEGER DEFAULT 10;

-- Comentário para documentação
COMMENT ON COLUMN companies.employee_limit IS 'Limite máximo de funcionários que a empresa pode ter. NULL = sem limite';

-- Atualizar empresas existentes com limite padrão (opcional)
UPDATE companies
SET employee_limit = 10
WHERE employee_limit IS NULL;