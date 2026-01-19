-- Adicionar campo "objetivo" às fases do funil
-- Descreve o que precisa acontecer para o lead avançar para a próxima fase

ALTER TABLE funnel_stages
ADD COLUMN IF NOT EXISTS objective TEXT;

-- Comentário para documentação
COMMENT ON COLUMN funnel_stages.objective IS 'Objetivo da fase: o que precisa acontecer para o lead avançar para a próxima fase';

-- Exemplos de objetivos por fase:
-- "Prospecção" → "Conseguir que o lead responda e demonstre interesse inicial"
-- "Qualificação" → "Confirmar budget, autoridade, necessidade e timing (BANT)"
-- "Apresentação" → "Agendar e realizar demo do produto"
-- "Proposta" → "Enviar proposta comercial e obter feedback positivo"
-- "Negociação" → "Alinhar condições comerciais e receber aceite verbal"
-- "Fechamento" → "Assinar contrato e receber primeiro pagamento"
