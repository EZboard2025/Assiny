-- Tabela de compartilhamento de avaliações Meet entre vendedores
CREATE TABLE IF NOT EXISTS shared_meet_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id UUID NOT NULL REFERENCES meet_evaluations(id) ON DELETE CASCADE,
  shared_by UUID NOT NULL REFERENCES auth.users(id),
  shared_with UUID NOT NULL REFERENCES auth.users(id),
  shared_sections TEXT[] NOT NULL, -- ['smart_notes','spin','evaluation','transcript']
  message TEXT,
  company_id UUID NOT NULL REFERENCES companies(id),
  is_viewed BOOLEAN DEFAULT FALSE,
  viewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(evaluation_id, shared_by, shared_with)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_shared_meet_eval_shared_with ON shared_meet_evaluations(shared_with);
CREATE INDEX IF NOT EXISTS idx_shared_meet_eval_shared_by ON shared_meet_evaluations(shared_by);
CREATE INDEX IF NOT EXISTS idx_shared_meet_eval_company ON shared_meet_evaluations(company_id);

-- RLS
ALTER TABLE shared_meet_evaluations ENABLE ROW LEVEL SECURITY;

-- Quem compartilhou e quem recebeu podem ver
CREATE POLICY "Users can see shares they sent or received"
  ON shared_meet_evaluations FOR SELECT TO authenticated
  USING (auth.uid() = shared_by OR auth.uid() = shared_with);

-- Quem compartilhou pode inserir
CREATE POLICY "Users can create shares"
  ON shared_meet_evaluations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = shared_by);

-- Quem recebeu pode atualizar (marcar como viewed)
CREATE POLICY "Recipients can update shares"
  ON shared_meet_evaluations FOR UPDATE TO authenticated
  USING (auth.uid() = shared_with);

-- Service role tem acesso total
CREATE POLICY "Service role full access"
  ON shared_meet_evaluations FOR ALL TO service_role
  USING (true);
