-- Tabela para armazenar resumos de performance dos usuários
-- Usado para personalizar atendimento do agente AI

CREATE TABLE IF NOT EXISTS user_performance_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  user_email TEXT NOT NULL,

  -- Métricas gerais
  total_sessions INTEGER NOT NULL DEFAULT 0,
  overall_average DECIMAL(3,1) NOT NULL DEFAULT 0.0,

  -- Médias SPIN
  spin_s_average DECIMAL(3,1) NOT NULL DEFAULT 0.0,
  spin_p_average DECIMAL(3,1) NOT NULL DEFAULT 0.0,
  spin_i_average DECIMAL(3,1) NOT NULL DEFAULT 0.0,
  spin_n_average DECIMAL(3,1) NOT NULL DEFAULT 0.0,

  -- Pontos fortes recorrentes (últimos 5 roleplays)
  -- Array de objetos JSON: [{text: string, count: number}]
  top_strengths JSONB DEFAULT '[]'::jsonb,

  -- Gaps críticos recorrentes (últimos 5 roleplays)
  -- Array de objetos JSON: [{text: string, count: number}]
  critical_gaps JSONB DEFAULT '[]'::jsonb,

  -- Melhorias prioritárias (últimos 5 roleplays)
  -- Array de objetos JSON: [{area: string, current_gap: string, action_plan: string, priority: string}]
  priority_improvements JSONB DEFAULT '[]'::jsonb,

  -- Evolução recente
  latest_session_score DECIMAL(3,1),
  score_improvement DECIMAL(3,1),
  trend TEXT, -- 'improving', 'stable', 'declining'

  -- Metadados
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_performance_summaries_user_id ON user_performance_summaries(user_id);
CREATE INDEX IF NOT EXISTS idx_performance_summaries_updated ON user_performance_summaries(last_updated DESC);

-- RLS (Row Level Security)
ALTER TABLE user_performance_summaries ENABLE ROW LEVEL SECURITY;

-- Policy: Usuários podem ver apenas seu próprio resumo
CREATE POLICY "Users can view their own summary"
  ON user_performance_summaries
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Service role pode fazer tudo (para o agente AI)
CREATE POLICY "Service role has full access"
  ON user_performance_summaries
  FOR ALL
  USING (auth.role() = 'service_role');

-- Comentários para documentação
COMMENT ON TABLE user_performance_summaries IS 'Armazena resumos consolidados de performance dos usuários para personalização do agente AI';
COMMENT ON COLUMN user_performance_summaries.top_strengths IS 'Top 5 pontos fortes mais frequentes nos últimos 5 roleplays';
COMMENT ON COLUMN user_performance_summaries.critical_gaps IS 'Top 5 gaps críticos mais frequentes nos últimos 5 roleplays';
COMMENT ON COLUMN user_performance_summaries.priority_improvements IS 'Top 10 melhorias prioritárias dos últimos 5 roleplays';
COMMENT ON COLUMN user_performance_summaries.trend IS 'Tendência de evolução: improving, stable, ou declining';
