-- Exemplos de fases do funil (OPCIONAL - apenas para referência)
-- Este arquivo é apenas um exemplo. As empresas devem criar suas próprias fases via ConfigHub.

-- Exemplo para B2B:
-- INSERT INTO funnel_stages (company_id, stage_name, description, stage_order)
-- VALUES
--   ('company-uuid-here', 'Prospecção', 'Lead ainda não contatado, em fase de pesquisa inicial', 0),
--   ('company-uuid-here', 'Primeiro Contato', 'Primeira abordagem realizada, aguardando resposta', 1),
--   ('company-uuid-here', 'Qualificação', 'Lead respondeu e está sendo qualificado (budget, autoridade, necessidade, timing)', 2),
--   ('company-uuid-here', 'Apresentação', 'Demo ou apresentação da solução agendada/realizada', 3),
--   ('company-uuid-here', 'Proposta', 'Proposta comercial enviada, em análise pelo cliente', 4),
--   ('company-uuid-here', 'Negociação', 'Cliente interessado, negociando condições, prazos ou valores', 5),
--   ('company-uuid-here', 'Fechamento', 'Contrato em fase final de assinatura', 6);

-- Exemplo para B2C:
-- INSERT INTO funnel_stages (company_id, stage_name, description, stage_order)
-- VALUES
--   ('company-uuid-here', 'Primeiro Contato', 'Cliente demonstrou interesse inicial', 0),
--   ('company-uuid-here', 'Follow-up 1', 'Primeiro acompanhamento após contato inicial', 1),
--   ('company-uuid-here', 'Follow-up 2', 'Segundo acompanhamento, cliente ainda considerando', 2),
--   ('company-uuid-here', 'Pronto para Comprar', 'Cliente decidido, apenas finalizando detalhes', 3),
--   ('company-uuid-here', 'Venda Fechada', 'Compra realizada com sucesso', 4);

-- Exemplo Simplificado:
-- INSERT INTO funnel_stages (company_id, stage_name, description, stage_order)
-- VALUES
--   ('company-uuid-here', 'Lead Frio', 'Contato inicial, ainda sem engajamento', 0),
--   ('company-uuid-here', 'Lead Quente', 'Cliente demonstrou interesse real', 1),
--   ('company-uuid-here', 'Oportunidade', 'Cliente qualificado e com intenção de compra', 2),
--   ('company-uuid-here', 'Negociação Final', 'Ajustes finais antes do fechamento', 3);

-- INSTRUÇÕES:
-- 1. Copie o exemplo que melhor se adequa ao seu negócio
-- 2. Substitua 'company-uuid-here' pelo ID real da sua empresa
-- 3. Ajuste os nomes e descrições conforme necessário
-- 4. Execute o SQL no console do Supabase
--
-- OU simplesmente crie as fases manualmente via ConfigHub (recomendado)!
