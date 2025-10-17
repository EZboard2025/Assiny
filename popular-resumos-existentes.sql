-- Script para popular user_performance_summaries com dados existentes
-- Execute este script após criar a tabela para processar sessões antigas

-- Para o seu usuário de teste específico
-- Você pode chamar a API via curl/Postman ou executar direto pelo frontend

-- Exemplo de chamada via psql (substitua USER_ID pelo ID do usuário):
-- SELECT * FROM auth.users; -- Para ver os user_ids disponíveis

-- OU você pode criar uma função temporária para processar todos os usuários:

CREATE OR REPLACE FUNCTION populate_all_performance_summaries()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_record RECORD;
BEGIN
  -- Para cada usuário que tem pelo menos uma sessão completada
  FOR user_record IN
    SELECT DISTINCT user_id
    FROM roleplay_sessions
    WHERE status = 'completed'
    AND evaluation IS NOT NULL
  LOOP
    -- Aqui você precisaria chamar a API /api/performance-summary/update
    -- Como não podemos fazer HTTP calls direto do PostgreSQL sem extensões,
    -- vamos apenas listar os usuários que precisam ser processados
    RAISE NOTICE 'Usuário precisa ser processado: %', user_record.user_id;
  END LOOP;
END;
$$;

-- Execute a função para ver quais usuários precisam ser processados
SELECT populate_all_performance_summaries();

-- Limpar a função após uso
DROP FUNCTION IF EXISTS populate_all_performance_summaries();

-- ALTERNATIVA: Se você quiser processar apenas seu usuário de teste:
-- Copie este comando e execute no terminal (substitua o user_id):

-- curl -X POST http://localhost:3000/api/performance-summary/update \
--   -H "Content-Type: application/json" \
--   -d '{"userId": "69b36147-396c-4eca-a05e-52af950e928e"}'
