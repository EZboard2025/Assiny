-- Tabela de links de convite
CREATE TABLE IF NOT EXISTS invite_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  token VARCHAR(64) NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

-- Índices para invite_links
CREATE INDEX IF NOT EXISTS idx_invite_links_token ON invite_links(token);
CREATE INDEX IF NOT EXISTS idx_invite_links_company ON invite_links(company_id);

-- Tabela de cadastros pendentes
CREATE TABLE IF NOT EXISTS pending_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  invite_link_id UUID NOT NULL REFERENCES invite_links(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,
  processed_by UUID REFERENCES auth.users(id)
);

-- Índices para pending_registrations
CREATE INDEX IF NOT EXISTS idx_pending_registrations_company ON pending_registrations(company_id);
CREATE INDEX IF NOT EXISTS idx_pending_registrations_status ON pending_registrations(status);
CREATE INDEX IF NOT EXISTS idx_pending_registrations_email ON pending_registrations(email);

-- RLS para invite_links
ALTER TABLE invite_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage invite links for their company"
ON invite_links
FOR ALL
TO authenticated
USING (
  company_id IN (
    SELECT e.company_id FROM employees e WHERE e.user_id = auth.uid() AND e.role = 'admin'
  )
);

-- RLS para pending_registrations
ALTER TABLE pending_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage pending registrations for their company"
ON pending_registrations
FOR ALL
TO authenticated
USING (
  company_id IN (
    SELECT e.company_id FROM employees e WHERE e.user_id = auth.uid() AND e.role = 'admin'
  )
);

-- Permitir service role acessar tudo
CREATE POLICY "Service role has full access to invite_links"
ON invite_links
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role has full access to pending_registrations"
ON pending_registrations
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
