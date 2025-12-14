-- 1. Primeiro, ativar o link existente
UPDATE roleplay_links
SET is_active = true
WHERE company_id IN (SELECT id FROM companies LIMIT 10);

-- 2. Atualizar a função para criar links ATIVOS por padrão
CREATE OR REPLACE FUNCTION get_or_create_roleplay_config(p_company_id UUID)
RETURNS roleplay_links AS $$
DECLARE
  v_config roleplay_links;
  v_link_code TEXT;
BEGIN
  -- Tentar buscar config existente
  SELECT * INTO v_config
  FROM roleplay_links
  WHERE company_id = p_company_id
  LIMIT 1;

  -- Se não existir, criar uma nova
  IF NOT FOUND THEN
    -- Gerar código único
    v_link_code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT), 1, 8));

    INSERT INTO roleplay_links (
      company_id,
      link_code,
      name,
      description,
      config,
      is_active,
      usage_count
    )
    VALUES (
      p_company_id,
      v_link_code,
      'Roleplay Público',
      'Link de roleplay público da empresa',
      '{"age": "25-34", "temperament": "Analítico", "persona_id": null, "objection_ids": []}'::jsonb,
      true, -- AGORA COMEÇA ATIVO!
      0
    )
    RETURNING * INTO v_config;
  END IF;

  RETURN v_config;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Verificar se foi atualizado
SELECT id, company_id, is_active, usage_count
FROM roleplay_links;