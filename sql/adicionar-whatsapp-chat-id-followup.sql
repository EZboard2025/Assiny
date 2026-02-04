-- Adicionar coluna whatsapp_chat_id para vincular análises a chats do WhatsApp
-- Isso permite carregar análises do banco ao invés de depender do localStorage

ALTER TABLE followup_analyses
ADD COLUMN IF NOT EXISTS whatsapp_chat_id TEXT DEFAULT NULL;

-- Adicionar coluna contact_name para referência
ALTER TABLE followup_analyses
ADD COLUMN IF NOT EXISTS whatsapp_contact_name TEXT DEFAULT NULL;

-- Índice para busca rápida por chat_id
CREATE INDEX IF NOT EXISTS idx_followup_analyses_whatsapp_chat_id
ON followup_analyses(whatsapp_chat_id)
WHERE whatsapp_chat_id IS NOT NULL;

-- Comentários
COMMENT ON COLUMN followup_analyses.whatsapp_chat_id IS 'ID do chat WhatsApp (ex: 5521999999999@c.us) para vincular análise ao contato';
COMMENT ON COLUMN followup_analyses.whatsapp_contact_name IS 'Nome do contato no WhatsApp no momento da análise';
