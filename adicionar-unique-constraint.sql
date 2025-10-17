-- Adicionar constraint UNIQUE no user_id para permitir upsert
ALTER TABLE user_performance_summaries
ADD CONSTRAINT unique_user_id UNIQUE (user_id);
