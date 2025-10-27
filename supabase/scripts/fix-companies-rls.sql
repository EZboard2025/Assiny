-- Aplicar política RLS para permitir leitura pública da tabela companies
-- Execute este SQL no Supabase Dashboard → SQL Editor

-- Remover política antiga se existir
DROP POLICY IF EXISTS "Qualquer um pode ver empresas" ON public.companies;

-- Criar nova política permitindo SELECT público
CREATE POLICY "Qualquer um pode ver empresas"
  ON public.companies
  FOR SELECT
  USING (true);

-- Verificar se funcionou
SELECT * FROM public.companies;
