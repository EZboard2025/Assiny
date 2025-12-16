-- Adicionar coluna dores_resolvidas na tabela company_data
ALTER TABLE company_data
ADD COLUMN IF NOT EXISTS dores_resolvidas TEXT;

-- Adicionar comentário na coluna
COMMENT ON COLUMN company_data.dores_resolvidas IS 'Quais dores a empresa resolve para seus clientes';