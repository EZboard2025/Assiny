-- Adiciona coluna website_url na tabela companies
-- Para armazenar o site da empresa para análise de IA nos desafios

ALTER TABLE companies
ADD COLUMN IF NOT EXISTS website_url TEXT;

-- Comentário explicativo
COMMENT ON COLUMN companies.website_url IS 'URL do site da empresa para análise de IA ao gerar desafios personalizados';

-- Verificar resultado
SELECT id, name, subdomain, website_url, daily_challenges_enabled
FROM companies
ORDER BY name;
