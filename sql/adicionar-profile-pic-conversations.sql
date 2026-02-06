-- Adicionar coluna profile_pic_url na tabela whatsapp_conversations
-- Executar no Supabase SQL Editor

ALTER TABLE whatsapp_conversations
ADD COLUMN IF NOT EXISTS profile_pic_url TEXT;

COMMENT ON COLUMN whatsapp_conversations.profile_pic_url IS 'URL da foto de perfil do contato do WhatsApp';
