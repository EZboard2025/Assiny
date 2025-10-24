-- Corrigir constraint UNIQUE em company_type para permitir multi-tenant

-- Remover constraint UNIQUE antiga (name sozinho)
ALTER TABLE company_type DROP CONSTRAINT IF EXISTS company_type_name_key;

-- Adicionar constraint UNIQUE composta (name + company_id)
-- Isso permite que cada empresa tenha seu próprio B2B ou B2C
ALTER TABLE company_type ADD CONSTRAINT company_type_name_company_id_key UNIQUE (name, company_id);