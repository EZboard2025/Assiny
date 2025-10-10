-- Tabela para funcionários
CREATE TABLE IF NOT EXISTS public.employees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

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
