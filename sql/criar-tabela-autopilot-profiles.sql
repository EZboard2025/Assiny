-- =============================================
-- Autopilot Profiles: Instruções separadas por tipo de lead
-- =============================================

-- 1. Nova tabela: autopilot_profiles
CREATE TABLE IF NOT EXISTS autopilot_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#00a884',
  custom_instructions TEXT DEFAULT '',
  ai_setup_answers JSONB,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

ALTER TABLE autopilot_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_profiles" ON autopilot_profiles
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "service_role_all_profiles" ON autopilot_profiles
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_autopilot_profiles_user ON autopilot_profiles(user_id);

-- 2. Adicionar profile_id em autopilot_contacts
ALTER TABLE autopilot_contacts ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES autopilot_profiles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_autopilot_contacts_profile ON autopilot_contacts(profile_id);

-- 3. Adicionar profile_id em autopilot_log para tracking
ALTER TABLE autopilot_log ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES autopilot_profiles(id) ON DELETE SET NULL;

-- 4. Migrar instruções existentes para "Perfil Principal"
INSERT INTO autopilot_profiles (user_id, company_id, name, custom_instructions, sort_order)
SELECT DISTINCT
  ac.user_id,
  ac.company_id,
  'Perfil Principal',
  ac.custom_instructions,
  0
FROM autopilot_config ac
WHERE ac.custom_instructions IS NOT NULL
  AND ac.custom_instructions != ''
  AND NOT EXISTS (
    SELECT 1 FROM autopilot_profiles ap WHERE ap.user_id = ac.user_id
  );

-- 5. Atribuir contatos existentes ao perfil migrado
UPDATE autopilot_contacts c
SET profile_id = p.id
FROM autopilot_profiles p
WHERE c.user_id = p.user_id
  AND p.name = 'Perfil Principal'
  AND c.profile_id IS NULL;
