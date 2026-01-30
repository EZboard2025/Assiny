-- Tabela para armazenar configurações do sistema
-- Usada para rastrear informações como última geração de desafios, etc.

CREATE TABLE IF NOT EXISTS system_settings (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index para busca rápida
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(key);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_system_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_system_settings_updated_at ON system_settings;
CREATE TRIGGER trigger_system_settings_updated_at
  BEFORE UPDATE ON system_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_system_settings_updated_at();

-- RLS
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Service role tem acesso total
CREATE POLICY "Service role has full access to system_settings"
ON system_settings
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Comentário
COMMENT ON TABLE system_settings IS 'Configurações e metadados do sistema (última geração de desafios, etc.)';
