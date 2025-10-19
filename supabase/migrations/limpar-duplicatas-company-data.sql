-- Limpar registros duplicados em company_data (manter apenas o mais recente)
DELETE FROM public.company_data
WHERE id NOT IN (
  SELECT id
  FROM public.company_data
  ORDER BY created_at DESC
  LIMIT 1
);

-- Garantir que só existe 1 registro
SELECT COUNT(*) as total_registros FROM public.company_data;
