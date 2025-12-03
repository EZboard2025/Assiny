-- Corrigir ordem das mensagens no roleplay_chat_memory
-- Problema: Mensagens aparecem fora de ordem cronológica

-- 1. Criar índice composto para garantir ordem por sessão + tempo
DROP INDEX IF EXISTS idx_roleplay_chat_memory_session_id;
CREATE INDEX idx_roleplay_chat_session_order
ON roleplay_chat_memory(session_id, created_at ASC, id ASC);

-- 2. Comentário explicativo
COMMENT ON INDEX idx_roleplay_chat_session_order IS
'Garante que mensagens são recuperadas na ordem cronológica correta (created_at + id como desempate)';
