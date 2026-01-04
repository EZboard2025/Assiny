-- Tabela para sessões de teste de leads (página /teste)
-- Execute no Supabase SQL Editor

CREATE TABLE IF NOT EXISTS test_roleplays (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Lead info (captura obrigatória)
  lead_name TEXT NOT NULL,
  lead_email TEXT NOT NULL,
  lead_phone TEXT NOT NULL,

  -- Company info fornecido pelo lead (JSONB)
  -- Estrutura: { nome, descricao, produtos_servicos, diferenciais }
  company_info JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Configuração do roleplay
  business_type TEXT NOT NULL CHECK (business_type IN ('B2B', 'B2C')),

  -- Persona criada pelo lead (JSONB)
  -- B2B: { job_title, company_type, context, company_goals, business_challenges }
  -- B2C: { profession, context, what_seeks, main_pains }
  persona_data JSONB NOT NULL,

  -- Objeções criadas pelo lead (array de objetos)
  -- Estrutura: [{ name: "...", rebuttals: ["...", "..."] }]
  objections_data JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Perfil do cliente simulado
  client_age INTEGER NOT NULL,
  client_temperament TEXT NOT NULL,

  -- Sessão do roleplay
  thread_id TEXT,
  client_name TEXT, -- Nome gerado para o cliente virtual
  messages JSONB DEFAULT '[]'::jsonb,

  -- Avaliação
  evaluation JSONB,
  overall_score DECIMAL(3,1),
  performance_level TEXT,

  -- Status e timestamps
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  ended_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER,

  -- Metadata para analytics
  user_agent TEXT,
  referrer TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Índices para consultas e analytics
CREATE INDEX IF NOT EXISTS idx_test_roleplays_email ON test_roleplays(lead_email);
CREATE INDEX IF NOT EXISTS idx_test_roleplays_status ON test_roleplays(status);
CREATE INDEX IF NOT EXISTS idx_test_roleplays_created ON test_roleplays(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_test_roleplays_score ON test_roleplays(overall_score);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_test_roleplays_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_test_roleplays_updated_at ON test_roleplays;
CREATE TRIGGER trigger_update_test_roleplays_updated_at
  BEFORE UPDATE ON test_roleplays
  FOR EACH ROW
  EXECUTE FUNCTION update_test_roleplays_updated_at();

-- Comentários para documentação
COMMENT ON TABLE test_roleplays IS 'Sessões de roleplay de teste para leads (página /teste)';
COMMENT ON COLUMN test_roleplays.lead_name IS 'Nome do lead';
COMMENT ON COLUMN test_roleplays.lead_email IS 'Email do lead para contato';
COMMENT ON COLUMN test_roleplays.lead_phone IS 'Telefone do lead para contato';
COMMENT ON COLUMN test_roleplays.company_info IS 'Dados da empresa do lead (nome, descrição, produtos, diferenciais)';
COMMENT ON COLUMN test_roleplays.persona_data IS 'Persona criada pelo lead para o roleplay';
COMMENT ON COLUMN test_roleplays.objections_data IS 'Objeções criadas pelo lead com rebuttals';
