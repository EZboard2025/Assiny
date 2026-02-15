-- Tabela para armazenar simulações de Meet salvas para depois
-- Quando o vendedor clica "Deixar para Depois" na avaliação de Meet,
-- a simulação é salva aqui e aparece no dashboard ao lado dos desafios diários

CREATE TABLE IF NOT EXISTS saved_simulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Configuração completa da simulação (persona, objeções, coaching, etc.)
  simulation_config JSONB NOT NULL,

  -- Justificativa gerada pela IA (por que o vendedor deve fazer esta simulação)
  simulation_justification TEXT,

  -- Contexto da reunião original (breve descrição)
  meeting_context TEXT,

  -- Referência à avaliação de Meet que gerou esta simulação (opcional)
  meet_evaluation_id UUID REFERENCES meet_evaluations(id) ON DELETE SET NULL,

  -- Status: pending = não praticou ainda, completed = já fez o roleplay
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),

  -- Referência à sessão de roleplay quando praticada (opcional)
  roleplay_session_id UUID REFERENCES roleplay_sessions(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_saved_simulations_user_id ON saved_simulations(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_simulations_company_id ON saved_simulations(company_id);
CREATE INDEX IF NOT EXISTS idx_saved_simulations_status ON saved_simulations(status);
CREATE INDEX IF NOT EXISTS idx_saved_simulations_user_status ON saved_simulations(user_id, status);

-- RLS
ALTER TABLE saved_simulations ENABLE ROW LEVEL SECURITY;

-- Service role tem acesso total
CREATE POLICY "Service role has full access to saved_simulations"
ON saved_simulations
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Usuários podem ver suas próprias simulações
CREATE POLICY "Users can view their own saved_simulations"
ON saved_simulations
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Usuários podem inserir suas próprias simulações
CREATE POLICY "Users can insert their own saved_simulations"
ON saved_simulations
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Usuários podem atualizar suas próprias simulações (marcar como completed)
CREATE POLICY "Users can update their own saved_simulations"
ON saved_simulations
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Usuários podem deletar suas próprias simulações
CREATE POLICY "Users can delete their own saved_simulations"
ON saved_simulations
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

COMMENT ON TABLE saved_simulations IS 'Simulações de Meet salvas para praticar depois. Aparecem no dashboard ao lado dos desafios diários.';
