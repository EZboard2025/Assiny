-- Criar tabela para armazenar avaliações dos dados da empresa
CREATE TABLE IF NOT EXISTS public.company_data_evaluations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- Index para buscar por company_data_id
CREATE INDEX IF NOT EXISTS company_evaluations_company_id_idx
  ON public.company_data_evaluations(company_data_id);

-- Index para ordenar por data de criação
CREATE INDEX IF NOT EXISTS company_evaluations_created_at_idx
  ON public.company_data_evaluations(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.company_data_evaluations ENABLE ROW LEVEL SECURITY;

-- Policy: Todos autenticados podem ler suas próprias avaliações
CREATE POLICY "Usuários podem ler suas avaliações"
  ON public.company_data_evaluations
  FOR SELECT
  USING (
    company_data_id IN (
      SELECT id FROM public.company_data
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Apenas autenticados podem inserir/atualizar/deletar
CREATE POLICY "Usuários podem gerenciar suas avaliações"
  ON public.company_data_evaluations
  FOR ALL
  USING (
    company_data_id IN (
      SELECT id FROM public.company_data
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    company_data_id IN (
      SELECT id FROM public.company_data
      WHERE user_id = auth.uid()
    )
  );

-- Comentários para documentação
COMMENT ON TABLE public.company_data_evaluations IS 'Armazena avaliações de qualidade dos dados da empresa geradas pelo agente de IA';
COMMENT ON COLUMN public.company_data_evaluations.company_data_id IS 'Referência aos dados da empresa avaliados';
COMMENT ON COLUMN public.company_data_evaluations.nota_final IS 'Nota final da avaliação (0-100)';
COMMENT ON COLUMN public.company_data_evaluations.classificacao IS 'Classificação textual: Insuficiente, Ruim, Aceitável, Bom, Ótimo, Excelente';
COMMENT ON COLUMN public.company_data_evaluations.pode_usar IS 'Indica se os dados podem ser usados para treinamento (nota >= 55)';
COMMENT ON COLUMN public.company_data_evaluations.capacidade_roleplay IS 'Capacidade de suportar roleplay (0-100)';
COMMENT ON COLUMN public.company_data_evaluations.pontos_fortes IS 'Array de strings com pontos fortes identificados';
COMMENT ON COLUMN public.company_data_evaluations.principais_gaps IS 'Array de objetos com gaps identificados (campo, problema, impacto, acao)';
COMMENT ON COLUMN public.company_data_evaluations.campos_criticos_vazios IS 'Array de strings com campos críticos que estão vazios';
