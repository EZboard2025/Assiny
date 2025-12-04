-- Criar tabela de etiquetas (tags) para personas
CREATE TABLE IF NOT EXISTS tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  color VARCHAR(7) DEFAULT '#6B46C1', -- Cor hexadecimal (padrão roxo)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(company_id, name) -- Nome único por empresa
);

-- Criar tabela de relacionamento many-to-many entre personas e tags
CREATE TABLE IF NOT EXISTS personas_tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(persona_id, tag_id) -- Evita duplicação
);

-- Adicionar índices para performance
CREATE INDEX IF NOT EXISTS idx_tags_company_id ON tags(company_id);
CREATE INDEX IF NOT EXISTS idx_personas_tags_persona_id ON personas_tags(persona_id);
CREATE INDEX IF NOT EXISTS idx_personas_tags_tag_id ON personas_tags(tag_id);

-- Habilitar RLS para segurança multi-tenant
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE personas_tags ENABLE ROW LEVEL SECURITY;

-- Política RLS para tags (baseada em company_id)
CREATE POLICY "Users can view tags from their company" ON tags
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM employees WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert tags in their company" ON tags
  FOR INSERT WITH CHECK (
    company_id IN (
      SELECT company_id FROM employees WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update tags in their company" ON tags
  FOR UPDATE USING (
    company_id IN (
      SELECT company_id FROM employees WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete tags from their company" ON tags
  FOR DELETE USING (
    company_id IN (
      SELECT company_id FROM employees WHERE user_id = auth.uid()
    )
  );

-- Política RLS para personas_tags (baseada na persona)
CREATE POLICY "Users can view personas_tags from their company" ON personas_tags
  FOR SELECT USING (
    persona_id IN (
      SELECT id FROM personas WHERE company_id IN (
        SELECT company_id FROM employees WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert personas_tags in their company" ON personas_tags
  FOR INSERT WITH CHECK (
    persona_id IN (
      SELECT id FROM personas WHERE company_id IN (
        SELECT company_id FROM employees WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete personas_tags from their company" ON personas_tags
  FOR DELETE USING (
    persona_id IN (
      SELECT id FROM personas WHERE company_id IN (
        SELECT company_id FROM employees WHERE user_id = auth.uid()
      )
    )
  );