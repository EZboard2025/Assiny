-- Script para garantir que todas as foreign keys têm ON DELETE CASCADE
-- Isso garante que ao deletar uma empresa, todos os dados relacionados são deletados automaticamente

-- IMPORTANTE: Execute este script ANTES de usar o botão deletar empresas!

-- 1. Verificar foreign keys atuais
SELECT
    tc.table_name,
    tc.constraint_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints AS rc
    ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND ccu.table_name = 'companies'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name;

-- 2. Se necessário, recriar as foreign keys com CASCADE
-- Descomente e execute apenas se a verificação acima mostrar delete_rule != 'CASCADE'

/*
-- employees
ALTER TABLE employees
DROP CONSTRAINT IF EXISTS employees_company_id_fkey;

ALTER TABLE employees
ADD CONSTRAINT employees_company_id_fkey
FOREIGN KEY (company_id)
REFERENCES companies(id)
ON DELETE CASCADE;

-- personas
ALTER TABLE personas
DROP CONSTRAINT IF EXISTS personas_company_id_fkey;

ALTER TABLE personas
ADD CONSTRAINT personas_company_id_fkey
FOREIGN KEY (company_id)
REFERENCES companies(id)
ON DELETE CASCADE;

-- objections
ALTER TABLE objections
DROP CONSTRAINT IF EXISTS objections_company_id_fkey;

ALTER TABLE objections
ADD CONSTRAINT objections_company_id_fkey
FOREIGN KEY (company_id)
REFERENCES companies(id)
ON DELETE CASCADE;

-- company_data
ALTER TABLE company_data
DROP CONSTRAINT IF EXISTS company_data_company_id_fkey;

ALTER TABLE company_data
ADD CONSTRAINT company_data_company_id_fkey
FOREIGN KEY (company_id)
REFERENCES companies(id)
ON DELETE CASCADE;

-- company_type
ALTER TABLE company_type
DROP CONSTRAINT IF EXISTS company_type_company_id_fkey;

ALTER TABLE company_type
ADD CONSTRAINT company_type_company_id_fkey
FOREIGN KEY (company_id)
REFERENCES companies(id)
ON DELETE CASCADE;

-- documents
ALTER TABLE documents
DROP CONSTRAINT IF EXISTS documents_company_id_fkey;

ALTER TABLE documents
ADD CONSTRAINT documents_company_id_fkey
FOREIGN KEY (company_id)
REFERENCES companies(id)
ON DELETE CASCADE;

-- roleplay_sessions
ALTER TABLE roleplay_sessions
DROP CONSTRAINT IF EXISTS roleplay_sessions_company_id_fkey;

ALTER TABLE roleplay_sessions
ADD CONSTRAINT roleplay_sessions_company_id_fkey
FOREIGN KEY (company_id)
REFERENCES companies(id)
ON DELETE CASCADE;

-- chat_sessions
ALTER TABLE chat_sessions
DROP CONSTRAINT IF EXISTS chat_sessions_company_id_fkey;

ALTER TABLE chat_sessions
ADD CONSTRAINT chat_sessions_company_id_fkey
FOREIGN KEY (company_id)
REFERENCES companies(id)
ON DELETE CASCADE;

-- pdis
ALTER TABLE pdis
DROP CONSTRAINT IF EXISTS pdis_company_id_fkey;

ALTER TABLE pdis
ADD CONSTRAINT pdis_company_id_fkey
FOREIGN KEY (company_id)
REFERENCES companies(id)
ON DELETE CASCADE;

-- user_performance_summaries
ALTER TABLE user_performance_summaries
DROP CONSTRAINT IF EXISTS user_performance_summaries_company_id_fkey;

ALTER TABLE user_performance_summaries
ADD CONSTRAINT user_performance_summaries_company_id_fkey
FOREIGN KEY (company_id)
REFERENCES companies(id)
ON DELETE CASCADE;

-- knowledge_base
ALTER TABLE knowledge_base
DROP CONSTRAINT IF EXISTS knowledge_base_company_id_fkey;

ALTER TABLE knowledge_base
ADD CONSTRAINT knowledge_base_company_id_fkey
FOREIGN KEY (company_id)
REFERENCES companies(id)
ON DELETE CASCADE;
*/

-- 3. Verificar novamente após as alterações
SELECT
    '✅ VERIFICAÇÃO FINAL' as info,
    tc.table_name,
    rc.delete_rule,
    CASE
        WHEN rc.delete_rule = 'CASCADE' THEN '✅ OK'
        ELSE '❌ PRECISA CORRIGIR'
    END as status
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints AS rc
    ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND ccu.table_name = 'companies'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name;