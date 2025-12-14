-- Simplesmente ativar o link existente
UPDATE roleplay_links
SET is_active = true
WHERE link_code = '59F6DD9D';

-- Verificar se foi ativado
SELECT link_code, is_active, usage_count
FROM roleplay_links
WHERE link_code = '59F6DD9D';