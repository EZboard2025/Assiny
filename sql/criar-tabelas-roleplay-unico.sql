-- ====================================
-- FEATURE: ROLEPLAY ÚNICO
-- Permite que gestores criem links únicos para roleplays públicos
-- sem necessidade de autenticação dos participantes
-- ====================================

-- 1. TABELA: roleplay_links
-- Armazena os links únicos criados pelos gestores com suas configurações
CREATE TABLE IF NOT EXISTS roleplay_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  link_code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL, -- Nome do link para identificação interna
  description TEXT, -- Descrição opcional do propósito do link
  config JSONB NOT NULL DEFAULT '{}'::jsonb, -- Configurações do roleplay
  -- Estrutura do config:
  -- {
  --   "age": "25-34",
  --   "temperament": "Analítico",
  --   "persona_id": "uuid-da-persona",
  --   "objection_ids": ["uuid1", "uuid2", "uuid3"]
  -- }
  is_active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0, -- Contador de quantas vezes o link foi usado
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Índices para performance
CREATE INDEX idx_roleplay_links_company_id ON roleplay_links(company_id);
CREATE INDEX idx_roleplay_links_link_code ON roleplay_links(link_code);
CREATE INDEX idx_roleplay_links_is_active ON roleplay_links(is_active);

-- 2. TABELA: roleplays_unicos
-- Armazena as sessões de roleplay feitas através dos links únicos
CREATE TABLE IF NOT EXISTS roleplays_unicos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  link_id UUID REFERENCES roleplay_links(id) ON DELETE SET NULL,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  participant_name TEXT NOT NULL,
  participant_email TEXT, -- Opcional, caso queiram capturar
  participant_phone TEXT, -- Opcional, caso queiram capturar

  -- Dados da sessão (similar ao roleplay_sessions)
  thread_id TEXT, -- ID da thread no OpenAI Assistant
  session_id TEXT UNIQUE, -- ID único da sessão
  messages JSONB DEFAULT '[]'::jsonb, -- Array de mensagens
  config JSONB NOT NULL, -- Snapshot da configuração usada (caso o link mude depois)

  -- Avaliação
  evaluation JSONB, -- Resultado da avaliação SPIN
  overall_score DECIMAL(3,1), -- Score geral extraído da avaliação (0-10)
  performance_level TEXT, -- Level extraído (legendary, excellent, etc)

  -- Status e timestamps
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  ended_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Índices para performance
CREATE INDEX idx_roleplays_unicos_company_id ON roleplays_unicos(company_id);
CREATE INDEX idx_roleplays_unicos_link_id ON roleplays_unicos(link_id);
CREATE INDEX idx_roleplays_unicos_status ON roleplays_unicos(status);
CREATE INDEX idx_roleplays_unicos_created_at ON roleplays_unicos(created_at DESC);
CREATE INDEX idx_roleplays_unicos_overall_score ON roleplays_unicos(overall_score);

-- 3. TRIGGER: Atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger nas duas tabelas
CREATE TRIGGER update_roleplay_links_updated_at
  BEFORE UPDATE ON roleplay_links
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_roleplays_unicos_updated_at
  BEFORE UPDATE ON roleplays_unicos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 4. TRIGGER: Incrementar usage_count quando um roleplay único é criado
CREATE OR REPLACE FUNCTION increment_link_usage_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.link_id IS NOT NULL THEN
    UPDATE roleplay_links
    SET usage_count = usage_count + 1
    WHERE id = NEW.link_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER increment_usage_on_roleplay_create
  AFTER INSERT ON roleplays_unicos
  FOR EACH ROW
  EXECUTE FUNCTION increment_link_usage_count();

-- 5. RLS (Row Level Security)
-- Habilitar RLS nas tabelas
ALTER TABLE roleplay_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE roleplays_unicos ENABLE ROW LEVEL SECURITY;

-- Policy: Apenas admins da empresa podem gerenciar roleplay_links
CREATE POLICY "Admins can manage roleplay links"
  ON roleplay_links
  FOR ALL
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id
      FROM employees
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id
      FROM employees
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- Policy: Service role pode ver todos os links (para APIs públicas)
CREATE POLICY "Service role can view all roleplay links"
  ON roleplay_links
  FOR SELECT
  TO service_role
  USING (true);

-- Policy: Apenas admins da empresa podem ver roleplays_unicos
CREATE POLICY "Admins can view unique roleplays"
  ON roleplays_unicos
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id
      FROM employees
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- Policy: Service role tem acesso total a roleplays_unicos (para APIs públicas)
CREATE POLICY "Service role has full access to unique roleplays"
  ON roleplays_unicos
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 6. FUNÇÃO HELPER: Gerar código único para links
-- Gera um código alfanumérico de 8 caracteres
CREATE OR REPLACE FUNCTION generate_link_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 7. FUNÇÃO: Criar link de roleplay com código único
CREATE OR REPLACE FUNCTION create_roleplay_link(
  p_company_id UUID,
  p_name TEXT,
  p_description TEXT,
  p_config JSONB,
  p_created_by UUID
)
RETURNS TABLE(
  id UUID,
  link_code TEXT,
  full_url TEXT
) AS $$
DECLARE
  v_id UUID;
  v_link_code TEXT;
  v_attempts INTEGER := 0;
  v_max_attempts INTEGER := 10;
BEGIN
  -- Tentar gerar código único (até 10 tentativas)
  LOOP
    v_link_code := generate_link_code();
    v_attempts := v_attempts + 1;

    -- Verificar se o código já existe
    IF NOT EXISTS (SELECT 1 FROM roleplay_links WHERE link_code = v_link_code) THEN
      EXIT; -- Código único encontrado
    END IF;

    IF v_attempts >= v_max_attempts THEN
      RAISE EXCEPTION 'Não foi possível gerar um código único após % tentativas', v_max_attempts;
    END IF;
  END LOOP;

  -- Inserir o novo link
  INSERT INTO roleplay_links (company_id, link_code, name, description, config, created_by)
  VALUES (p_company_id, v_link_code, p_name, p_description, p_config, p_created_by)
  RETURNING roleplay_links.id INTO v_id;

  -- Retornar os dados do link criado
  RETURN QUERY
  SELECT
    v_id,
    v_link_code,
    'https://ramppy.site/roleplay/' || v_link_code AS full_url;
END;
$$ LANGUAGE plpgsql;

-- 8. VIEW: Estatísticas de roleplays únicos por link
CREATE OR REPLACE VIEW roleplay_link_stats AS
SELECT
  rl.id,
  rl.company_id,
  rl.link_code,
  rl.name,
  rl.is_active,
  rl.usage_count,
  COUNT(DISTINCT ru.id) as total_sessions,
  COUNT(DISTINCT ru.id) FILTER (WHERE ru.status = 'completed') as completed_sessions,
  COUNT(DISTINCT ru.id) FILTER (WHERE ru.status = 'abandoned') as abandoned_sessions,
  AVG(ru.overall_score) FILTER (WHERE ru.status = 'completed') as avg_score,
  MAX(ru.overall_score) FILTER (WHERE ru.status = 'completed') as max_score,
  MIN(ru.overall_score) FILTER (WHERE ru.status = 'completed') as min_score,
  AVG(ru.duration_seconds) FILTER (WHERE ru.status = 'completed') as avg_duration_seconds,
  MAX(ru.created_at) as last_used_at
FROM roleplay_links rl
LEFT JOIN roleplays_unicos ru ON rl.id = ru.link_id
GROUP BY rl.id, rl.company_id, rl.link_code, rl.name, rl.is_active, rl.usage_count;

-- Comentários para documentação
COMMENT ON TABLE roleplay_links IS 'Links únicos para roleplays públicos configurados por gestores';
COMMENT ON TABLE roleplays_unicos IS 'Sessões de roleplay realizadas através de links únicos (sem autenticação)';
COMMENT ON VIEW roleplay_link_stats IS 'Estatísticas agregadas de uso dos links de roleplay';

-- ====================================
-- FIM DA ESTRUTURA DO BANCO DE DADOS
-- Para executar: rode este arquivo no Supabase SQL Editor
-- ====================================