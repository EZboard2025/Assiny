-- Criar tabela roleplay_chat_memory para armazenar histórico de conversas do roleplay
-- Formato compatível com LangChain Postgres Chat Memory

CREATE TABLE IF NOT EXISTS public.roleplay_chat_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  message JSONB NOT NULL,
  context JSONB,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_roleplay_chat_memory_session_id ON public.roleplay_chat_memory(session_id);
CREATE INDEX IF NOT EXISTS idx_roleplay_chat_memory_user_id ON public.roleplay_chat_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_roleplay_chat_memory_created_at ON public.roleplay_chat_memory(created_at);

-- RLS Policies
ALTER TABLE public.roleplay_chat_memory ENABLE ROW LEVEL SECURITY;

-- Policy: Usuários só veem suas próprias mensagens
CREATE POLICY "Users can view their own roleplay messages"
  ON public.roleplay_chat_memory
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Usuários podem inserir suas próprias mensagens
CREATE POLICY "Users can insert their own roleplay messages"
  ON public.roleplay_chat_memory
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Service role tem acesso total (para N8N)
CREATE POLICY "Service role has full access to roleplay messages"
  ON public.roleplay_chat_memory
  FOR ALL
  USING (auth.role() = 'service_role');

-- Trigger para auto-preencher user_id com base no session_id
-- Similar ao chat_sessions, mas para roleplay
CREATE OR REPLACE FUNCTION auto_fill_roleplay_user_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Se user_id não foi fornecido, buscar da primeira mensagem da sessão
  IF NEW.user_id IS NULL THEN
    SELECT user_id INTO NEW.user_id
    FROM roleplay_chat_memory
    WHERE session_id = NEW.session_id
    AND user_id IS NOT NULL
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_fill_roleplay_user_id
  BEFORE INSERT ON roleplay_chat_memory
  FOR EACH ROW
  EXECUTE FUNCTION auto_fill_roleplay_user_id();

COMMENT ON TABLE public.roleplay_chat_memory IS 'Armazena histórico de conversas do roleplay com agente N8N';
COMMENT ON COLUMN public.roleplay_chat_memory.session_id IS 'ID da sessão (vinculado ao thread_id do roleplay_sessions)';
COMMENT ON COLUMN public.roleplay_chat_memory.message IS 'Formato LangChain: {type: "human"|"ai", data: {content: "..."}}';
COMMENT ON COLUMN public.roleplay_chat_memory.context IS 'Contexto do roleplay (idade, temperamento, persona, objeções)';
