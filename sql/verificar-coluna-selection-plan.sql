-- 1. Verificar estrutura da tabela companies
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'companies'
ORDER BY ordinal_position;

-- 2. Se a coluna selection_plan NÃO existir, execute este comando:
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS selection_plan TEXT;

-- 3. Verificar novamente após adicionar
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'companies'
AND column_name IN ('training_plan', 'selection_plan');

-- 4. Atualizar uma empresa com plano de seleção para teste
UPDATE companies
SET selection_plan = 'ps_starter'
WHERE id = '668d8d47-dc76-4a70-9084-2dd68114e79e';

-- 5. Verificar se foi salvo
SELECT id, name, training_plan, selection_plan
FROM companies
WHERE id = '668d8d47-dc76-4a70-9084-2dd68114e79e';