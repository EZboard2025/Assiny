-- Script para corrigir user_id NULL nas sessões de chat
-- Identifica o usuário de cada sessão e atualiza todas as mensagens

-- Primeiro, vamos criar uma função que preenche user_id para sessões existentes
CREATE OR REPLACE FUNCTION fix_chat_session_user_ids()
RETURNS TABLE (
  session_id_updated TEXT,
  messages_updated INTEGER,
  user_id_found UUID
) AS $$
DECLARE
  session_record RECORD;
  first_message RECORD;
  updated_count INTEGER;
BEGIN
  -- Para cada session_id que tem mensagens com user_id NULL
  FOR session_record IN
    SELECT DISTINCT cs.session_id
    FROM chat_sessions cs
    WHERE cs.user_id IS NULL
  LOOP
    -- Buscar a primeira mensagem dessa sessão que tem user_id
    SELECT user_id INTO first_message
    FROM chat_sessions
    WHERE chat_sessions.session_id = session_record.session_id
    AND user_id IS NOT NULL
    LIMIT 1;

    -- Se encontrou um user_id válido, atualizar todas as mensagens dessa sessão
    IF first_message.user_id IS NOT NULL THEN
      UPDATE chat_sessions
      SET user_id = first_message.user_id
      WHERE chat_sessions.session_id = session_record.session_id
      AND user_id IS NULL;

      GET DIAGNOSTICS updated_count = ROW_COUNT;

      session_id_updated := session_record.session_id;
      messages_updated := updated_count;
      user_id_found := first_message.user_id;

      RETURN NEXT;
    END IF;
  END LOOP;

  RETURN;
END;
$$ LANGUAGE plpgsql;

-- Executar a função para corrigir os dados existentes
SELECT * FROM fix_chat_session_user_ids();

-- Comentário
COMMENT ON FUNCTION fix_chat_session_user_ids() IS 'Corrige user_id NULL em sessões de chat baseado na primeira mensagem da sessão';
