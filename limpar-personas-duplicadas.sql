-- Script para remover personas duplicadas
-- Mantém apenas a persona mais recente de cada duplicata

-- Ver duplicatas antes de deletar (EXECUTE PRIMEIRO PARA VERIFICAR)
SELECT
  job_title,
  profession,
  business_type,
  COUNT(*) as total
FROM personas
GROUP BY job_title, profession, business_type
HAVING COUNT(*) > 1;

-- Deletar duplicatas mantendo apenas a mais recente
-- CUIDADO: Descomente as linhas abaixo apenas após verificar os resultados acima

-- DELETE FROM personas
-- WHERE id NOT IN (
--   SELECT DISTINCT ON (job_title, profession, business_type) id
--   FROM personas
--   ORDER BY job_title, profession, business_type, created_at DESC
-- );

-- Verificar resultado (execute após deletar)
-- SELECT * FROM personas ORDER BY created_at DESC;
