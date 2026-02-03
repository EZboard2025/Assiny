import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'
import { PlaybookAdherence } from './evaluateRoleplay'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface SimpleChallengeEvaluation {
  overall_score: number
  performance_level: 'poor' | 'needs_improvement' | 'good' | 'very_good' | 'excellent' | 'legendary'
  executive_summary: string
  criteria_scores: {
    need_identification: number
    value_creation: number
    objection_handling: number
    closing_skills: number
    communication: number
  }
  top_strengths: string[]
  areas_to_improve: string[]
  key_moments: Array<{
    moment: string
    analysis: string
    suggestion: string
  }>
  coaching_feedback: string
  playbook_adherence?: PlaybookAdherence
}

export interface SimpleChallengeParams {
  transcription: string
  companyId?: string | null
}

const SYSTEM_PROMPT = `Você é um avaliador especializado em técnicas de vendas, focado em avaliar simulações do tipo "Venda uma Caneta" ou desafios similares de vendas rápidas.

Sua função é avaliar a performance do vendedor com base em critérios práticos de vendas.

CRITÉRIOS DE AVALIAÇÃO (0-10 cada):

1. IDENTIFICAÇÃO DE NECESSIDADES (need_identification)
0-3: Não tentou descobrir necessidades do cliente
4-6: Fez perguntas básicas mas não aprofundou
7-8: Identificou necessidades específicas do cliente
9-10: Descobriu necessidades que o próprio cliente não sabia que tinha

2. CRIAÇÃO DE VALOR (value_creation)
0-3: Focou apenas em características do produto
4-6: Mencionou alguns benefícios genéricos
7-8: Conectou benefícios às necessidades do cliente
9-10: Criou valor único e personalizado

3. TRATAMENTO DE OBJEÇÕES (objection_handling)
0-3: Ignorou ou reagiu mal às objeções
4-6: Respondeu de forma genérica
7-8: Tratou objeções com técnica adequada
9-10: Transformou objeções em oportunidades

4. HABILIDADE DE FECHAMENTO (closing_skills)
0-3: Não tentou fechar ou foi agressivo demais
4-6: Tentou fechar sem preparação adequada
7-8: Usou técnica de fechamento apropriada
9-10: Fechamento natural e confiante

5. COMUNICAÇÃO (communication)
0-3: Comunicação confusa ou inadequada
4-6: Comunicação básica mas funcional
7-8: Clara, persuasiva e adaptada ao cliente
9-10: Excepcional, criou conexão genuína

CÁLCULO DO SCORE GERAL:
OVERALL_SCORE = (need_identification + value_creation + objection_handling + closing_skills + communication) / 5

Arredonde para uma casa decimal.

NÍVEIS DE PERFORMANCE:
0-4: poor
4.1-5.9: needs_improvement
6-7: good
7.1-8: very_good
8.1-9: excellent
9.1-10: legendary

FORMATO DE RESPOSTA (JSON):
{
  "overall_score": número de 0-10,
  "performance_level": "poor|needs_improvement|good|very_good|excellent|legendary",
  "executive_summary": "2-3 parágrafos resumindo a performance",
  "criteria_scores": {
    "need_identification": 0-10,
    "value_creation": 0-10,
    "objection_handling": 0-10,
    "closing_skills": 0-10,
    "communication": 0-10
  },
  "top_strengths": ["força 1", "força 2"],
  "areas_to_improve": ["área 1", "área 2"],
  "key_moments": [
    {
      "moment": "descrição do momento",
      "analysis": "o que aconteceu",
      "suggestion": "o que poderia ser melhor"
    }
  ],
  "coaching_feedback": "Feedback motivacional e construtivo de 2-3 frases"
}

REGRAS IMPORTANTES PARA SUGESTÕES:
- Esta é uma SIMULAÇÃO de vendas, NÃO uma ligação real
- NÃO sugira "praticar silêncio", "fazer pausas", "deixar o cliente processar" ou similar - isso não se aplica a simulações
- NÃO sugira técnicas que dependem de tempo real ou interação presencial
- Foque em sugestões sobre: estrutura do pitch, argumentação, perguntas, tratamento de objeções, linguagem usada
- Todas as sugestões devem ser aplicáveis em um contexto de simulação/roleplay de texto

Seja objetivo e forneça feedback acionável.`

const USER_PROMPT_TEMPLATE = `Avalie a seguinte transcrição de um desafio de vendas:

TRANSCRIÇÃO:
{transcription}

Analise a performance do vendedor e retorne a avaliação no formato JSON especificado.`

const PLAYBOOK_SECTION = `

=== CARD: PLAYBOOK ADHERENCE ===

CONTEXTO DA EMPRESA:
- Nome da empresa: {company_name}
- Descrição da empresa: {company_description}
- Tipo da empresa: {company_type}

A empresa possui o seguinte PLAYBOOK DE VENDAS:

--- INÍCIO DO PLAYBOOK ---
{playbook_content}
--- FIM DO PLAYBOOK ---

OBJETIVO DO CARD PLAYBOOK ADHERENCE:
Este card avalia a aderência do vendedor às regras ESPECÍFICAS do playbook que NÃO são cobertas pelos critérios de avaliação acima.

O que este card AVALIA - 5 DIMENSÕES:

1. ABERTURA (opening)
- Apresentação conforme script do playbook
- Uso de gancho específico
- Pedido de tempo/permissão
- Primeiros 30-60 segundos

2. FECHAMENTO (closing)
- Próximo passo concreto definido
- Data/hora específica agendada
- Recapitulação de acordos
- Compromisso claro do prospect

3. CONDUTA (conduct)
- Regras de comportamento seguidas
- Proibições respeitadas
- Tom e linguagem adequados
- Escuta ativa demonstrada

4. SCRIPTS OBRIGATÓRIOS (required_scripts)
- Frases específicas que a empresa exige
- Perguntas padronizadas utilizadas
- Respostas-padrão aplicadas corretamente

5. PROCESSO (process)
- Etapas obrigatórias do funil seguidas
- Qualificação conforme critérios da empresa
- Documentação/registro mencionado
- Handoff adequado (se aplicável)

INSTRUÇÕES PARA AVALIAÇÃO:

PASSO 1: Extrair critérios do playbook
Extraia APENAS critérios que se encaixam nas 5 dimensões acima.

PASSO 2: Classificar cada critério
type:
- required: linguagem imperativa ("deve", "sempre", "obrigatório")
- recommended: linguagem sugestiva ("recomendado", "ideal", "prefira")
- prohibited: linguagem negativa ("nunca", "não", "evitar", "proibido")

weight:
- critical: marcado como crítico, essencial, ou pode causar perda de deal
- high: enfatizado, tem seção dedicada
- medium: mencionado como boa prática
- low: sugestão, nice-to-have

PASSO 3: Avaliar cada critério
result | Quando usar | points_earned
compliant | Executou corretamente | 100
partial | Executou com falhas | 50
missed | Não executou | 0
violated | Fez o oposto (para prohibited) | -50
not_applicable | Contexto não permitiu avaliar | N/A

PASSO 4: Calcular scores
Score por dimensão:
score = (Σ points_earned × weight_multiplier) / (Σ max_points × weight_multiplier) × 100

weight_multiplier: critical=3, high=2, medium=1, low=0.5

Score geral (pesos das dimensões):
- opening: 20%
- closing: 25%
- conduct: 20%
- required_scripts: 20%
- process: 15%

adherence_level:
- exemplary: 90-100%
- compliant: 70-89%
- partial: 50-69%
- non_compliant: 0-49%

REGRAS ESPECIAIS:
1. Se playbook não menciona uma dimensão: marque como not_evaluated e exclua do cálculo
2. Se call foi interrompida: avalie apenas o possível e indique no coaching_notes
3. Violações são sempre reportadas mesmo com score bom
4. Momentos exemplares merecem destaque em exemplary_moments

Inclua no JSON de resposta o campo "playbook_adherence":
{
  "playbook_adherence": {
    "overall_adherence_score": 0-100,
    "adherence_level": "non_compliant|partial|compliant|exemplary",

    "dimensions": {
      "opening": {
        "score": 0-100,
        "status": "not_evaluated|missed|partial|compliant|exemplary",
        "criteria_evaluated": [
          {
            "criterion": "descrição do critério extraído do playbook",
            "type": "required|recommended|prohibited",
            "weight": "critical|high|medium|low",
            "result": "compliant|partial|missed|violated|not_applicable",
            "evidence": "trecho da transcrição ou 'não encontrado'",
            "points_earned": 0-100,
            "notes": "observação adicional se necessário"
          }
        ],
        "dimension_feedback": "1-2 frases sobre performance na abertura"
      },
      "closing": { "score": 0-100, "status": "...", "criteria_evaluated": [...], "dimension_feedback": "..." },
      "conduct": { "score": 0-100, "status": "...", "criteria_evaluated": [...], "dimension_feedback": "..." },
      "required_scripts": { "score": 0-100, "status": "...", "criteria_evaluated": [...], "dimension_feedback": "..." },
      "process": { "score": 0-100, "status": "...", "criteria_evaluated": [...], "dimension_feedback": "..." }
    },

    "violations": [
      {
        "criterion": "regra violada",
        "type": "prohibited",
        "severity": "critical|high|medium|low",
        "evidence": "trecho exato da transcrição",
        "impact": "impacto potencial da violação",
        "recommendation": "como corrigir"
      }
    ],

    "missed_requirements": [
      {
        "criterion": "requisito não cumprido",
        "type": "required",
        "weight": "critical|high|medium|low",
        "expected": "o que deveria ter acontecido",
        "moment": "momento da call onde deveria ter ocorrido",
        "recommendation": "como implementar"
      }
    ],

    "exemplary_moments": [
      {
        "criterion": "critério executado de forma exemplar",
        "evidence": "trecho da transcrição",
        "why_exemplary": "por que foi acima do esperado"
      }
    ],

    "playbook_summary": {
      "total_criteria_extracted": 0,
      "criteria_compliant": 0,
      "criteria_partial": 0,
      "criteria_missed": 0,
      "criteria_violated": 0,
      "criteria_not_applicable": 0,
      "critical_criteria_met": "X de Y",
      "compliance_rate": "XX%"
    },

    "coaching_notes": "1-2 parágrafos com orientações específicas para o vendedor melhorar aderência ao playbook"
  }
}
`

export async function evaluateSimpleChallenge(params: SimpleChallengeParams): Promise<SimpleChallengeEvaluation> {
  const { transcription, companyId } = params

  console.log('🎯 Iniciando avaliação de desafio simples via OpenAI...')

  // Variáveis para contexto do playbook
  let companyName = 'Não informado'
  let companyDescription = 'Não informado'
  let companyType = 'Não informado'
  let playbookContent: string | null = null

  // Buscar dados da empresa e playbook se companyId fornecido
  if (companyId) {
    // Buscar nome da empresa
    const { data: company } = await supabaseAdmin
      .from('companies')
      .select('name')
      .eq('id', companyId)
      .single()

    if (company?.name) {
      companyName = company.name
    }

    // Buscar tipo da empresa (B2B/B2C)
    const { data: typeData } = await supabaseAdmin
      .from('company_type')
      .select('type')
      .eq('company_id', companyId)
      .single()

    if (typeData?.type) {
      companyType = typeData.type
    }

    // Buscar dados da empresa
    const { data: companyData } = await supabaseAdmin
      .from('company_data')
      .select('descricao')
      .eq('company_id', companyId)
      .single()

    if (companyData?.descricao) {
      companyDescription = companyData.descricao
    }

    // Buscar playbook da empresa
    const { data: playbook } = await supabaseAdmin
      .from('sales_playbooks')
      .select('content')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .single()

    if (playbook?.content) {
      playbookContent = playbook.content
      console.log('📖 Playbook encontrado, incluindo na avaliação do desafio')
    }
  }

  // Montar prompt do usuário
  let userPrompt = USER_PROMPT_TEMPLATE.replace('{transcription}', transcription)

  // Se houver playbook, adicionar seção de análise
  if (playbookContent) {
    userPrompt += PLAYBOOK_SECTION
      .replace('{company_name}', companyName)
      .replace('{company_description}', companyDescription)
      .replace('{company_type}', companyType)
      .replace('{playbook_content}', playbookContent)
  }

  const response = await openai.chat.completions.create({
    model: 'gpt-4.1',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.5,
    max_tokens: 6000
  })

  const content = response.choices[0].message.content

  if (!content) {
    throw new Error('OpenAI retornou resposta vazia')
  }

  console.log('✅ Avaliação de desafio simples concluída')

  const evaluation = JSON.parse(content) as SimpleChallengeEvaluation

  // Se não tinha playbook, garantir que playbook_adherence não exista
  if (!playbookContent && evaluation.playbook_adherence) {
    delete evaluation.playbook_adherence
  }

  if (evaluation.playbook_adherence) {
    console.log('📖 Playbook Adherence - Score:', evaluation.playbook_adherence.overall_adherence_score + '%', '| Level:', evaluation.playbook_adherence.adherence_level)
  }

  return evaluation
}
