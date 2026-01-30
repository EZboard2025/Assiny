-- Tabela para armazenar avaliações de calls do Google Meet
-- Criada em: 2024

CREATE TABLE IF NOT EXISTS meet_evaluations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Metadata da call
  meeting_id TEXT NOT NULL,
  seller_name TEXT NOT NULL,
  call_objective TEXT,
  funnel_stage TEXT CHECK (funnel_stage IN ('prospeccao', 'discovery', 'demo', 'negociacao', 'fechamento', 'follow_up')),

  -- Transcrição completa
  transcript JSONB NOT NULL,

  -- Avaliação completa retornada pelo agente
  evaluation JSONB NOT NULL,

  -- Scores extraídos para facilitar queries
  overall_score INTEGER CHECK (overall_score >= 0 AND overall_score <= 100),
  performance_level TEXT CHECK (performance_level IN ('poor', 'needs_improvement', 'good', 'very_good', 'excellent', 'legendary')),
  spin_s_score DECIMAL(3,1),
  spin_p_score DECIMAL(3,1),
  spin_i_score DECIMAL(3,1),
  spin_n_score DECIMAL(3,1),

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_meet_evaluations_user_id ON meet_evaluations(user_id);
CREATE INDEX IF NOT EXISTS idx_meet_evaluations_company_id ON meet_evaluations(company_id);
CREATE INDEX IF NOT EXISTS idx_meet_evaluations_meeting_id ON meet_evaluations(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meet_evaluations_created_at ON meet_evaluations(created_at DESC);

-- RLS
ALTER TABLE meet_evaluations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (para reexecução segura)
DROP POLICY IF EXISTS "Users can view their own meet evaluations" ON meet_evaluations;
DROP POLICY IF EXISTS "Users can insert their own meet evaluations" ON meet_evaluations;
DROP POLICY IF EXISTS "Users can update their own meet evaluations" ON meet_evaluations;
DROP POLICY IF EXISTS "Users can delete their own meet evaluations" ON meet_evaluations;

-- Policy: Users can see their own evaluations
CREATE POLICY "Users can view their own meet evaluations"
ON meet_evaluations FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- Policy: Users can insert their own evaluations
CREATE POLICY "Users can insert their own meet evaluations"
ON meet_evaluations FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own evaluations
CREATE POLICY "Users can update their own meet evaluations"
ON meet_evaluations FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

-- Policy: Users can delete their own evaluations
CREATE POLICY "Users can delete their own meet evaluations"
ON meet_evaluations FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_meet_evaluations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_meet_evaluations_updated_at ON meet_evaluations;

CREATE TRIGGER trigger_update_meet_evaluations_updated_at
BEFORE UPDATE ON meet_evaluations
FOR EACH ROW
EXECUTE FUNCTION update_meet_evaluations_updated_at();

-- Comentários
COMMENT ON TABLE meet_evaluations IS 'Armazena avaliações de calls do Google Meet usando metodologia SPIN Selling';
COMMENT ON COLUMN meet_evaluations.transcript IS 'Array de segmentos da transcrição [{speaker, text, timestamp}]';
COMMENT ON COLUMN meet_evaluations.evaluation IS 'Avaliação completa retornada pelo agente de IA';
COMMENT ON COLUMN meet_evaluations.funnel_stage IS 'Estágio do funil: prospeccao, discovery, demo, negociacao, fechamento, follow_up';
