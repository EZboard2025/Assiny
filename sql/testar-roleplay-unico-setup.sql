-- ====================================
-- SCRIPT DE TESTE - ROLEPLAY ÚNICO
-- Verifica se todas as estruturas foram criadas corretamente
-- ====================================

-- 1. VERIFICAR SE AS TABELAS EXISTEM
SELECT
  'roleplay_links' as tabela,
  EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'roleplay_links'
  ) as existe
UNION ALL
SELECT
  'roleplays_unicos' as tabela,
  EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'roleplays_unicos'
  ) as existe;

-- 2. VERIFICAR ESTRUTURA DA TABELA roleplay_links
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'roleplay_links'
ORDER BY ordinal_position;

-- 3. VERIFICAR ESTRUTURA DA TABELA roleplays_unicos
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'roleplays_unicos'
ORDER BY ordinal_position;

-- 4. VERIFICAR ÍNDICES
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('roleplay_links', 'roleplays_unicos')
ORDER BY tablename, indexname;

-- 5. VERIFICAR TRIGGERS
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND event_object_table IN ('roleplay_links', 'roleplays_unicos');

-- 6. VERIFICAR SE RLS ESTÁ HABILITADO
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('roleplay_links', 'roleplays_unicos');

-- 7. VERIFICAR POLICIES (RLS)
SELECT
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('roleplay_links', 'roleplays_unicos')
ORDER BY tablename, policyname;

-- 8. VERIFICAR FUNÇÕES CRIADAS
SELECT
  routine_name,
  routine_type,
  data_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'update_updated_at_column',
    'increment_link_usage_count',
    'generate_link_code',
    'create_roleplay_link'
  );

-- 9. VERIFICAR VIEW DE ESTATÍSTICAS
SELECT
  table_name,
  view_definition
FROM information_schema.views
WHERE table_schema = 'public'
  AND table_name = 'roleplay_link_stats';

-- 10. TESTE DE CRIAÇÃO DE LINK (SIMULAÇÃO)
-- Primeiro, vamos verificar se existe alguma empresa para teste
SELECT
  id,
  name,
  subdomain
FROM companies
LIMIT 5;

-- 11. VERIFICAR ROLES DO POSTGRES
-- Verifica quais roles existem no sistema
SELECT
  rolname,
  rolsuper,
  rolinherit,
  rolcreaterole,
  rolcreatedb,
  rolcanlogin
FROM pg_roles
WHERE rolname IN ('anon', 'authenticated', 'service_role', 'postgres')
ORDER BY rolname;

-- 12. TESTE DE PERMISSÕES - SIMULAÇÃO DE ACESSO
-- Mostra o que cada role pode fazer com as tabelas

-- Para roleplay_links
SELECT
  'roleplay_links' as tabela,
  grantee as role,
  privilege_type as permissao
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND table_name = 'roleplay_links'
  AND grantee IN ('anon', 'authenticated', 'service_role')
ORDER BY grantee, privilege_type;

-- Para roleplays_unicos
SELECT
  'roleplays_unicos' as tabela,
  grantee as role,
  privilege_type as permissao
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND table_name = 'roleplays_unicos'
  AND grantee IN ('anon', 'authenticated', 'service_role')
ORDER BY grantee, privilege_type;

-- ====================================
-- RESULTADOS ESPERADOS:
--
-- 1. Ambas as tabelas devem existir (true)
-- 2. Todas as colunas listadas conforme o CREATE TABLE
-- 3. Todos os índices criados
-- 4. Triggers de updated_at e usage_count ativos
-- 5. RLS habilitado (rowsecurity = true)
-- 6. Policies criadas para authenticated e service_role
-- 7. Todas as funções existem
-- 8. View roleplay_link_stats existe
-- 9. Deve mostrar pelo menos uma empresa (para teste)
-- 10. Roles anon, authenticated e service_role devem existir
-- 11. Permissões apropriadas para cada role
-- ====================================

-- TESTE FINAL: Verificar se tudo está OK
SELECT
  CASE
    WHEN (
      -- Tabelas existem
      EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'roleplay_links')
      AND EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'roleplays_unicos')
      -- RLS habilitado
      AND EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'roleplay_links' AND rowsecurity = true)
      AND EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'roleplays_unicos' AND rowsecurity = true)
      -- Policies existem
      AND EXISTS (SELECT FROM pg_policies WHERE schemaname = 'public' AND tablename = 'roleplay_links')
      AND EXISTS (SELECT FROM pg_policies WHERE schemaname = 'public' AND tablename = 'roleplays_unicos')
      -- Funções existem
      AND EXISTS (SELECT FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name = 'generate_link_code')
      AND EXISTS (SELECT FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name = 'create_roleplay_link')
      -- View existe
      AND EXISTS (SELECT FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'roleplay_link_stats')
    )
    THEN '✅ TUDO OK! Estrutura do Roleplay Único está completa e pronta para uso.'
    ELSE '❌ ERRO! Algo está faltando. Verifique os resultados acima.'
  END AS status_final;