-- Criar VIEW compatível com LangChain Postgres Chat Memory
-- Mantém as colunas originais (user_id, company_id) mas expõe apenas o que o LangChain precisa

CREATE OR REPLACE VIEW message_store AS
SELECT
  id::text as id,
  session_id,
  message,
  created_at
FROM roleplay_chat_memory
ORDER BY created_at ASC;

-- Comentário explicativo
COMMENT ON VIEW message_store IS
'View compatível com LangChain Postgres Chat Memory - expõe apenas id, session_id, message, created_at';
