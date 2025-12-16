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

-- Índices para melhor performance
CREATE INDEX idx_followup_analyses_user_id ON followup_analyses(user_id);
CREATE INDEX idx_followup_analyses_created_at ON followup_analyses(created_at DESC);
CREATE INDEX idx_followup_analyses_nota_final ON followup_analyses(nota_final DESC);
CREATE INDEX idx_followup_analyses_classificacao ON followup_analyses(classificacao);

-- RLS (Row Level Security) para segurança
ALTER TABLE followup_analyses ENABLE ROW LEVEL SECURITY;

-- Política para usuários verem apenas suas próprias análises
CREATE POLICY "Users can only see their own followup analyses"
ON followup_analyses
FOR ALL
TO authenticated
USING (auth.uid() = user_id);

-- Política para service role ter acesso total (para estatísticas administrativas)
CREATE POLICY "Service role has full access to followup analyses"
ON followup_analyses
FOR ALL
TO service_role
USING (true);

-- Trigger para atualizar updated_at automaticamente
-- A função update_updated_at_column() já existe no banco, então apenas criamos o trigger
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

-- Exemplo da estrutura JSONB esperada em 'avaliacao':
/*
{
  "notas": {
    "valor_agregado": {
      "nota": 8.5,
      "peso": 25,
      "comentario": "..."
    },
    "personalizacao": {
      "nota": 7.0,
      "peso": 20,
      "comentario": "..."
    },
    "tom_consultivo": {
      "nota": 6.5,
      "peso": 15,
      "comentario": "..."
    },
    "objetividade": {
      "nota": 8.0,
      "peso": 10,
      "comentario": "..."
    },
    "cta": {
      "nota": 7.5,
      "peso": 20,
      "comentario": "..."
    },
    "timing": {
      "nota": 6.0,
      "peso": 10,
      "comentario": "..."
    }
  },
  "nota_final": 7.35,
  "classificacao": "bom",
  "pontos_positivos": ["..."],
  "pontos_melhorar": [
    {
      "problema": "...",
      "como_resolver": "..."
    }
  ],
  "versao_reescrita": "...",
  "dica_principal": "..."
}
*/