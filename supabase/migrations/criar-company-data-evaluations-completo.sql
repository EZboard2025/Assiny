-- Criar tabela company_data_evaluations com user_id
CREATE TABLE IF NOT EXISTS public.company_data_evaluations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_data_id UUID REFERENCES public.company_data(id) ON DELETE CASCADE,
  nota_final INTEGER NOT NULL,
  classificacao TEXT NOT NULL,
  pode_usar BOOLEAN NOT NULL,
  capacidade_roleplay INTEGER NOT NULL,
  resumo TEXT NOT NULL,
  pontos_fortes JSONB DEFAULT '[]'::jsonb,
  principais_gaps JSONB DEFAULT '[]'::jsonb,
  campos_criticos_vazios JSONB DEFAULT '[]'::jsonb,
  proxima_acao TEXT,
  recomendacao_uso TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes para performance
CREATE INDEX IF NOT EXISTS company_evaluations_user_id_idx
  ON public.company_data_evaluations(user_id);

CREATE INDEX IF NOT EXISTS company_evaluations_company_id_idx
  ON public.company_data_evaluations(company_data_id);

CREATE INDEX IF NOT EXISTS company_evaluations_created_at_idx
  ON public.company_data_evaluations(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.company_data_evaluations ENABLE ROW LEVEL SECURITY;

-- Policy: Usuários veem apenas suas avaliações
CREATE POLICY "Usuários veem suas próprias avaliações"
  ON public.company_data_evaluations
  FOR SELECT
  USING (user_id = auth.uid());

-- Policy: Usuários gerenciam apenas suas avaliações
CREATE POLICY "Usuários gerenciam suas próprias avaliações"
  ON public.company_data_evaluations
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Policy: Service role tem acesso total (para AI agents)
CREATE POLICY "Service role acesso total evaluations"
  ON public.company_data_evaluations
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Comentários para documentação
COMMENT ON TABLE public.company_data_evaluations IS 'Armazena avaliações de qualidade dos dados da empresa geradas pelo agente de IA';
COMMENT ON COLUMN public.company_data_evaluations.user_id IS 'ID do usuário proprietário da avaliação';
COMMENT ON COLUMN public.company_data_evaluations.company_data_id IS 'Referência aos dados da empresa avaliados';
COMMENT ON COLUMN public.company_data_evaluations.nota_final IS 'Nota final da avaliação (0-100)';
COMMENT ON COLUMN public.company_data_evaluations.classificacao IS 'Classificação: Insuficiente, Ruim, Aceitável, Bom, Ótimo, Excelente';
COMMENT ON COLUMN public.company_data_evaluations.pode_usar IS 'Indica se os dados podem ser usados para treinamento (nota >= 55)';
COMMENT ON COLUMN public.company_data_evaluations.capacidade_roleplay IS 'Capacidade de suportar roleplay (0-100)';
COMMENT ON COLUMN public.company_data_evaluations.pontos_fortes IS 'Array de strings com pontos fortes identificados';
COMMENT ON COLUMN public.company_data_evaluations.principais_gaps IS 'Array de objetos com gaps identificados (campo, problema, impacto, acao)';
COMMENT ON COLUMN public.company_data_evaluations.campos_criticos_vazios IS 'Array de strings com campos críticos vazios';
