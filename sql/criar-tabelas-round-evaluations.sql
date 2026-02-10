-- Coluna para saber quando a conversa foi avaliada pela última vez
ALTER TABLE whatsapp_conversations
ADD COLUMN IF NOT EXISTS last_evaluated_at TIMESTAMPTZ;

-- Tabela de avaliações por round de conversa
CREATE TABLE IF NOT EXISTS conversation_round_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contact_phone TEXT NOT NULL,
  contact_name TEXT,
  round_number INTEGER NOT NULL DEFAULT 1,

  -- Mensagens do round
  round_messages TEXT NOT NULL,
  round_start TIMESTAMPTZ NOT NULL,
  round_end TIMESTAMPTZ NOT NULL,
  message_count INTEGER NOT NULL,

  -- Avaliação N8N
  avaliacao JSONB NOT NULL,
  nota_final DECIMAL(3,1) NOT NULL,
  classificacao VARCHAR(20) NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_round_eval_company ON conversation_round_evaluations(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_round_eval_user ON conversation_round_evaluations(user_id, contact_phone);
