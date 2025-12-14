-- Verificar se a empresa tem plano de seleção
SELECT id, name, training_plan, selection_plan
FROM companies
LIMIT 5;

-- Adicionar plano de seleção PS_STARTER (5 candidatos) para teste
-- Substitua o ID pela sua empresa
UPDATE companies
SET selection_plan = 'ps_starter'
WHERE id = (SELECT id FROM companies LIMIT 1);

-- Verificar novamente
SELECT id, name, training_plan, selection_plan
FROM companies
WHERE selection_plan IS NOT NULL;