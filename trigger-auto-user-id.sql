-- Trigger para preencher automaticamente user_id baseado no session_id
-- Quando uma mensagem é inserida, busca o user_id da primeira mensagem daquela sessão

CREATE OR REPLACE FUNCTION auto_fill_user_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Se user_id já foi fornecido, não faz nada
  IF NEW.user_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Buscar user_id de outra mensagem com o mesmo session_id
  SELECT user_id INTO NEW.user_id
  FROM chat_sessions
  WHERE session_id = NEW.session_id
  AND user_id IS NOT NULL
  LIMIT 1;

  -- Se não encontrou nenhum user_id na sessão, deixa NULL
  -- (a primeira mensagem da sessão precisa ter user_id fornecido)

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger que executa antes de inserir
CREATE TRIGGER trigger_auto_fill_user_id
  BEFORE INSERT ON chat_sessions
  FOR EACH ROW
  EXECUTE FUNCTION auto_fill_user_id();

-- Comentário
COMMENT ON FUNCTION auto_fill_user_id() IS 'Preenche automaticamente user_id baseado em outras mensagens da mesma sessão';
