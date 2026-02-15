-- =====================================================
-- WhatsApp Autopilot Tables
-- Run in Supabase SQL Editor
-- =====================================================

-- 1. Autopilot Configuration (per-user)
CREATE TABLE IF NOT EXISTS autopilot_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT false,
  custom_instructions TEXT DEFAULT '',
  settings JSONB DEFAULT '{
    "response_delay_min": 15,
    "response_delay_max": 60,
    "max_responses_per_contact_per_day": 5,
    "working_hours_only": true,
    "working_hours_start": "08:00",
    "working_hours_end": "18:00",
    "tone": "consultivo"
  }'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

ALTER TABLE autopilot_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_autopilot_config" ON autopilot_config
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "service_role_all_autopilot_config" ON autopilot_config
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 2. Autopilot Monitored Contacts
CREATE TABLE IF NOT EXISTS autopilot_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contact_phone TEXT NOT NULL,
  contact_name TEXT,
  enabled BOOLEAN DEFAULT true,
  needs_human BOOLEAN DEFAULT false,
  needs_human_reason TEXT,
  needs_human_at TIMESTAMPTZ,
  auto_responses_today INTEGER DEFAULT 0,
  last_auto_response_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, contact_phone)
);

ALTER TABLE autopilot_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_autopilot_contacts" ON autopilot_contacts
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "service_role_all_autopilot_contacts" ON autopilot_contacts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_autopilot_contacts_user ON autopilot_contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_autopilot_contacts_lookup ON autopilot_contacts(user_id, contact_phone);
CREATE INDEX IF NOT EXISTS idx_autopilot_contacts_needs_human ON autopilot_contacts(user_id, needs_human) WHERE needs_human = true;

-- 3. Autopilot Activity Log
CREATE TABLE IF NOT EXISTS autopilot_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contact_phone TEXT NOT NULL,
  contact_name TEXT,
  incoming_message TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('responded', 'flagged_human', 'skipped_limit', 'skipped_hours', 'skipped_error', 'skipped_credits')),
  ai_response TEXT,
  ai_reasoning TEXT,
  credits_used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE autopilot_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_autopilot_log" ON autopilot_log
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "service_role_all_autopilot_log" ON autopilot_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_autopilot_log_user ON autopilot_log(user_id, created_at DESC);

-- 4. Column additions to existing tables
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS is_autopilot BOOLEAN DEFAULT false;
ALTER TABLE whatsapp_conversations ADD COLUMN IF NOT EXISTS autopilot_needs_human BOOLEAN DEFAULT false;

-- 5. Objective reached columns (run if upgrading)
ALTER TABLE autopilot_contacts ADD COLUMN IF NOT EXISTS objective_reached BOOLEAN DEFAULT false;
ALTER TABLE autopilot_contacts ADD COLUMN IF NOT EXISTS objective_reached_reason TEXT;
ALTER TABLE autopilot_contacts ADD COLUMN IF NOT EXISTS objective_reached_at TIMESTAMPTZ;

-- 6. Update log action constraint to include objective_reached
ALTER TABLE autopilot_log DROP CONSTRAINT IF EXISTS autopilot_log_action_check;
ALTER TABLE autopilot_log ADD CONSTRAINT autopilot_log_action_check
  CHECK (action IN ('responded', 'flagged_human', 'skipped_limit', 'skipped_hours', 'skipped_error', 'skipped_credits', 'objective_reached', 'complemented'));
