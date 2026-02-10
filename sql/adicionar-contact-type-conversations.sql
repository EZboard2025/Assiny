-- Adiciona coluna contact_type para classificação automática de contatos
-- Valores: 'client' | 'personal' | 'unknown'
-- A IA classifica automaticamente com base no conteúdo da conversa

ALTER TABLE whatsapp_conversations
ADD COLUMN IF NOT EXISTS contact_type TEXT DEFAULT 'unknown';

COMMENT ON COLUMN whatsapp_conversations.contact_type IS 'client | personal | unknown - classificado automaticamente por IA';
