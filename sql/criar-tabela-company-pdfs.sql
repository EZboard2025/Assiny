-- Tabela para armazenar metadados dos PDFs das empresas
CREATE TABLE IF NOT EXISTS company_pdfs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Índice para busca por empresa
CREATE INDEX IF NOT EXISTS idx_company_pdfs_company_id ON company_pdfs(company_id);

-- Habilitar RLS
ALTER TABLE company_pdfs ENABLE ROW LEVEL SECURITY;

-- Política: Usuários autenticados podem ver PDFs da sua empresa
CREATE POLICY "Users can view company PDFs"
ON company_pdfs FOR SELECT TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM employees WHERE user_id = auth.uid()
  )
);

-- Política: Admins podem inserir PDFs
CREATE POLICY "Admins can insert company PDFs"
ON company_pdfs FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM employees
    WHERE user_id = auth.uid()
    AND company_id = company_pdfs.company_id
    AND role = 'admin'
  )
);

-- Política: Admins podem deletar PDFs
CREATE POLICY "Admins can delete company PDFs"
ON company_pdfs FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM employees
    WHERE user_id = auth.uid()
    AND company_id = company_pdfs.company_id
    AND role = 'admin'
  )
);

-- IMPORTANTE: Criar o bucket no Supabase Storage
-- Vá para Storage > New Bucket > Nome: "company-pdfs" > Public: false
