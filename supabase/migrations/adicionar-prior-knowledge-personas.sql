-- Adicionar campo prior_knowledge à tabela personas
-- Este campo armazena o que a persona já sabe sobre a empresa e seus serviços

ALTER TABLE personas
ADD COLUMN IF NOT EXISTS prior_knowledge TEXT;

-- Comentário para documentação
COMMENT ON COLUMN personas.prior_knowledge IS 'O que a persona já sabe sobre a empresa e seus serviços';
