-- ============================================================================
-- ML Pipeline: Tabelas para extração de padrões de reuniões reais
-- Usado para enriquecer roleplays com dados de conversas reais
-- ============================================================================

-- Ensure pgvector extension exists
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. meeting_patterns — Padrões extraídos de reuniões reais (com embeddings)
CREATE TABLE IF NOT EXISTS meeting_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  meet_evaluation_id UUID NOT NULL REFERENCES meet_evaluations(id) ON DELETE CASCADE,
  pattern_type VARCHAR(50) NOT NULL CHECK (pattern_type IN (
    'objection', 'speech_pattern', 'emotional_progression', 'conversation_flow'
  )),
  pattern_data JSONB NOT NULL,
  content TEXT NOT NULL,
  embedding VECTOR(1536),
  frequency INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meeting_patterns_company ON meeting_patterns(company_id);
CREATE INDEX IF NOT EXISTS idx_meeting_patterns_type ON meeting_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_meeting_patterns_eval ON meeting_patterns(meet_evaluation_id);

ALTER TABLE meeting_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to meeting_patterns"
  ON meeting_patterns FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 2. real_objection_bank — Banco de objeções reais com contexto e frequência
CREATE TABLE IF NOT EXISTS real_objection_bank (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  objection_type VARCHAR(50) NOT NULL,
  objection_text TEXT NOT NULL,
  client_exact_phrases JSONB DEFAULT '[]',
  context_examples JSONB DEFAULT '[]',
  frequency INTEGER DEFAULT 1,
  avg_resolution_score DECIMAL(3,1),
  embedding VECTOR(1536),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_real_objections_company ON real_objection_bank(company_id);
CREATE INDEX IF NOT EXISTS idx_real_objections_type ON real_objection_bank(objection_type);

ALTER TABLE real_objection_bank ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to real_objection_bank"
  ON real_objection_bank FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 3. conversation_flow_templates — Templates de fluxo de conversa
CREATE TABLE IF NOT EXISTS conversation_flow_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  meet_evaluation_id UUID NOT NULL REFERENCES meet_evaluations(id) ON DELETE CASCADE,
  flow_data JSONB NOT NULL,
  outcome VARCHAR(20),
  overall_score DECIMAL(3,1),
  embedding VECTOR(1536),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flow_templates_company ON conversation_flow_templates(company_id);

ALTER TABLE conversation_flow_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to conversation_flow_templates"
  ON conversation_flow_templates FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 4. Adicionar realism_score à roleplay_sessions
ALTER TABLE roleplay_sessions ADD COLUMN IF NOT EXISTS realism_score DECIMAL(5,2);
