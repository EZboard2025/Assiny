-- Adicionar company_id à tabela roleplay_chat_memory para suporte multi-tenant

ALTER TABLE public.roleplay_chat_memory
ADD COLUMN IF NOT EXISTS company_id UUID;

-- Índice para performance em queries filtradas por empresa
CREATE INDEX IF NOT EXISTS idx_roleplay_chat_memory_company_id ON public.roleplay_chat_memory(company_id);

-- Atualizar RLS policies para considerar company_id

-- Remover policies antigas
DROP POLICY IF EXISTS "Users can view their own roleplay messages" ON public.roleplay_chat_memory;
DROP POLICY IF EXISTS "Users can insert their own roleplay messages" ON public.roleplay_chat_memory;

-- Policy: Usuários só veem mensagens da sua empresa
CREATE POLICY "Users can view their company roleplay messages"
  ON public.roleplay_chat_memory
  FOR SELECT
  USING (
    auth.uid() = user_id
    AND company_id = (SELECT company_id FROM public.employees WHERE user_id = auth.uid() LIMIT 1)
  );

-- Policy: Usuários podem inserir mensagens para sua empresa
CREATE POLICY "Users can insert their company roleplay messages"
  ON public.roleplay_chat_memory
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND company_id = (SELECT company_id FROM public.employees WHERE user_id = auth.uid() LIMIT 1)
  );

-- Atualizar trigger para auto-preencher company_id também
CREATE OR REPLACE FUNCTION auto_fill_roleplay_user_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Se user_id não foi fornecido, buscar da primeira mensagem da sessão
  IF NEW.user_id IS NULL THEN
    SELECT user_id, company_id INTO NEW.user_id, NEW.company_id
    FROM roleplay_chat_memory
    WHERE session_id = NEW.session_id
    AND user_id IS NOT NULL
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  -- Se company_id não foi fornecido, buscar do employee
  IF NEW.company_id IS NULL AND NEW.user_id IS NOT NULL THEN
    SELECT company_id INTO NEW.company_id
    FROM public.employees
    WHERE user_id = NEW.user_id
    LIMIT 1;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON COLUMN public.roleplay_chat_memory.company_id IS 'ID da empresa (multi-tenant)';
