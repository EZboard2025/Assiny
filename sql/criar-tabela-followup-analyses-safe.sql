-- Script SQL seguro para criar tabela de análises de follow-up
-- Este script verifica se objetos já existem antes de criar

-- Criar tabela para armazenar análises de follow-up
CREATE TABLE IF NOT EXISTS followup_analyses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Contexto da análise
  tipo_venda VARCHAR(10) NOT NULL CHECK (tipo_venda IN ('B2B', 'B2C')),
  canal VARCHAR(50) NOT NULL,
  fase_funil VARCHAR(50) NOT NULL,
  contexto TEXT NOT NULL,

  -- Transcrição
  transcricao_original TEXT NOT NULL, -- Texto completo extraído das imagens
  transcricao_filtrada TEXT NOT NULL, -- Apenas o follow-up identificado

  -- Avaliação detalhada (JSONB para flexibilidade)
  avaliacao JSONB NOT NULL,

  -- Campos principais para consulta rápida
  nota_final DECIMAL(3,2) NOT NULL,
  classificacao VARCHAR(20) NOT NULL,

  -- Metadados
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para melhor performance (IF NOT EXISTS é suportado no PostgreSQL 9.5+)
CREATE INDEX IF NOT EXISTS idx_followup_analyses_user_id ON followup_analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_followup_analyses_created_at ON followup_analyses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_followup_analyses_nota_final ON followup_analyses(nota_final DESC);
CREATE INDEX IF NOT EXISTS idx_followup_analyses_classificacao ON followup_analyses(classificacao);

-- RLS (Row Level Security) para segurança
ALTER TABLE followup_analyses ENABLE ROW LEVEL SECURITY;

-- Remover políticas existentes se houver
DROP POLICY IF EXISTS "Users can only see their own followup analyses" ON followup_analyses;
DROP POLICY IF EXISTS "Service role has full access to followup analyses" ON followup_analyses;

-- Criar políticas
CREATE POLICY "Users can only see their own followup analyses"
ON followup_analyses
FOR ALL
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Service role has full access to followup analyses"
ON followup_analyses
FOR ALL
TO service_role
USING (true);

-- Verificar se a função já existe antes de criar
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
        CREATE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $func$
        BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
        END;
        $func$ LANGUAGE plpgsql;
    END IF;
END $$;

-- Remover trigger existente se houver
DROP TRIGGER IF EXISTS update_followup_analyses_updated_at ON followup_analyses;

-- Criar trigger
CREATE TRIGGER update_followup_analyses_updated_at
BEFORE UPDATE ON followup_analyses
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Comentários para documentação
COMMENT ON TABLE followup_analyses IS 'Armazena análises de follow-up de vendas realizadas pelos usuários';
COMMENT ON COLUMN followup_analyses.transcricao_original IS 'Texto completo extraído das imagens do WhatsApp';
COMMENT ON COLUMN followup_analyses.transcricao_filtrada IS 'Apenas a parte identificada como follow-up';
COMMENT ON COLUMN followup_analyses.avaliacao IS 'JSON completo com notas detalhadas, pontos positivos/negativos, versão reescrita, etc';
COMMENT ON COLUMN followup_analyses.nota_final IS 'Nota final calculada (0-10)';
COMMENT ON COLUMN followup_analyses.classificacao IS 'Classificação: pessimo, ruim, medio, bom, excelente';