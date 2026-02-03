import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const maxDuration = 120 // 2 minutos para processar transcrições longas

const SYSTEM_PROMPT = `Você é um sistema de avaliação de vendas de altíssimo rigor técnico, especializado em metodologia SPIN Selling e tratamento de objeções. Sua função é avaliar ligações e reuniões de vendas reais com critérios científicos baseados em pesquisas de Neil Rackham (análise de 35.000 ligações de vendas). Você é ultra rigoroso e chega a ser chato de tão exigente que é nas avaliações.

IMPORTANTE: Esta é uma transcrição de uma reunião REAL (não um roleplay simulado). O vendedor é a pessoa identificada como tal na transcrição, e o cliente/prospect é a outra parte.

OBJETIVOS DA AVALIAÇÃO

1. Fornecer avaliação objetiva, precisa e baseada em evidências
2. Identificar gaps de performance com especificidade cirúrgica
3. Gerar feedback acionável para desenvolvimento real
4. Manter padrões extremamente elevados de excelência
5. Identificar objeções tratadas e como foram resolvidas

PRINCÍPIOS DE AVALIAÇÃO

RIGOR EXTREMO: Notas 7-10 são raras e exigem performance excepcional. Um vendedor competente tira 5-6. Notas 9-10 representam excelência absoluta (top 5% dos vendedores).

BASEADO EM EVIDÊNCIAS: Avalie apenas o que está explícito na transcrição. Se não foi dito ou demonstrado, não pode receber pontuação positiva.

GRANULARIDADE: Cada critério tem escala detalhada de 0-10 com benchmarks específicos.

ESPECIFICIDADE: Todo feedback deve incluir trechos específicos da transcrição e exemplos concretos.

SISTEMA DE AVALIAÇÃO

PARTE 1: AVALIAÇÃO DE OBJEÇÕES (0-10 por objeção)

Para cada objeção identificada na transcrição, avalie usando esta escala:

0-2: Falha Crítica - Ignorou, respondeu defensivamente, ou invalidou a preocupação
3-4: Insuficiente - Reconheceu superficialmente sem validar
5-6: Básico - Validou a objeção adequadamente, fez alguma pergunta
7-8: Competente - Validação genuína, técnica consultiva aplicada, cliente abriu
9-10: Excelente - Antecipou ou transformou objeção em oportunidade

PARTE 2: SPIN SELLING (0-10 por letra)

S - SITUAÇÃO: Perguntas abertas, mapeamento do cenário, adaptabilidade
P - PROBLEMA: Identificação de problemas, consequências, empatia, impacto
I - IMPLICAÇÃO: Consequências de inação, urgência, riscos concretos
N - NECESSIDADE: Clareza da solução, personalização, benefícios, CTA

CÁLCULOS

SPIN_MEDIA = (S + P + I + N) / 4
OBJECTIONS_MEDIA = média dos scores de objeções (ou 5.0 se não houver objeções)
OVERALL_SCORE = ((SPIN_MEDIA * 10) * 0.6) + ((OBJECTIONS_MEDIA * 10) * 0.4)

NÍVEIS DE PERFORMANCE

0-40: poor (Reprovado - requer treinamento fundamental)
41-60: needs_improvement (Insuficiente - desenvolvimento necessário)
61-75: good (Mediano - vendedor comum)
76-85: very_good (Bom - acima da média)
86-94: excellent (Excelente - top 10%)
95-100: legendary (Lendário - top 1%)

FORMATO JSON DE RESPOSTA

Retorne APENAS JSON válido (sem markdown, sem código):

{
  "objections_analysis": [
    {
      "objection_id": "obj-0",
      "objection_type": "string (preço, timing, autoridade, concorrência, confiança, necessidade)",
      "objection_text": "trecho exato da transcrição",
      "score": 0-10,
      "detailed_analysis": "Análise técnica de 3-4 linhas",
      "critical_errors": ["erro 1"] | null,
      "ideal_response": "Como deveria tratar" | null
    }
  ],
  "spin_evaluation": {
    "S": {
      "final_score": 0-10,
      "indicators": {
        "open_questions_score": 0-10,
        "scenario_mapping_score": 0-10,
        "adaptability_score": 0-10
      },
      "technical_feedback": "Feedback sobre Situação",
      "missed_opportunities": []
    },
    "P": {
      "final_score": 0-10,
      "indicators": {
        "problem_identification_score": 0-10,
        "consequences_exploration_score": 0-10,
        "depth_score": 0-10,
        "empathy_score": 0-10,
        "impact_understanding_score": 0-10
      },
      "technical_feedback": "Feedback sobre Problema",
      "missed_opportunities": []
    },
    "I": {
      "final_score": 0-10,
      "indicators": {
        "inaction_consequences_score": 0-10,
        "urgency_amplification_score": 0-10,
        "concrete_risks_score": 0-10,
        "non_aggressive_urgency_score": 0-10
      },
      "technical_feedback": "Feedback sobre Implicação",
      "missed_opportunities": []
    },
    "N": {
      "final_score": 0-10,
      "indicators": {
        "solution_clarity_score": 0-10,
        "personalization_score": 0-10,
        "benefits_clarity_score": 0-10,
        "credibility_score": 0-10,
        "cta_effectiveness_score": 0-10
      },
      "technical_feedback": "Feedback sobre Necessidade",
      "missed_opportunities": []
    }
  },
  "overall_score": 0-100,
  "performance_level": "poor|needs_improvement|good|very_good|excellent|legendary",
  "executive_summary": "2 parágrafos resumindo a performance geral",
  "top_strengths": ["força 1", "força 2"],
  "critical_gaps": ["gap 1", "gap 2"],
  "priority_improvements": [
    {
      "area": "área específica",
      "current_gap": "problema identificado",
      "action_plan": "passos acionáveis",
      "priority": "critical|high|medium"
    }
  ],
  "seller_identification": {
    "name": "Nome do vendedor identificado ou 'Não identificado'",
    "speaking_time_percentage": 0-100
  }
}

DIRETRIZES CRÍTICAS

1. Identifique quem é o vendedor e quem é o cliente baseado no contexto
2. Cite trechos específicos da transcrição como evidência
3. Seja objetivo e técnico
4. Todo feedback deve ter próximo passo concreto`

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
Este card avalia a aderência do vendedor às regras ESPECÍFICAS do playbook que NÃO são cobertas pela avaliação SPIN e de objeções.

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
      "opening": { "score": 0-100, "status": "...", "criteria_evaluated": [...], "dimension_feedback": "..." },
      "closing": { "score": 0-100, "status": "...", "criteria_evaluated": [...], "dimension_feedback": "..." },
      "conduct": { "score": 0-100, "status": "...", "criteria_evaluated": [...], "dimension_feedback": "..." },
      "required_scripts": { "score": 0-100, "status": "...", "criteria_evaluated": [...], "dimension_feedback": "..." },
      "process": { "score": 0-100, "status": "...", "criteria_evaluated": [...], "dimension_feedback": "..." }
    },
    "violations": [...],
    "missed_requirements": [...],
    "exemplary_moments": [...],
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
    "coaching_notes": "orientações específicas para melhorar aderência ao playbook"
  }
}
`

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { transcript, meetingId, sellerName, companyId } = body

    if (!transcript || transcript.length < 100) {
      return NextResponse.json(
        { error: 'Transcrição muito curta para avaliação' },
        { status: 400 }
      )
    }

    console.log(`📊 Avaliando reunião: ${meetingId || 'sem ID'}`)
    console.log(`📝 Transcrição: ${transcript.length} caracteres`)

    // Variáveis para contexto do playbook
    let companyName = 'Não informado'
    let companyDescription = 'Não informado'
    let companyType = 'Não informado'
    let playbookContent: string | null = null

    // Buscar dados da empresa e playbook (se companyId fornecido)
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
        console.log('📖 Playbook encontrado, incluindo na avaliação do meet')
      }
    }

    // Limitar transcrição para não exceder tokens
    const maxChars = 50000
    let processedTranscript = transcript
    if (transcript.length > maxChars) {
      processedTranscript = transcript.substring(0, maxChars) + '\n\n[... transcrição truncada ...]'
    }

    let userPrompt = `Avalie esta reunião de vendas com precisão. Identifique o vendedor${sellerName ? ` (provavelmente ${sellerName})` : ''} e analise sua performance.

TRANSCRIÇÃO DA REUNIÃO:
${processedTranscript}

Analise a performance do vendedor usando metodologia SPIN Selling. Retorne o JSON conforme especificado.`

    // Se houver playbook, adicionar seção de análise
    if (playbookContent) {
      userPrompt += PLAYBOOK_SECTION
        .replace('{company_name}', companyName)
        .replace('{company_description}', companyDescription)
        .replace('{company_type}', companyType)
        .replace('{playbook_content}', playbookContent)
    }

    console.log('🤖 Enviando para OpenAI...')

    const response = await openai.chat.completions.create({
      model: 'gpt-4.1',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 10000
    })

    const content = response.choices[0].message.content

    if (!content) {
      throw new Error('OpenAI retornou resposta vazia')
    }

    console.log('✅ Resposta OpenAI recebida')

    const evaluation = JSON.parse(content)

    // Converter overall_score de 0-100 para 0-10 (compatibilidade)
    if (evaluation.overall_score > 10) {
      evaluation.overall_score = evaluation.overall_score / 10
    }

    // Se não tinha playbook, garantir que playbook_adherence não exista
    if (!playbookContent && evaluation.playbook_adherence) {
      delete evaluation.playbook_adherence
    }

    console.log('✅ Avaliação pronta - Score:', evaluation.overall_score, '| Level:', evaluation.performance_level)
    if (evaluation.playbook_adherence) {
      console.log('📖 Playbook Adherence - Score:', evaluation.playbook_adherence.overall_adherence_score + '%', '| Level:', evaluation.playbook_adherence.adherence_level)
    }

    return NextResponse.json({
      success: true,
      evaluation
    })

  } catch (error: any) {
    console.error('❌ Erro na avaliação:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao avaliar reunião' },
      { status: 500 }
    )
  }
}
