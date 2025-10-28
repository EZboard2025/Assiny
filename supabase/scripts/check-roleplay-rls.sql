-- Verificar RLS na tabela roleplay_sessions

-- 1. Verificar se RLS está habilitado
SELECT
    schemaname,
    tablename,
    rowsecurity,
    CASE
        WHEN rowsecurity THEN 'RLS HABILITADO ✅'
        ELSE 'RLS DESABILITADO ❌'
    END as status
FROM pg_tables
WHERE tablename = 'roleplay_sessions';

-- 2. Verificar políticas RLS existentes
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'roleplay_sessions';

-- 3. Se RLS não estiver habilitado, habilitar e criar políticas
-- DESCOMENTE AS LINHAS ABAIXO PARA EXECUTAR

/*
-- Habilitar RLS
ALTER TABLE roleplay_sessions ENABLE ROW LEVEL SECURITY;

-- Criar política para usuários verem apenas suas próprias sessões
CREATE POLICY "Users can only see their own roleplay sessions"
ON roleplay_sessions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Criar política para usuários criarem suas próprias sessões
CREATE POLICY "Users can create their own roleplay sessions"
ON roleplay_sessions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Criar política para usuários atualizarem suas próprias sessões
CREATE POLICY "Users can update their own roleplay sessions"
ON roleplay_sessions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Criar política para usuários deletarem suas próprias sessões
CREATE POLICY "Users can delete their own roleplay sessions"
ON roleplay_sessions
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
*/

-- 4. Verificar quantas sessões existem por usuário
SELECT
    u.email,
    rs.user_id,
    COUNT(*) as total_sessions
FROM roleplay_sessions rs
LEFT JOIN auth.users u ON u.id = rs.user_id
GROUP BY rs.user_id, u.email
ORDER BY total_sessions DESC;