-- Fix user_performance_summaries table
-- Remove user_email column (not needed) and ensure RLS policies work

-- 1. Remove user_email column
ALTER TABLE user_performance_summaries
DROP COLUMN IF EXISTS user_email;

-- 2. Recriar políticas RLS (garantir que funcionam)
DROP POLICY IF EXISTS "Users can view their own summary" ON user_performance_summaries;
DROP POLICY IF EXISTS "Service role has full access" ON user_performance_summaries;

-- Policy: Usuários podem ver apenas seu próprio resumo
CREATE POLICY "Users can view their own summary"
  ON user_performance_summaries
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Usuários podem atualizar apenas seu próprio resumo
CREATE POLICY "Users can update their own summary"
  ON user_performance_summaries
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Service role pode fazer tudo (para o agente AI e APIs)
CREATE POLICY "Service role has full access"
  ON user_performance_summaries
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Verificar se RLS está ativado
ALTER TABLE user_performance_summaries ENABLE ROW LEVEL SECURITY;
