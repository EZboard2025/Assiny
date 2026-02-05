-- Tabelas para integracao WhatsApp Cloud API (Meta oficial)
-- Executar no Supabase SQL Editor

-- ============================================
-- 1. whatsapp_connections
-- Armazena conexoes dos vendedores com seus numeros WhatsApp Business
-- ============================================
CREATE TABLE IF NOT EXISTS whatsapp_connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  waba_id TEXT NOT NULL,
  phone_number_id TEXT NOT NULL UNIQUE,
  display_phone_number TEXT,
  access_token TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disconnected', 'pending')),
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  last_webhook_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE whatsapp_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_connections" ON whatsapp_connections
  FOR ALL TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "service_role_all_connections" ON whatsapp_connections
  FOR ALL TO service_role USING (true);

CREATE INDEX IF NOT EXISTS idx_wc_phone_number_id ON whatsapp_connections(phone_number_id);
CREATE INDEX IF NOT EXISTS idx_wc_user_id ON whatsapp_connections(user_id);

-- ============================================
-- 2. whatsapp_messages
-- Armazena todas as mensagens recebidas/enviadas via webhook
-- ============================================
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  connection_id UUID NOT NULL REFERENCES whatsapp_connections(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  wa_message_id TEXT UNIQUE,
  contact_phone TEXT NOT NULL,
  contact_name TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  message_type TEXT NOT NULL DEFAULT 'text',
  content TEXT,
  media_id TEXT,
  media_mime_type TEXT,
  timestamp TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read', 'failed')),
  raw_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_messages" ON whatsapp_messages
  FOR ALL TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "service_role_all_messages" ON whatsapp_messages
  FOR ALL TO service_role USING (true);

CREATE INDEX IF NOT EXISTS idx_wm_contact ON whatsapp_messages(connection_id, contact_phone);
CREATE INDEX IF NOT EXISTS idx_wm_timestamp ON whatsapp_messages(connection_id, contact_phone, timestamp);
CREATE INDEX IF NOT EXISTS idx_wm_wa_id ON whatsapp_messages(wa_message_id);
CREATE INDEX IF NOT EXISTS idx_wm_user_id ON whatsapp_messages(user_id);

-- ============================================
-- 3. whatsapp_conversations
-- Agrupa mensagens por contato para listagem rapida na sidebar
-- ============================================
CREATE TABLE IF NOT EXISTS whatsapp_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  connection_id UUID NOT NULL REFERENCES whatsapp_connections(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  contact_phone TEXT NOT NULL,
  contact_name TEXT,
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  unread_count INTEGER DEFAULT 0,
  message_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(connection_id, contact_phone)
);

ALTER TABLE whatsapp_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_conversations" ON whatsapp_conversations
  FOR ALL TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "service_role_all_conversations" ON whatsapp_conversations
  FOR ALL TO service_role USING (true);

CREATE INDEX IF NOT EXISTS idx_wconv_user ON whatsapp_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_wconv_last_msg ON whatsapp_conversations(user_id, last_message_at DESC);
