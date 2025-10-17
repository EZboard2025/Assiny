-- Atualizar mensagens existentes na tabela chat_sessions com user_id

-- Opção 1: Atribuir todas as mensagens existentes a um usuário específico
-- Substitua 'SEU_USER_ID_AQUI' pelo ID do usuário atual
UPDATE chat_sessions
SET user_id = '69b36147-396c-4eca-a05e-52af950e828e' -- Seu user_id
WHERE user_id IS NULL;

-- Verificar quantas linhas foram atualizadas
SELECT COUNT(*) as mensagens_atualizadas
FROM chat_sessions
WHERE user_id = '69b36147-396c-4eca-a05e-52af950e828e';

-- Ver todas as sessões agora com user_id
SELECT DISTINCT session_id, user_id, COUNT(*) as msg_count
FROM chat_sessions
GROUP BY session_id, user_id
ORDER BY MAX(created_at) DESC;
