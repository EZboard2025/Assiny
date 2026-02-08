-- Tabelas para o Copiloto de Vendas IA
-- Executar no Supabase Dashboard SQL Editor

-- 1. Tabela de feedback do copiloto (interações manuais)
CREATE TABLE IF NOT EXISTS copilot_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contact_phone TEXT NOT NULL,
  contact_name TEXT,
  user_question TEXT NOT NULL,
  ai_suggestion TEXT NOT NULL,
  conversation_context TEXT NOT NULL,
  was_helpful BOOLEAN,  -- null=sem feedback, true=útil, false=inútil
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_copilot_feedback_user ON copilot_feedback(user_id);
CREATE INDEX idx_copilot_feedback_company ON copilot_feedback(company_id);
CREATE INDEX idx_copilot_feedback_helpful ON copilot_feedback(was_helpful);

ALTER TABLE copilot_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own copilot feedback"
  ON copilot_feedback FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert copilot feedback"
  ON copilot_feedback FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own copilot feedback"
  ON copilot_feedback FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role full access to copilot feedback"
  ON copilot_feedback FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 2. Tabela de rastreamento automático de mensagens do vendedor
CREATE TABLE IF NOT EXISTS seller_message_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  company_id UUID NOT NULL,
  contact_phone TEXT NOT NULL,
  contact_name TEXT,
  seller_message TEXT NOT NULL,
  conversation_context TEXT NOT NULL,
  message_timestamp TIMESTAMPTZ NOT NULL,

  -- Resultado (preenchido depois pela análise automática)
  outcome TEXT,              -- 'success' | 'failure' | 'partial' | null (pendente)
  outcome_reason TEXT,       -- "Cliente aceitou proposta" / "Sem resposta após 24h"
  client_response TEXT,      -- A resposta do cliente (se houver)
  analyzed_at TIMESTAMPTZ,
  saved_as_example BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_smt_pending ON seller_message_tracking(outcome) WHERE outcome IS NULL;
CREATE INDEX idx_smt_company ON seller_message_tracking(company_id);
CREATE INDEX idx_smt_contact ON seller_message_tracking(contact_phone, message_timestamp DESC);
CREATE INDEX idx_smt_user ON seller_message_tracking(user_id);

ALTER TABLE seller_message_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to seller_message_tracking"
  ON seller_message_tracking FOR ALL TO service_role
  USING (true) WITH CHECK (true);
