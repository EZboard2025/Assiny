-- Verificar estrutura atual da tabela
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'roleplay_sessions'
ORDER BY ordinal_position;