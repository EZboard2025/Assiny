-- Script para RECRIAR a tabela pdis com a estrutura correta
-- Execute este script no Supabase SQL Editor

-- 1. Deletar a tabela antiga (CASCADE remove todas as dependências)
DROP TABLE IF EXISTS pdis CASCADE;

-- 2. Criar a tabela pdis com a estrutura completa
CREATE TABLE pdis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Dados do vendedor
  vendedor_nome TEXT NOT NULL,
  vendedor_empresa TEXT NOT NULL DEFAULT 'Assiny',
  total_sessoes INTEGER NOT NULL,

  -- Informações do PDI
  versao TEXT DEFAULT 'pdi.7dias.v1',
  periodo TEXT NOT NULL DEFAULT '7 dias',
  gerado_em DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Diagnóstico
  nota_geral DECIMAL(3,1) NOT NULL,
  resumo TEXT NOT NULL,

  -- Notas SPIN
  nota_situacao DECIMAL(3,1) NOT NULL,
  nota_problema DECIMAL(3,1) NOT NULL,
  nota_implicacao DECIMAL(3,1) NOT NULL,
  nota_necessidade DECIMAL(3,1) NOT NULL,

  -- Meta de 7 dias
  meta_objetivo TEXT NOT NULL,
  meta_nota_atual DECIMAL(3,1) NOT NULL,
  meta_nota_meta DECIMAL(3,1) NOT NULL,
  meta_como_medir TEXT NOT NULL,

  -- Ações (array de objetos JSON)
  -- [{acao: string, resultado_esperado: string}]
  acoes JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Checkpoint
  checkpoint_quando TEXT NOT NULL,
  checkpoint_como_avaliar TEXT NOT NULL,

  -- Próximos passos
  proximos_passos TEXT NOT NULL,

  -- Status do PDI
  status TEXT NOT NULL DEFAULT 'ativo', -- 'ativo', 'concluido', 'cancelado'

  -- PDI completo em JSON (backup do objeto original)
  pdi_json JSONB NOT NULL,

  -- Multi-tenant support
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,

  -- Metadados
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Criar índices para performance
CREATE INDEX idx_pdis_user_id ON pdis(user_id);
CREATE INDEX idx_pdis_status ON pdis(status);
CREATE INDEX idx_pdis_gerado_em ON pdis(gerado_em DESC);
CREATE INDEX idx_pdis_created_at ON pdis(created_at DESC);

-- Índice composto para buscar PDI ativo mais recente de um usuário
CREATE INDEX idx_pdis_user_active ON pdis(user_id, status, created_at DESC);

-- Índice para multi-tenant
CREATE INDEX idx_pdis_company_id ON pdis(company_id);

-- 4. Ativar RLS (Row Level Security)
ALTER TABLE pdis ENABLE ROW LEVEL SECURITY;

-- 5. Criar políticas RLS

-- Policy: Usuários podem ver apenas seus próprios PDIs
CREATE POLICY "Users can view their own PDIs"
  ON pdis
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Usuários podem inserir seus próprios PDIs
CREATE POLICY "Users can insert their own PDIs"
  ON pdis
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: Usuários podem atualizar seus próprios PDIs (ex: marcar como concluído)
CREATE POLICY "Users can update their own PDIs"
  ON pdis
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Service role pode fazer tudo (para o agente AI e APIs)
CREATE POLICY "Service role has full access to PDIs"
  ON pdis
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 6. Criar trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_pdis_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_pdis_updated_at
  BEFORE UPDATE ON pdis
  FOR EACH ROW
  EXECUTE FUNCTION update_pdis_updated_at();

-- 7. Adicionar comentários para documentação
COMMENT ON TABLE pdis IS 'Armazena PDIs (Planos de Desenvolvimento Individual) gerados pelo agente AI';
COMMENT ON COLUMN pdis.periodo IS 'Período do PDI (ex: "7 dias", "14 dias")';
COMMENT ON COLUMN pdis.acoes IS 'Array de ações prioritárias: [{acao: string, resultado_esperado: string}]';
COMMENT ON COLUMN pdis.status IS 'Status do PDI: ativo, concluido, cancelado';
COMMENT ON COLUMN pdis.pdi_json IS 'Backup completo do PDI original em JSON para referência futura';

-- Concluído! A tabela pdis foi recriada com sucesso.
