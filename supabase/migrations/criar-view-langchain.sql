-- VIEW compatível com LangChain (sem colunas extras que causam erro)
-- O LangChain espera APENAS: id, session_id, message, created_at

CREATE OR REPLACE VIEW langchain_memory AS
SELECT
  id,
  session_id,
  message,
  created_at
FROM roleplay_chat_memory;

-- Grant permissions para service role (N8N usa service role)
GRANT ALL ON langchain_memory TO service_role;
GRANT ALL ON langchain_memory TO postgres;

COMMENT ON VIEW langchain_memory IS
'View simplificada para LangChain N8N - esconde colunas user_id, company_id, context que causam conflito com RLS';
