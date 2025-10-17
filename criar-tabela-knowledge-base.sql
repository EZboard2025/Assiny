-- Tabela simples para armazenar conhecimento sobre SPIN Selling e Psicologia
-- Usado para alimentar agentes de IA com contexto especializado

CREATE TABLE IF NOT EXISTS knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Categorização
  category TEXT NOT NULL, -- 'spin_selling', 'psychology', 'sales_techniques', etc.
  title TEXT NOT NULL,

  -- Conteúdo
  content TEXT NOT NULL, -- Todo o conteúdo/texto sobre o tópico

  -- Controle
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_knowledge_category ON knowledge_base(category);

-- RLS (Row Level Security)
ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;

-- Policy: Todos podem ler
CREATE POLICY "Everyone can view knowledge"
  ON knowledge_base
  FOR SELECT
  USING (true);

-- Policy: Apenas admins podem criar/editar
CREATE POLICY "Only admins can modify knowledge"
  ON knowledge_base
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Policy: Service role tem acesso total (para agentes AI)
CREATE POLICY "Service role has full access"
  ON knowledge_base
  FOR ALL
  USING (auth.role() = 'service_role');

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_knowledge_base_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_knowledge_base_timestamp
  BEFORE UPDATE ON knowledge_base
  FOR EACH ROW
  EXECUTE FUNCTION update_knowledge_base_updated_at();

-- Comentários
COMMENT ON TABLE knowledge_base IS 'Base de conhecimento sobre SPIN Selling e psicologia para agentes de IA';
COMMENT ON COLUMN knowledge_base.category IS 'Categoria: spin_selling, psychology, sales_techniques, etc.';
COMMENT ON COLUMN knowledge_base.content IS 'Conteúdo completo sobre o tópico';
