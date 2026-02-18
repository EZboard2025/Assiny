-- Adiciona coluna 'source' para distinguir personas/objeções criadas manualmente
-- daquelas geradas automaticamente por desafios diários ou correções de Meet.
-- Entries com source='challenge' NÃO aparecem no ConfigHub nem na personalização de simulações.

-- Personas
ALTER TABLE personas ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'manual';

-- Objections
ALTER TABLE objections ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'manual';
