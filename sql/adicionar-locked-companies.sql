-- Adicionar coluna 'locked' à tabela companies
-- Esta coluna permite travar o acesso ao webapp de empresas específicas (útil após período de teste)

ALTER TABLE companies
ADD COLUMN IF NOT EXISTS locked BOOLEAN DEFAULT FALSE;

-- Comentário para documentação
COMMENT ON COLUMN companies.locked IS 'Indica se a empresa está bloqueada (sem acesso ao webapp)';
