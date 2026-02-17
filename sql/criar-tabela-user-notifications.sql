-- Tabela de notificações persistentes
-- Diferente do Toast (efêmero), estas persistem até o usuário visualizar
CREATE TABLE IF NOT EXISTS user_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  data JSONB,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_id ON user_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notifications_unread ON user_notifications(user_id, is_read) WHERE is_read = FALSE;

ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;

-- Service role precisa de acesso total (background process cria notificações)
CREATE POLICY "Service role full access user_notifications"
ON user_notifications FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Usuários podem ver suas notificações
CREATE POLICY "Users can view own notifications"
ON user_notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Usuários podem atualizar (marcar como lida)
CREATE POLICY "Users can update own notifications"
ON user_notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Usuários podem deletar suas notificações
CREATE POLICY "Users can delete own notifications"
ON user_notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);
