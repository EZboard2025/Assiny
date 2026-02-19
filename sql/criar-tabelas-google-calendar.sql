-- ============================================
-- Google Calendar Integration Tables
-- ============================================

-- 1. Conexões OAuth do Google Calendar (uma por usuário)
CREATE TABLE IF NOT EXISTS google_calendar_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  google_email TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  calendar_id TEXT DEFAULT 'primary',
  auto_record_enabled BOOLEAN DEFAULT true,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'disconnected', 'expired')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_gcc_user_id ON google_calendar_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_gcc_status ON google_calendar_connections(status);

-- RLS: usuário vê e gerencia só a sua conexão
ALTER TABLE google_calendar_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own calendar connection"
  ON google_calendar_connections FOR ALL TO authenticated
  USING (auth.uid() = user_id);

-- Service role full access (para cron jobs e APIs internas)
CREATE POLICY "Service role full access on gcc"
  ON google_calendar_connections FOR ALL TO service_role
  USING (true);

-- 2. Bots agendados para reuniões do calendário
CREATE TABLE IF NOT EXISTS calendar_scheduled_bots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  calendar_connection_id UUID REFERENCES google_calendar_connections(id) ON DELETE CASCADE,
  google_event_id TEXT NOT NULL,
  event_title TEXT,
  event_start TIMESTAMPTZ NOT NULL,
  event_end TIMESTAMPTZ,
  meet_link TEXT NOT NULL,
  attendees JSONB DEFAULT '[]',
  bot_enabled BOOLEAN DEFAULT true,
  bot_id TEXT,
  bot_status TEXT DEFAULT 'pending' CHECK (bot_status IN ('pending', 'scheduled', 'joining', 'recording', 'completed', 'skipped', 'error')),
  evaluation_id UUID REFERENCES meet_evaluations(id),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, google_event_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_csb_user_id ON calendar_scheduled_bots(user_id);
CREATE INDEX IF NOT EXISTS idx_csb_bot_id ON calendar_scheduled_bots(bot_id);
CREATE INDEX IF NOT EXISTS idx_csb_event_start ON calendar_scheduled_bots(event_start);
CREATE INDEX IF NOT EXISTS idx_csb_bot_status ON calendar_scheduled_bots(bot_status);
CREATE INDEX IF NOT EXISTS idx_csb_enabled_pending ON calendar_scheduled_bots(bot_enabled, bot_status) WHERE bot_enabled = true AND bot_status = 'pending';

-- RLS
ALTER TABLE calendar_scheduled_bots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own scheduled bots"
  ON calendar_scheduled_bots FOR ALL TO authenticated
  USING (auth.uid() = user_id);

-- Service role full access (para cron jobs, webhooks)
CREATE POLICY "Service role full access on csb"
  ON calendar_scheduled_bots FOR ALL TO service_role
  USING (true);
