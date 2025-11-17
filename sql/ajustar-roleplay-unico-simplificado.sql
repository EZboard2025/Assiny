-- Ajustar estrutura para link fixo por empresa
-- Cada empresa tem apenas UM link de roleplay público com configuração pré-definida

-- 1. Simplificar tabela roleplay_links (uma config por empresa)
DROP TABLE IF EXISTS roleplay_links CASCADE;

CREATE TABLE roleplay_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE, -- UNIQUE garante 1 por empresa
  is_active BOOLEAN DEFAULT true,
  -- Configuração pré-definida do roleplay
  config JSONB NOT NULL DEFAULT '{
    "age_range": "25-34",
    "temperament": "Analítico",
    "persona_id": null,
    "objection_ids": []
  }'::jsonb,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Manter roleplays_unicos como está (armazena as sessões)
-- (já existe, não precisa recriar)

-- 3. Criar índices
CREATE INDEX IF NOT EXISTS idx_roleplay_links_company ON roleplay_links(company_id);

-- 4. RLS Policies
ALTER TABLE roleplay_links ENABLE ROW LEVEL SECURITY;

-- Admin/Gestor pode ver e editar config da sua empresa
CREATE POLICY "Admin pode gerenciar config roleplay da empresa" ON roleplay_links
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE user_id = auth.uid()
      AND company_id = roleplay_links.company_id
      AND role IN ('Admin', 'Gestor')
    )
  );

-- Função para obter ou criar config de roleplay da empresa
CREATE OR REPLACE FUNCTION get_or_create_roleplay_config(p_company_id UUID)
RETURNS roleplay_links AS $$
DECLARE
  v_config roleplay_links;
BEGIN
  -- Tentar buscar config existente
  SELECT * INTO v_config
  FROM roleplay_links
  WHERE company_id = p_company_id;

  -- Se não existir, criar uma nova
  IF NOT FOUND THEN
    INSERT INTO roleplay_links (company_id)
    VALUES (p_company_id)
    RETURNING * INTO v_config;
  END IF;

  RETURN v_config;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;