-- Adicionar coluna para créditos extras mensais
-- Esta coluna armazena créditos adicionais comprados que são somados ao limite do plano

-- Adicionar coluna extra_monthly_credits se não existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'companies' AND column_name = 'extra_monthly_credits'
    ) THEN
        ALTER TABLE companies ADD COLUMN extra_monthly_credits INTEGER DEFAULT 0;
        COMMENT ON COLUMN companies.extra_monthly_credits IS 'Créditos extras comprados que são somados ao limite mensal do plano';
    END IF;
END $$;

-- Garantir que o valor padrão seja 0 para empresas existentes
UPDATE companies
SET extra_monthly_credits = 0
WHERE extra_monthly_credits IS NULL;
