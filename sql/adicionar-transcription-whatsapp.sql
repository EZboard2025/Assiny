-- Adicionar coluna de transcrição na tabela whatsapp_messages
-- Para armazenar transcrições automáticas de áudios via OpenAI Whisper

ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS transcription TEXT;

-- Index para buscar mensagens de áudio sem transcrição (para reprocessamento)
CREATE INDEX IF NOT EXISTS idx_wm_audio_no_transcription
  ON whatsapp_messages(message_type)
  WHERE message_type = 'audio' AND transcription IS NULL;
