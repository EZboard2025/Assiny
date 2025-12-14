-- Verificar se existe roleplay_link para a empresa
SELECT * FROM roleplay_links
WHERE company_id = '668d8d47-dc76-4a70-9084-2dd68114e79e';

-- Se não existir, criar um novo
INSERT INTO roleplay_links (
  company_id,
  link_code,
  name,
  description,
  config,
  is_active,
  usage_count,
  created_at,
  updated_at
) VALUES (
  '668d8d47-dc76-4a70-9084-2dd68114e79e',
  'TEST1234',
  'Roleplay Público',
  'Link de roleplay público da empresa',
  '{"age": "25-34", "temperament": "Analítico", "persona_id": null, "objection_ids": []}',
  true,
  0,
  NOW(),
  NOW()
) ON CONFLICT (company_id) DO UPDATE
SET updated_at = NOW()
RETURNING *;