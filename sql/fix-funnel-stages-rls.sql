-- Adicionar policies para INSERT, UPDATE e DELETE em funnel_stages
-- Permite que usuários autenticados gerenciem fases da sua própria empresa

-- Policy: Usuários podem inserir fases na sua empresa
CREATE POLICY "Users can insert funnel stages for their company"
  ON funnel_stages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id
      FROM employees
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Usuários podem atualizar fases da sua empresa
CREATE POLICY "Users can update funnel stages from their company"
  ON funnel_stages
  FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id
      FROM employees
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id
      FROM employees
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Usuários podem deletar fases da sua empresa
CREATE POLICY "Users can delete funnel stages from their company"
  ON funnel_stages
  FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id
      FROM employees
      WHERE user_id = auth.uid()
    )
  );
