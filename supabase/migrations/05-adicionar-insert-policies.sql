-- Adicionar políticas de INSERT/UPDATE/DELETE que faltaram

-- PERSONAS
CREATE POLICY "Service role pode inserir personas"
  ON personas FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role pode atualizar personas"
  ON personas FOR UPDATE
  USING (true);

CREATE POLICY "Service role pode deletar personas"
  ON personas FOR DELETE
  USING (true);

-- OBJECTIONS
CREATE POLICY "Service role pode inserir objections"
  ON objections FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role pode atualizar objections"
  ON objections FOR UPDATE
  USING (true);

CREATE POLICY "Service role pode deletar objections"
  ON objections FOR DELETE
  USING (true);

-- COMPANY_TYPE
CREATE POLICY "Service role pode inserir company_type"
  ON company_type FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role pode atualizar company_type"
  ON company_type FOR UPDATE
  USING (true);

CREATE POLICY "Service role pode deletar company_type"
  ON company_type FOR DELETE
  USING (true);

-- COMPANY_DATA
CREATE POLICY "Service role pode inserir company_data"
  ON company_data FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role pode atualizar company_data"
  ON company_data FOR UPDATE
  USING (true);

CREATE POLICY "Service role pode deletar company_data"
  ON company_data FOR DELETE
  USING (true);