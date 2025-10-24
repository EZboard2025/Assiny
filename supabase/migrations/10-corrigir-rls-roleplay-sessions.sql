-- Remover políticas antigas
DROP POLICY IF EXISTS "Usuários podem ver suas próprias sessões" ON roleplay_sessions;
DROP POLICY IF EXISTS "Usuários podem criar suas próprias sessões" ON roleplay_sessions;
DROP POLICY IF EXISTS "Usuários podem atualizar suas próprias sessões" ON roleplay_sessions;
DROP POLICY IF EXISTS "Usuários podem deletar suas próprias sessões" ON roleplay_sessions;

-- Criar política simplificada para SELECT (usuário vê apenas suas sessões)
CREATE POLICY "Usuários veem suas próprias sessões"
  ON roleplay_sessions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service role pode fazer tudo (para APIs)
CREATE POLICY "Service role pode gerenciar roleplay_sessions"
  ON roleplay_sessions
  FOR ALL
  USING (true);
