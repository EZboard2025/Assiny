-- Atualizar políticas RLS para isolamento multi-tenant

-- ============================================
-- EMPLOYEES
-- ============================================
DROP POLICY IF EXISTS "Admins can manage employees" ON employees;

CREATE POLICY "Usuários veem funcionários de sua empresa"
  ON employees FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM employees WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins gerenciam funcionários de sua empresa"
  ON employees FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM employees WHERE user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM employees
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- ROLEPLAY_SESSIONS
-- ============================================
DROP POLICY IF EXISTS "Users can view their own roleplay sessions" ON roleplay_sessions;
DROP POLICY IF EXISTS "Users can create their own roleplay sessions" ON roleplay_sessions;
DROP POLICY IF EXISTS "Users can update their own roleplay sessions" ON roleplay_sessions;

CREATE POLICY "Usuários veem suas sessões na mesma empresa"
  ON roleplay_sessions FOR SELECT
  USING (
    auth.uid() = user_id
    AND company_id IN (
      SELECT company_id FROM employees WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Usuários criam sessões em sua empresa"
  ON roleplay_sessions FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND company_id IN (
      SELECT company_id FROM employees WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Usuários atualizam suas sessões na mesma empresa"
  ON roleplay_sessions FOR UPDATE
  USING (
    auth.uid() = user_id
    AND company_id IN (
      SELECT company_id FROM employees WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- USER_PERFORMANCE_SUMMARIES
-- ============================================
DROP POLICY IF EXISTS "Users can view their own performance summaries" ON user_performance_summaries;
DROP POLICY IF EXISTS "Service role has full access to performance summaries" ON user_performance_summaries;

CREATE POLICY "Usuários veem sua performance na mesma empresa"
  ON user_performance_summaries FOR SELECT
  USING (
    auth.uid() = user_id
    AND company_id IN (
      SELECT company_id FROM employees WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role tem acesso total"
  ON user_performance_summaries FOR ALL
  USING (true);

-- ============================================
-- CHAT_SESSIONS
-- ============================================
DROP POLICY IF EXISTS "Users can view their own chat sessions" ON chat_sessions;
DROP POLICY IF EXISTS "Users can create chat sessions" ON chat_sessions;
DROP POLICY IF EXISTS "Users can update their own chat sessions" ON chat_sessions;

CREATE POLICY "Usuários veem suas sessões de chat na mesma empresa"
  ON chat_sessions FOR SELECT
  USING (
    auth.uid() = user_id
    AND company_id IN (
      SELECT company_id FROM employees WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Usuários criam sessões de chat em sua empresa"
  ON chat_sessions FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM employees WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Usuários atualizam suas sessões de chat na mesma empresa"
  ON chat_sessions FOR UPDATE
  USING (
    auth.uid() = user_id
    AND company_id IN (
      SELECT company_id FROM employees WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- PDIS
-- ============================================
DROP POLICY IF EXISTS "Users can view their own PDIs" ON pdis;
DROP POLICY IF EXISTS "Users can create their own PDIs" ON pdis;
DROP POLICY IF EXISTS "Users can delete their own PDIs" ON pdis;

CREATE POLICY "Usuários veem seus PDIs na mesma empresa"
  ON pdis FOR SELECT
  USING (
    auth.uid() = user_id
    AND company_id IN (
      SELECT company_id FROM employees WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Usuários criam PDIs em sua empresa"
  ON pdis FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND company_id IN (
      SELECT company_id FROM employees WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Usuários atualizam seus PDIs na mesma empresa"
  ON pdis FOR UPDATE
  USING (
    auth.uid() = user_id
    AND company_id IN (
      SELECT company_id FROM employees WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Usuários deletam seus PDIs na mesma empresa"
  ON pdis FOR DELETE
  USING (
    auth.uid() = user_id
    AND company_id IN (
      SELECT company_id FROM employees WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- PERSONAS
-- ============================================
DROP POLICY IF EXISTS "Anyone can read personas" ON personas;

CREATE POLICY "Usuários veem personas de sua empresa"
  ON personas FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM employees WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins gerenciam personas de sua empresa"
  ON personas FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM employees WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- OBJECTIONS
-- ============================================
DROP POLICY IF EXISTS "Anyone can read objections" ON objections;

CREATE POLICY "Usuários veem objeções de sua empresa"
  ON objections FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM employees WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins gerenciam objeções de sua empresa"
  ON objections FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM employees WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- COMPANY_DATA
-- ============================================
DROP POLICY IF EXISTS "Anyone can read company_data" ON company_data;

CREATE POLICY "Usuários veem dados de sua empresa"
  ON company_data FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM employees WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins gerenciam dados de sua empresa"
  ON company_data FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM employees WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- DOCUMENTS
-- ============================================
DROP POLICY IF EXISTS "Anyone can read documents" ON documents;

CREATE POLICY "Usuários veem documentos de sua empresa"
  ON documents FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM employees WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role tem acesso total a documentos"
  ON documents FOR ALL
  USING (true);

-- ============================================
-- KNOWLEDGE_BASE
-- ============================================
DROP POLICY IF EXISTS "Anyone can read knowledge_base" ON knowledge_base;

CREATE POLICY "Usuários veem knowledge base de sua empresa"
  ON knowledge_base FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM employees WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- COMPANY_TYPE
-- ============================================
CREATE POLICY "Usuários veem tipo de empresa de sua empresa"
  ON company_type FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM employees WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins gerenciam tipo de empresa de sua empresa"
  ON company_type FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM employees WHERE user_id = auth.uid()
    )
  );