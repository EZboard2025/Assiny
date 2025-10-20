-- Adicionar coluna user_id na tabela company_data
ALTER TABLE public.company_data
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Index para buscar por user_id
CREATE INDEX IF NOT EXISTS company_data_user_id_idx
  ON public.company_data(user_id);

-- Atualizar políticas RLS para usar user_id
DROP POLICY IF EXISTS "Permitir leitura para todos" ON public.company_data;
DROP POLICY IF EXISTS "Permitir insert/update para autenticados" ON public.company_data;

-- Nova policy: Usuários só veem seus próprios dados
CREATE POLICY "Usuários veem seus próprios dados"
  ON public.company_data
  FOR SELECT
  USING (user_id = auth.uid());

-- Nova policy: Usuários só podem gerenciar seus próprios dados
CREATE POLICY "Usuários gerenciam seus próprios dados"
  ON public.company_data
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Service role tem acesso total (para AI agents)
CREATE POLICY "Service role tem acesso total"
  ON public.company_data
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMENT ON COLUMN public.company_data.user_id IS 'ID do usuário proprietário dos dados';
