-- Inserir sessões de roleplay fictícias para testes do histórico
-- IMPORTANTE: Substituir 'SEU_USER_ID_AQUI' pelo UUID real do usuário logado

-- Sessão 1: Performance Excelente
INSERT INTO roleplay_sessions (
  id,
  user_id,
  thread_id,
  config,
  messages,
  started_at,
  ended_at,
  duration_seconds,
  status,
  evaluation
) VALUES (
  gen_random_uuid(),
  '69b36147-396c-4eca-a05e-52af950e928e',
  'thread_test_001',
  '{"age": 35, "temperament": "Analítico", "segment": "Tecnologia", "objections": ["Preço alto", "Já tenho solução"]}'::jsonb,
  '[
    {"role": "client", "text": "Olá, estou interessado em conhecer sua solução", "timestamp": "2025-10-13T10:00:00Z"},
    {"role": "seller", "text": "Ótimo! Primeiro, me conta um pouco sobre o cenário atual da sua empresa?", "timestamp": "2025-10-13T10:00:30Z"},
    {"role": "client", "text": "Temos cerca de 50 funcionários e usamos ferramentas antigas", "timestamp": "2025-10-13T10:01:00Z"},
    {"role": "seller", "text": "Entendo. E quais problemas vocês enfrentam com essas ferramentas antigas?", "timestamp": "2025-10-13T10:01:30Z"},
    {"role": "client", "text": "Perda de produtividade e dificuldade de integração", "timestamp": "2025-10-13T10:02:00Z"}
  ]'::jsonb,
  NOW() - INTERVAL '2 days',
  NOW() - INTERVAL '2 days' + INTERVAL '8 minutes',
  480,
  'completed',
  '{
    "overall_score": 8.5,
    "performance_level": "very_good",
    "executive_summary": "Excelente desempenho! O vendedor demonstrou habilidades sólidas em todas as etapas do SPIN Selling, com perguntas abertas bem formuladas e ótimo mapeamento do cenário. Destaque para a exploração profunda dos problemas e criação de urgência de forma consultiva.",
    "spin_evaluation": {
      "S": {
        "final_score": 8.5,
        "technical_feedback": "Excelente uso de perguntas abertas para mapear o cenário. Investigou estrutura da empresa e ferramentas utilizadas.",
        "indicators": {"open_questions_score": 9, "scenario_mapping_score": 8, "adaptability_score": 8.5}
      },
      "P": {
        "final_score": 8.8,
        "technical_feedback": "Identificou claramente os problemas e explorou as consequências. Demonstrou empatia e criou conexão emocional.",
        "indicators": {"problem_identification_score": 9, "consequences_exploration_score": 8.5, "depth_score": 9, "empathy_score": 8.5, "impact_understanding_score": 9}
      },
      "I": {
        "final_score": 8.2,
        "technical_feedback": "Boa exploração das implicações. Criou senso de urgência baseado em riscos concretos.",
        "indicators": {"inaction_consequences_score": 8, "urgency_amplification_score": 8.5, "concrete_risks_score": 8, "non_aggressive_urgency_score": 8.5}
      },
      "N": {
        "final_score": 8.5,
        "technical_feedback": "Solução bem conectada às necessidades identificadas. Apresentou casos de sucesso e call to action claro.",
        "indicators": {"solution_clarity_score": 9, "personalization_score": 8, "benefits_clarity_score": 8.5, "credibility_score": 8.5, "cta_effectiveness_score": 8.5}
      }
    },
    "top_strengths": [
      "Excelente uso de perguntas abertas para mapear o cenário do cliente",
      "Forte empatia e conexão emocional durante a descoberta de problemas",
      "Apresentação personalizada da solução com casos de sucesso relevantes"
    ],
    "critical_gaps": [],
    "priority_improvements": [
      {
        "area": "Implicação",
        "current_gap": "Pode explorar mais riscos financeiros quantificados",
        "action_plan": "Praticar apresentação de dados concretos sobre perdas financeiras e ROI negativo",
        "priority": "medium"
      }
    ],
    "objections_analysis": []
  }'::jsonb
);

-- Sessão 2: Performance Boa
INSERT INTO roleplay_sessions (
  id,
  user_id,
  thread_id,
  config,
  messages,
  started_at,
  ended_at,
  duration_seconds,
  status,
  evaluation
) VALUES (
  gen_random_uuid(),
  '69b36147-396c-4eca-a05e-52af950e928e',
  'thread_test_002',
  '{"age": 42, "temperament": "Cético", "segment": "Varejo", "objections": ["Não tenho tempo", "Parece complicado"]}'::jsonb,
  '[
    {"role": "client", "text": "Bom dia, vim pela indicação", "timestamp": "2025-10-12T14:00:00Z"},
    {"role": "seller", "text": "Que ótimo! Me conta, como funciona seu processo atual?", "timestamp": "2025-10-12T14:00:30Z"},
    {"role": "client", "text": "É bem manual, anotamos tudo em planilhas", "timestamp": "2025-10-12T14:01:00Z"}
  ]'::jsonb,
  NOW() - INTERVAL '3 days',
  NOW() - INTERVAL '3 days' + INTERVAL '6 minutes',
  360,
  'completed',
  '{
    "overall_score": 7.2,
    "performance_level": "good",
    "executive_summary": "Boa performance geral com pontos de melhoria claros. O vendedor fez um bom trabalho no mapeamento inicial, mas pode aprofundar mais na exploração de problemas e criar maior senso de urgência.",
    "spin_evaluation": {
      "S": {"final_score": 7.5, "technical_feedback": "Bom mapeamento do cenário, mas pode explorar mais detalhes sobre estrutura e processos.", "indicators": {}},
      "P": {"final_score": 7.0, "technical_feedback": "Identificou problemas básicos, mas faltou aprofundamento nas consequências.", "indicators": {}},
      "I": {"final_score": 6.8, "technical_feedback": "Urgência criada de forma superficial. Faltaram dados concretos sobre riscos.", "indicators": {}},
      "N": {"final_score": 7.5, "technical_feedback": "Solução bem apresentada, mas pode personalizar mais com exemplos do setor.", "indicators": {}}
    },
    "top_strengths": ["Boa abertura e rapport inicial", "Apresentação clara da solução"],
    "critical_gaps": ["Exploração superficial de problemas", "Falta de dados concretos sobre urgência"],
    "priority_improvements": [
      {"area": "Problema", "current_gap": "Não aprofundou nas consequências dos problemas", "action_plan": "Fazer mais perguntas sobre impacto operacional e financeiro", "priority": "high"}
    ],
    "objections_analysis": []
  }'::jsonb
);

-- Sessão 3: Precisa Melhorar
INSERT INTO roleplay_sessions (
  id,
  user_id,
  thread_id,
  config,
  messages,
  started_at,
  ended_at,
  duration_seconds,
  status,
  evaluation
) VALUES (
  gen_random_uuid(),
  '69b36147-396c-4eca-a05e-52af950e928e',
  'thread_test_003',
  '{"age": 28, "temperament": "Impulsivo", "segment": "Serviços", "objections": ["Muito caro"]}'::jsonb,
  '[
    {"role": "client", "text": "Oi, quero saber dos preços", "timestamp": "2025-10-11T09:00:00Z"},
    {"role": "seller", "text": "Claro! Temos planos a partir de R$ 500", "timestamp": "2025-10-11T09:00:20Z"},
    {"role": "client", "text": "Nossa, muito caro!", "timestamp": "2025-10-11T09:00:40Z"}
  ]'::jsonb,
  NOW() - INTERVAL '5 days',
  NOW() - INTERVAL '5 days' + INTERVAL '3 minutes',
  180,
  'completed',
  '{
    "overall_score": 4.5,
    "performance_level": "needs_improvement",
    "executive_summary": "Performance abaixo do esperado. O vendedor pulou etapas fundamentais do SPIN Selling, partindo direto para a solução sem mapear cenário, identificar problemas ou criar urgência. Necessário treinamento focado em metodologia consultiva.",
    "spin_evaluation": {
      "S": {"final_score": 3.5, "technical_feedback": "Não mapeou o cenário do cliente. Pulou direto para apresentação de preço.", "indicators": {}},
      "P": {"final_score": 4.0, "technical_feedback": "Não identificou nem explorou problemas do cliente.", "indicators": {}},
      "I": {"final_score": 4.5, "technical_feedback": "Não criou senso de urgência nem explorou consequências da inação.", "indicators": {}},
      "N": {"final_score": 6.0, "technical_feedback": "Apresentou solução, mas sem conexão com necessidades (que não foram mapeadas).", "indicators": {}}
    },
    "top_strengths": ["Resposta rápida"],
    "critical_gaps": [
      "Pulou etapa de mapeamento do cenário (Situação)",
      "Não identificou problemas do cliente",
      "Não criou urgência consultiva",
      "Apresentou preço sem contexto de valor"
    ],
    "priority_improvements": [
      {"area": "Situação", "current_gap": "Não fez perguntas abertas para entender o cliente", "action_plan": "Estudar e praticar perguntas abertas de mapeamento", "priority": "critical"},
      {"area": "Problema", "current_gap": "Pulou direto para solução sem descobrir problemas", "action_plan": "Sempre descobrir dores antes de apresentar solução", "priority": "critical"}
    ],
    "objections_analysis": [
      {"objection_type": "Preço", "objection_text": "Muito caro", "score": 3, "detailed_analysis": "Não tratou a objeção. Deveria ter feito mais perguntas para entender o contexto e apresentar valor antes do preço."}
    ]
  }'::jsonb
);

-- Sessão 4: Em Desenvolvimento (Poor)
INSERT INTO roleplay_sessions (
  id,
  user_id,
  thread_id,
  config,
  messages,
  started_at,
  ended_at,
  duration_seconds,
  status,
  evaluation
) VALUES (
  gen_random_uuid(),
  '69b36147-396c-4eca-a05e-52af950e928e',
  'thread_test_004',
  '{"age": 50, "temperament": "Tradicional", "segment": "Indústria", "objections": ["Mudança é arriscada"]}'::jsonb,
  '[
    {"role": "client", "text": "Não sei se quero mudar nosso sistema", "timestamp": "2025-10-10T11:00:00Z"},
    {"role": "seller", "text": "Mas nosso sistema é muito melhor!", "timestamp": "2025-10-10T11:00:15Z"},
    {"role": "client", "text": "Não estou convencido", "timestamp": "2025-10-10T11:00:30Z"}
  ]'::jsonb,
  NOW() - INTERVAL '6 days',
  NOW() - INTERVAL '6 days' + INTERVAL '2 minutes',
  120,
  'completed',
  '{
    "overall_score": 2.8,
    "performance_level": "poor",
    "executive_summary": "Performance crítica. Abordagem agressiva e não consultiva. Não seguiu nenhuma etapa do SPIN Selling. Necessário treinamento completo em metodologia de vendas consultiva, escuta ativa e tratamento de objeções.",
    "spin_evaluation": {
      "S": {"final_score": 2.0, "technical_feedback": "Não fez perguntas de situação. Assumiu conhecer o cliente.", "indicators": {}},
      "P": {"final_score": 2.5, "technical_feedback": "Não identificou problemas reais do cliente.", "indicators": {}},
      "I": {"final_score": 3.0, "technical_feedback": "Não explorou implicações ou criou urgência.", "indicators": {}},
      "N": {"final_score": 3.5, "technical_feedback": "Pitch agressivo sem personalização ou contexto.", "indicators": {}}
    },
    "top_strengths": [],
    "critical_gaps": [
      "Abordagem agressiva ao invés de consultiva",
      "Não fez perguntas de descoberta",
      "Não demonstrou empatia ou escuta ativa",
      "Tratamento inadequado de objeção"
    ],
    "priority_improvements": [
      {"area": "Metodologia Geral", "current_gap": "Não segue SPIN Selling", "action_plan": "Treinamento completo em vendas consultivas e SPIN", "priority": "critical"},
      {"area": "Soft Skills", "current_gap": "Falta de empatia e escuta ativa", "action_plan": "Desenvolver habilidades de comunicação e rapport", "priority": "critical"}
    ],
    "objections_analysis": [
      {"objection_type": "Mudança/Risco", "objection_text": "Mudança é arriscada", "score": 2, "detailed_analysis": "Resposta defensiva ao invés de explorar a preocupação. Deveria ter feito perguntas para entender o medo e apresentar casos de migração segura."}
    ]
  }'::jsonb
);

-- Sessão 5: Excelente (Lendário)
INSERT INTO roleplay_sessions (
  id,
  user_id,
  thread_id,
  config,
  messages,
  started_at,
  ended_at,
  duration_seconds,
  status,
  evaluation
) VALUES (
  gen_random_uuid(),
  '69b36147-396c-4eca-a05e-52af950e928e',
  'thread_test_005',
  '{"age": 38, "temperament": "Pragmático", "segment": "Saúde", "objections": ["Preciso de aprovação do board", "ROI não está claro"]}'::jsonb,
  '[
    {"role": "client", "text": "Olá, quero entender melhor a solução", "timestamp": "2025-10-09T15:00:00Z"},
    {"role": "seller", "text": "Perfeito! Para eu entender melhor seu contexto, me conta: quantos profissionais vocês têm na equipe e como é o fluxo de trabalho atual?", "timestamp": "2025-10-09T15:00:30Z"},
    {"role": "client", "text": "Somos 80 profissionais. Hoje usamos sistemas diferentes que não conversam entre si", "timestamp": "2025-10-09T15:01:00Z"},
    {"role": "seller", "text": "Entendo. E isso gera quais tipos de problemas no dia a dia?", "timestamp": "2025-10-09T15:01:30Z"},
    {"role": "client", "text": "Retrabalho constante, erros de informação e perda de tempo", "timestamp": "2025-10-09T15:02:00Z"},
    {"role": "seller", "text": "Imagino que isso deva impactar a produtividade da equipe. Vocês conseguem mensurar quanto tempo é perdido com esses problemas?", "timestamp": "2025-10-09T15:02:30Z"},
    {"role": "client", "text": "Estimamos cerca de 2 horas por dia por profissional", "timestamp": "2025-10-09T15:03:00Z"},
    {"role": "seller", "text": "2 horas por dia, por 80 profissionais... isso representa um custo operacional significativo. E se isso continuar pelos próximos meses, qual seria o impacto financeiro e estratégico para a empresa?", "timestamp": "2025-10-09T15:03:30Z"}
  ]'::jsonb,
  NOW() - INTERVAL '7 days',
  NOW() - INTERVAL '7 days' + INTERVAL '12 minutes',
  720,
  'completed',
  '{
    "overall_score": 9.5,
    "performance_level": "legendary",
    "executive_summary": "Performance excepcional! Demonstração magistral do SPIN Selling com todas as etapas executadas com excelência. Perguntas abertas precisas, exploração profunda de problemas, criação de urgência baseada em dados e apresentação de solução perfeitamente conectada às necessidades. Tratamento exemplar de objeções com empatia e dados. Referência de vendas consultivas.",
    "spin_evaluation": {
      "S": {
        "final_score": 9.5,
        "technical_feedback": "Mapeamento excepcional do cenário com perguntas abertas precisas. Explorou estrutura, processos e ferramentas com grande profundidade.",
        "indicators": {"open_questions_score": 10, "scenario_mapping_score": 9.5, "adaptability_score": 9}
      },
      "P": {
        "final_score": 9.8,
        "technical_feedback": "Identificação e exploração magistral dos problemas. Demonstrou empatia profunda e conectou problemas a impactos reais.",
        "indicators": {"problem_identification_score": 10, "consequences_exploration_score": 10, "depth_score": 9.5, "empathy_score": 10, "impact_understanding_score": 9.5}
      },
      "I": {
        "final_score": 9.5,
        "technical_feedback": "Criação de urgência consultiva excepcional baseada em dados concretos. Explorou riscos financeiros e estratégicos de forma não agressiva.",
        "indicators": {"inaction_consequences_score": 9.5, "urgency_amplification_score": 9.5, "concrete_risks_score": 10, "non_aggressive_urgency_score": 9.5}
      },
      "N": {
        "final_score": 9.2,
        "technical_feedback": "Solução perfeitamente conectada às necessidades. Apresentou casos de sucesso relevantes e ROI claro. Call to action estruturado.",
        "indicators": {"solution_clarity_score": 9.5, "personalization_score": 9, "benefits_clarity_score": 9, "credibility_score": 9.5, "cta_effectiveness_score": 9}
      }
    },
    "top_strengths": [
      "Mapeamento excepcional do cenário com perguntas abertas de alta qualidade",
      "Exploração profunda e empática dos problemas com foco em impactos reais",
      "Criação de urgência consultiva baseada em dados concretos e quantificáveis",
      "Apresentação personalizada com casos de sucesso e ROI claro",
      "Tratamento exemplar de objeções com empatia e validação"
    ],
    "critical_gaps": [],
    "priority_improvements": [
      {"area": "Excelência", "current_gap": "Já em nível de excelência", "action_plan": "Manter prática constante e compartilhar conhecimento com equipe", "priority": "low"}
    ],
    "objections_analysis": [
      {"objection_type": "Aprovação", "objection_text": "Preciso de aprovação do board", "score": 9, "detailed_analysis": "Tratamento exemplar. Validou a preocupação, ofereceu materiais executivos e propôs apresentação ao board."},
      {"objection_type": "ROI", "objection_text": "ROI não está claro", "score": 9.5, "detailed_analysis": "Apresentou dados concretos, calculou ROI com base nas informações do cliente e ofereceu casos de sucesso similares."}
    ]
  }'::jsonb
);

-- Sessão 6: Sessão Abandonada
INSERT INTO roleplay_sessions (
  id,
  user_id,
  thread_id,
  config,
  messages,
  started_at,
  ended_at,
  duration_seconds,
  status,
  evaluation
) VALUES (
  gen_random_uuid(),
  '69b36147-396c-4eca-a05e-52af950e928e',
  'thread_test_006',
  '{"age": 45, "temperament": "Ocupado", "segment": "Educação", "objections": []}'::jsonb,
  '[
    {"role": "client", "text": "Olá", "timestamp": "2025-10-08T10:00:00Z"},
    {"role": "seller", "text": "Bom dia! Como posso ajudar?", "timestamp": "2025-10-08T10:00:15Z"}
  ]'::jsonb,
  NOW() - INTERVAL '8 days',
  NOW() - INTERVAL '8 days' + INTERVAL '1 minute',
  60,
  'abandoned',
  NULL
);

-- Sessão 7: Em Andamento
INSERT INTO roleplay_sessions (
  id,
  user_id,
  thread_id,
  config,
  messages,
  started_at,
  ended_at,
  duration_seconds,
  status,
  evaluation
) VALUES (
  gen_random_uuid(),
  '69b36147-396c-4eca-a05e-52af950e928e',
  'thread_test_007',
  '{"age": 32, "temperament": "Curioso", "segment": "Tecnologia", "objections": ["Já uso concorrente"]}'::jsonb,
  '[
    {"role": "client", "text": "Quero conhecer sua plataforma", "timestamp": "2025-10-14T16:00:00Z"},
    {"role": "seller", "text": "Excelente! Me conta, qual sua posição na empresa e quais são suas responsabilidades?", "timestamp": "2025-10-14T16:00:30Z"}
  ]'::jsonb,
  NOW() - INTERVAL '5 hours',
  NULL,
  NULL,
  'in_progress',
  NULL
);

-- INSTRUÇÕES:
-- Execute este script no SQL Editor do Supabase
-- As 7 sessões de teste aparecerão no histórico com diferentes níveis de performance:
--   - Legendary (9.5), Very Good (8.5), Good (7.2)
--   - Needs Improvement (4.5), Poor (2.8)
--   - Abandoned, In Progress
