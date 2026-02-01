-- Tabela para armazenar desafios diários personalizados
-- Cada desafio é gerado pela IA com base na análise de fraquezas do vendedor

CREATE TABLE IF NOT EXISTS daily_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  challenge_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status VARCHAR(20) DEFAULT 'pending', -- pending, in_progress, completed, skipped
  difficulty_level INTEGER DEFAULT 1 CHECK (difficulty_level >= 1 AND difficulty_level <= 5),

  -- Configuração completa do desafio (gerada pela IA)
  challenge_config JSONB NOT NULL,
  -- Estrutura esperada do challenge_config:
  -- {
  --   "title": "Treinar Implicação com Cliente Analítico",
  --   "description": "Pratique criar urgência com um Diretor Financeiro cético",
  --   "target_weakness": "spin_i",
  --   "confidence_score": 0.85,
  --   "roleplay_config": {
  --     "persona_id": "uuid",
  --     "objection_ids": ["uuid1", "uuid2"],
  --     "age_range": "45-60",
  --     "temperament": "Analítico",
  --     "objective": "Discovery"
  --   },
  --   "success_criteria": {
  --     "spin_letter_target": "I",
  --     "spin_min_score": 6.0,
  --     "primary_indicator": "urgency_amplification_score",
  --     "primary_min_score": 6.5,
  --     "objection_handling_min": 6.0
  --   },
  --   "coaching_tips": ["Dica 1", "Dica 2"],
  --   "analysis_summary": {
  --     "pattern_detected": "Low Implication across roleplay and meet",
  --     "roleplay_evidence": { "avg_I": 4.2, "sessions_count": 5 },
  --     "meet_evidence": { "avg_I": 4.8, "calls_count": 3 }
  --   }
  -- }

  -- Explicação da IA sobre por que este desafio foi gerado
  ai_reasoning TEXT NOT NULL,

  -- Referência à sessão de roleplay quando o desafio é executado
  roleplay_session_id UUID REFERENCES roleplay_sessions(id),

  -- Resultados após completar o desafio
  result_score DECIMAL(3,1),
  success BOOLEAN,
  improvement_from_baseline DECIMAL(3,1),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  -- Cada usuário só pode ter um desafio por dia
  CONSTRAINT unique_daily_challenge UNIQUE (user_id, challenge_date)
);

-- Tabela para rastrear efetividade dos desafios ao longo do tempo
-- Monitora se os desafios estão realmente ajudando a melhorar fraquezas específicas

CREATE TABLE IF NOT EXISTS challenge_effectiveness (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Fraqueza alvo sendo trabalhada
  target_weakness VARCHAR(50) NOT NULL, -- spin_s, spin_p, spin_i, spin_n, objection_handling, etc.

  -- Métricas de progresso
  baseline_score DECIMAL(3,1) NOT NULL, -- Score inicial quando a fraqueza foi identificada
  challenges_completed INTEGER DEFAULT 0,
  current_score DECIMAL(3,1),
  total_improvement DECIMAL(3,1) DEFAULT 0,

  -- Status do progresso
  status VARCHAR(20) DEFAULT 'active', -- active, mastered (score >= 7.5), stalled (sem melhoria após 5 desafios)

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Cada usuário só pode ter um registro por fraqueza
  CONSTRAINT unique_user_weakness UNIQUE (user_id, target_weakness)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_daily_challenges_user_id ON daily_challenges(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_challenges_company_id ON daily_challenges(company_id);
CREATE INDEX IF NOT EXISTS idx_daily_challenges_date ON daily_challenges(challenge_date);
CREATE INDEX IF NOT EXISTS idx_daily_challenges_status ON daily_challenges(status);
CREATE INDEX IF NOT EXISTS idx_daily_challenges_user_date ON daily_challenges(user_id, challenge_date);

CREATE INDEX IF NOT EXISTS idx_challenge_effectiveness_user_id ON challenge_effectiveness(user_id);
CREATE INDEX IF NOT EXISTS idx_challenge_effectiveness_weakness ON challenge_effectiveness(target_weakness);
CREATE INDEX IF NOT EXISTS idx_challenge_effectiveness_status ON challenge_effectiveness(status);

-- RLS para segurança
ALTER TABLE daily_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_effectiveness ENABLE ROW LEVEL SECURITY;

-- Policies: Service role tem acesso total
CREATE POLICY "Service role has full access to daily_challenges"
ON daily_challenges
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role has full access to challenge_effectiveness"
ON challenge_effectiveness
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Policies: Usuários autenticados podem ver seus próprios desafios
CREATE POLICY "Users can view their own daily_challenges"
ON daily_challenges
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own daily_challenges"
ON daily_challenges
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own challenge_effectiveness"
ON challenge_effectiveness
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Comentários nas tabelas
COMMENT ON TABLE daily_challenges IS 'Desafios diários personalizados gerados pela IA com base nas fraquezas do vendedor';
COMMENT ON TABLE challenge_effectiveness IS 'Rastreamento da efetividade dos desafios em melhorar fraquezas específicas';

-- Adicionar coluna na tabela companies para toggle de desafios
ALTER TABLE companies ADD COLUMN IF NOT EXISTS daily_challenges_enabled BOOLEAN DEFAULT true;
COMMENT ON COLUMN companies.daily_challenges_enabled IS 'Se habilitado, o sistema gera desafios diários automaticamente para os vendedores';
