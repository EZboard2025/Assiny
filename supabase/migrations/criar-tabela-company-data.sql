-- Tabela principal de dados da empresa (fonte da verdade)
CREATE TABLE IF NOT EXISTS public.company_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT,
  descricao TEXT,
  produtos_servicos TEXT,
  funcao_produtos TEXT,
  diferenciais TEXT,
  concorrentes TEXT,
  dados_metricas TEXT,
  erros_comuns TEXT,
  percepcao_desejada TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.company_data ENABLE ROW LEVEL SECURITY;

-- Policy: Todos podem ler
CREATE POLICY "Permitir leitura para todos"
  ON public.company_data
  FOR SELECT
  USING (true);

-- Policy: Apenas autenticados podem inserir/atualizar
CREATE POLICY "Permitir insert/update para autenticados"
  ON public.company_data
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Comentários para documentação
COMMENT ON TABLE public.company_data IS 'Dados estruturados da empresa para treinamento de IA';
COMMENT ON COLUMN public.company_data.nome IS 'Nome da empresa';
COMMENT ON COLUMN public.company_data.descricao IS 'Descrição simples e objetiva do que a empresa faz';
COMMENT ON COLUMN public.company_data.produtos_servicos IS 'Produtos ou serviços principais';
COMMENT ON COLUMN public.company_data.funcao_produtos IS 'Função prática e verificável dos produtos';
COMMENT ON COLUMN public.company_data.diferenciais IS 'Diferenciais reais em relação aos concorrentes';
COMMENT ON COLUMN public.company_data.concorrentes IS 'Concorrentes diretos';
COMMENT ON COLUMN public.company_data.dados_metricas IS 'Dados e números verificáveis';
COMMENT ON COLUMN public.company_data.erros_comuns IS 'Erros que vendedores costumam cometer';
COMMENT ON COLUMN public.company_data.percepcao_desejada IS 'Como a empresa deseja ser percebida';
