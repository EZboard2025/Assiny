-- Tabela de personas (substitui customer_segments)
CREATE TABLE IF NOT EXISTS personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_type TEXT NOT NULL CHECK (business_type IN ('B2B', 'B2C')),

  -- Campos comuns
  photo_url TEXT,
  context TEXT,

  -- Campos B2C
  profession TEXT, -- B2C: Profissão
  what_seeks TEXT, -- B2C: O que busca/valoriza?
  main_pains TEXT, -- B2C: Principais dores/problemas

  -- Campos B2B
  job_title TEXT, -- B2B: Cargo
  company_type TEXT, -- B2B: Tipo de Empresa
  company_goals TEXT, -- B2B: O que busca para a empresa?
  business_challenges TEXT, -- B2B: Principais desafios/dores do negócio

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_personas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER personas_updated_at
  BEFORE UPDATE ON personas
  FOR EACH ROW
  EXECUTE FUNCTION update_personas_updated_at();

-- Habilitar RLS (Row Level Security)
ALTER TABLE personas ENABLE ROW LEVEL SECURITY;

-- Política: Permitir leitura para usuários autenticados
CREATE POLICY "Permitir leitura de personas para usuários autenticados"
  ON personas
  FOR SELECT
  TO authenticated
  USING (true);

-- Política: Permitir todas operações para service_role
CREATE POLICY "Permitir todas operações para service_role"
  ON personas
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Política: Permitir insert/update/delete para usuários autenticados (admins)
CREATE POLICY "Permitir operações de escrita para autenticados"
  ON personas
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Índices para melhorar performance
CREATE INDEX idx_personas_business_type ON personas(business_type);
CREATE INDEX idx_personas_created_at ON personas(created_at DESC);
