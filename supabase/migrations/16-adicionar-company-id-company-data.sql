-- Adicionar company_id à tabela company_data para suporte multi-tenant
ALTER TABLE public.company_data
ADD COLUMN IF NOT EXISTS company_id UUID;

-- Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_company_data_company_id ON public.company_data(company_id);

-- Atualizar RLS para filtrar por company_id
DROP POLICY IF EXISTS "Permitir leitura para todos" ON public.company_data;
DROP POLICY IF EXISTS "Permitir insert/update para autenticados" ON public.company_data;

-- Policy: Usuários veem apenas dados da sua empresa
CREATE POLICY "Usuários veem dados da própria empresa"
  ON public.company_data
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.employees WHERE user_id = auth.uid()
    )
  );

-- Policy: Usuários podem inserir/atualizar dados da sua empresa
CREATE POLICY "Usuários gerenciam dados da própria empresa"
  ON public.company_data
  FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM public.employees WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.employees WHERE user_id = auth.uid()
    )
  );

-- Service role tem acesso total (bypass RLS)
CREATE POLICY "Service role tem acesso total"
  ON public.company_data
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON COLUMN public.company_data.company_id IS 'ID da empresa (multi-tenant support)';
