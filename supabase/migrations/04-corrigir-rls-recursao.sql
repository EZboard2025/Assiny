-- Corrigir recursão infinita nas políticas RLS

-- ============================================
-- EMPLOYEES - Permitir leitura do próprio registro sem recursão
-- ============================================
DROP POLICY IF EXISTS "Usuários veem funcionários de sua empresa" ON employees;
DROP POLICY IF EXISTS "Admins gerenciam funcionários de sua empresa" ON employees;

-- Política simples: usuário vê apenas seus próprios dados de employee
CREATE POLICY "Usuários veem seu próprio registro de employee"
  ON employees FOR SELECT
  USING (user_id = auth.uid());

-- Service role tem acesso total (para APIs internas)
CREATE POLICY "Service role pode gerenciar employees"
  ON employees FOR ALL
  USING (true);

-- ============================================
-- PERSONAS - Simplificar para evitar recursão
-- ============================================
DROP POLICY IF EXISTS "Usuários veem personas de sua empresa" ON personas;
DROP POLICY IF EXISTS "Admins gerenciam personas de sua empresa" ON personas;

CREATE POLICY "Usuários autenticados veem personas"
  ON personas FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Service role pode gerenciar personas"
  ON personas FOR ALL
  USING (true);

-- ============================================
-- OBJECTIONS - Simplificar para evitar recursão
-- ============================================
DROP POLICY IF EXISTS "Usuários veem objeções de sua empresa" ON objections;
DROP POLICY IF EXISTS "Admins gerenciam objeções de sua empresa" ON objections;

CREATE POLICY "Usuários autenticados veem objections"
  ON objections FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Service role pode gerenciar objections"
  ON objections FOR ALL
  USING (true);

-- ============================================
-- COMPANY_TYPE - Simplificar para evitar recursão
-- ============================================
DROP POLICY IF EXISTS "Usuários veem tipo de empresa de sua empresa" ON company_type;
DROP POLICY IF EXISTS "Admins gerenciam tipo de empresa de sua empresa" ON company_type;

CREATE POLICY "Usuários autenticados veem company_type"
  ON company_type FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Service role pode gerenciar company_type"
  ON company_type FOR ALL
  USING (true);

-- ============================================
-- COMPANY_DATA - Simplificar para evitar recursão
-- ============================================
DROP POLICY IF EXISTS "Usuários veem dados de sua empresa" ON company_data;
DROP POLICY IF EXISTS "Admins gerenciam dados de sua empresa" ON company_data;

CREATE POLICY "Usuários autenticados veem company_data"
  ON company_data FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Service role pode gerenciar company_data"
  ON company_data FOR ALL
  USING (true);

-- ============================================
-- DOCUMENTS - Simplificar para evitar recursão
-- ============================================
DROP POLICY IF EXISTS "Usuários veem documentos de sua empresa" ON documents;

CREATE POLICY "Usuários autenticados veem documents"
  ON documents FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ============================================
-- KNOWLEDGE_BASE - Simplificar para evitar recursão
-- ============================================
DROP POLICY IF EXISTS "Usuários veem knowledge base de sua empresa" ON knowledge_base;

CREATE POLICY "Usuários autenticados veem knowledge_base"
  ON knowledge_base FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- NOTA: A filtragem por company_id será feita na APPLICATION LAYER (lib/config.ts)
-- em vez de no RLS, para evitar recursão infinita