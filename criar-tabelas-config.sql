-- Tabela para funcionários
CREATE TABLE IF NOT EXISTS public.employees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Tabela para segmentação de clientes
CREATE TABLE IF NOT EXISTS public.customer_segments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Tabela para tipo de empresa
CREATE TABLE IF NOT EXISTS public.company_type (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('B2B', 'B2C')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Tabela para objeções
CREATE TABLE IF NOT EXISTS public.objections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_type ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.objections ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso (permitir leitura e escrita para usuários autenticados)
CREATE POLICY "Permitir leitura de funcionários para usuários autenticados"
  ON public.employees FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Permitir inserção de funcionários para usuários autenticados"
  ON public.employees FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Permitir atualização de funcionários para usuários autenticados"
  ON public.employees FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Permitir exclusão de funcionários para usuários autenticados"
  ON public.employees FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Permitir leitura de segmentos para usuários autenticados"
  ON public.customer_segments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Permitir inserção de segmentos para usuários autenticados"
  ON public.customer_segments FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Permitir atualização de segmentos para usuários autenticados"
  ON public.customer_segments FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Permitir exclusão de segmentos para usuários autenticados"
  ON public.customer_segments FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Permitir leitura de tipo de empresa para usuários autenticados"
  ON public.company_type FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Permitir inserção de tipo de empresa para usuários autenticados"
  ON public.company_type FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Permitir atualização de tipo de empresa para usuários autenticados"
  ON public.company_type FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Permitir exclusão de tipo de empresa para usuários autenticados"
  ON public.company_type FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Permitir leitura de objeções para usuários autenticados"
  ON public.objections FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Permitir inserção de objeções para usuários autenticados"
  ON public.objections FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Permitir atualização de objeções para usuários autenticados"
  ON public.objections FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Permitir exclusão de objeções para usuários autenticados"
  ON public.objections FOR DELETE
  TO authenticated
  USING (true);
