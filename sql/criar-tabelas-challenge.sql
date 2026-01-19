-- =====================================================
-- TABELA PARA O DESAFIO "VENDA UMA CANETA"
-- =====================================================
-- OBS: O chat usa a tabela langchain_memory que já existe

-- Tabela para guardar dados dos leads que fazem o desafio
CREATE TABLE IF NOT EXISTS challenge_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  session_id VARCHAR(255) UNIQUE NOT NULL,
  status VARCHAR(50) DEFAULT 'active', -- active, completed, abandoned
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  interested BOOLEAN DEFAULT FALSE,
  interested_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_challenge_leads_email ON challenge_leads(email);
CREATE INDEX IF NOT EXISTS idx_challenge_leads_session_id ON challenge_leads(session_id);
CREATE INDEX IF NOT EXISTS idx_challenge_leads_status ON challenge_leads(status);
CREATE INDEX IF NOT EXISTS idx_challenge_leads_interested ON challenge_leads(interested);

-- Comentários para documentação
COMMENT ON TABLE challenge_leads IS 'Leads que participaram do desafio "Venda uma Caneta"';
COMMENT ON COLUMN challenge_leads.session_id IS 'ID único da sessão de chat (referencia langchain_memory)';
COMMENT ON COLUMN challenge_leads.interested IS 'Se o lead clicou em "Tenho Interesse" no final';
COMMENT ON COLUMN challenge_leads.interested_at IS 'Quando o lead demonstrou interesse';

-- Trigger para auto-atualizar updated_at
CREATE OR REPLACE FUNCTION update_challenge_leads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_challenge_leads_updated_at ON challenge_leads;
CREATE TRIGGER trigger_challenge_leads_updated_at
  BEFORE UPDATE ON challenge_leads
  FOR EACH ROW
  EXECUTE FUNCTION update_challenge_leads_updated_at();
