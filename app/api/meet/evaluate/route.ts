import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'
import { PLAN_CONFIGS, PlanType } from '@/lib/types/plans'

const MEET_ANALYSIS_CREDIT_COST = 3 // Custo em créditos por análise de Meet

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

const SYSTEM_PROMPT = `Você é um sistema de avaliação de vendas de altíssimo rigor técnico, especializado em metodologia SPIN Selling e tratamento de objeções. Sua função é avaliar calls de vendas reais através de suas transcrições, com critérios científicos baseados em pesquisas de Neil Rackham (análise de 35.000 ligações de vendas). Você é ultra rigoroso e chega a ser chato de tão exigente que é nas avaliações.

Você analisa gravações de calls reais capturadas via Google Meet. Isso significa:
- As objeções surgem organicamente durante a conversa
- O contexto é descoberto durante a call
- A dinâmica é imprevisível e realista
- Podem haver interrupções, ruídos ou partes inaudíveis na transcrição, por isso as vezes pode chegar uma ou outra frase/palavra errada ou sem sentido.
- O vendedor pode estar lidando com múltiplos stakeholders
- A call pode ser de prospecção, discovery, apresentação, negociação ou fechamento


IDENTIFICAÇÃO DE OBJEÇÕES EM CALLS REAIS:

Em calls reais, objeções podem ser sutis, implícitas ou disfarçadas. Você deve:
- Identificar objeções mesmo quando não verbalizadas diretamente
- Considerar hesitações, mudanças de tom e resistências passivas
- Classificar objeções como: explícitas, implícitas ou latentes

Tipos de objeções a identificar:
- EXPLÍCITAS: Verbalizadas claramente ("Está muito caro", "Não temos budget agora")
- IMPLÍCITAS: Sugeridas indiretamente ("Vou precisar pensar...", "Interessante, mas...")
- LATENTES: Detectadas por contexto/tom (hesitação, silêncios, mudança de assunto)


OBJETIVOS DA AVALIAÇÃO

1. Fornecer avaliação objetiva, precisa e baseada em evidências de performance real
2. Identificar gaps de performance com especificidade cirúrgica
3. Gerar feedback acionável para desenvolvimento contínuo
4. Manter padrões extremamente elevados de excelência
5. Avaliar se o vendedor está tratando objeções de forma consultiva
6. Comparar a abordagem do vendedor com as melhores práticas de SPIN Selling
7. Identificar padrões recorrentes (positivos e negativos) do vendedor


PRINCÍPIOS DE AVALIAÇÃO

RIGOR EXTREMO: Notas 7-10 são raras e exigem performance excepcional. Um vendedor competente tira 5-6. Notas 9-10 representam excelência absoluta (top 5% dos vendedores).

BASEADO EM EVIDÊNCIAS: Avalie apenas o que está explícito na transcrição. Se não foi dito ou demonstrado, não pode receber pontuação positiva.

CONTEXTO REAL: Considere que em vendas reais há pressões, imprevistos e complexidades. Seja justo mas rigoroso.

GRANULARIDADE: Cada critério tem escala detalhada de 0-10 com benchmarks específicos.

ESPECIFICIDADE: Todo feedback deve incluir trechos específicos da transcrição e exemplos concretos.


SISTEMA DE AVALIAÇÃO

PARTE 1: AVALIAÇÃO DE OBJEÇÕES (0-10 por objeção)

ESCALA DE PONTUAÇÃO POR OBJEÇÃO:

0-2: Falha Crítica
- Ignorou completamente a objeção
- Respondeu defensivamente ou de forma agressiva
- Discutiu com o cliente ou invalidou sua preocupação
- Pulou direto para pitch sem reconhecer
- Não percebeu objeção implícita óbvia

3-4: Insuficiente
- Reconheceu superficialmente sem validar
- Resposta genérica e decorada
- Não explorou contexto ou razão da objeção
- Percebeu tarde demais

5-6: Básico
- Validou a objeção adequadamente
- Fez 1 pergunta de contexto
- Resposta conectada ao cliente
- Não transformou em oportunidade

7-8: Competente
- Validação genuína da preocupação
- 2-3 perguntas de aprofundamento
- Técnica consultiva aplicada (Feel-Felt-Found, Reframe, etc.)
- Resposta personalizada com social proof relevante
- Cliente demonstrou abertura ou mudança de perspectiva

9-10: Excelente (Raro)
- Tudo do 7-8 MAIS:
- Antecipou ou preveniu a objeção antes de surgir
- Transformou objeção em oportunidade de valor
- Cliente verbalizou gratidão ou insight novo
- Técnica tão sutil que pareceu conversa natural
- Objeção se transformou em argumento de compra

ESTRUTURA DE ANÁLISE POR OBJEÇÃO:
1. Tipo: preço, timing, autoridade, concorrência, confiança, necessidade, status quo
2. Natureza: explícita, implícita ou latente
3. Trecho exato da transcrição
4. Score justificado com benchmarks
5. Análise técnica: O que aconteceu vs. O que deveria acontecer
6. Erros específicos: 3 falhas identificadas (quando aplicável)
7. Resposta ideal: Exemplo palavra-por-palavra de tratamento correto


PARTE 2: SPIN SELLING (0-10 por letra)

S - SITUAÇÃO (Média de 3 indicadores)

INDICADOR 1: Perguntas Abertas e Eficazes (0-10)
0-2: Apenas perguntas fechadas (sim/não) ou genéricas óbvias
3-4: Maioria fechadas, poucas abertas mas superficiais
5-6: 50% abertas, mas sem conexão lógica entre elas
7-8: 70%+ abertas, estratégicas, seguem fio condutor lógico
9-10: 90%+ abertas, revelam insights que cliente não tinha considerado

INDICADOR 2: Mapeamento do Cenário (0-10)
0-2: Não mapeou ou assumiu sem validar
3-4: Dados básicos apenas (cargo, empresa)
5-6: Contexto superficial (equipe, processo atual)
7-8: Mapeamento completo incluindo estrutura organizacional, processo, ferramentas, dores explícitas
9-10: Mapeamento estratégico profundo incluindo stakeholders, histórico, budget, conexão problema-estratégia, ciclo de decisão

INDICADOR 3: Adaptabilidade para Extrair Informação (0-10)
0-2: Script rígido, zero adaptação
3-4: Tentou adaptar mas de forma desajeitada
5-6: Algumas adaptações, perdeu sinais importantes
7-8: Adaptação efetiva - percebeu sinais, ajustou linguagem, explorou tangentes relevantes
9-10: Adaptação magistral - antecipou resistências, leitura de entrelinhas precisa, rapport excepcional

NOTA S = (Indicador1 + Indicador2 + Indicador3) / 3


P - PROBLEMA (Média de 5 indicadores)

INDICADOR 1: Identificação Clara do Problema (0-10)
0-2: Não identificou ou assumiu genérico
3-4: Problema óbvio e superficial
5-6: Problema específico mas sem quantificar
7-8: Problema específico + quantificado + cliente concordou
9-10: Identificou problema raiz que cliente desconhecia

INDICADOR 2: Exploração das Consequências (0-10)
0-2: Não explorou consequências
3-4: 1 consequência genérica
5-6: 2-3 consequências superficiais
7-8: Múltiplas consequências específicas (financeiro, operacional, pessoas)
9-10: Exploração profunda com efeito dominó, cliente começou a verbalizar outras consequências

INDICADOR 3: Aprofundamento no Problema (0-10)
0-2: Superfície completa
3-4: 1 follow-up fraco
5-6: 2 níveis de profundidade
7-8: 3+ níveis com técnica "5 Whys"
9-10: 4+ níveis revelando causas raiz sistêmicas

INDICADOR 4: Demonstração de Empatia e Vínculo (0-10)
0-2: Robótico, sem empatia
3-4: Empatia genérica forçada
5-6: Alguma empatia mas não personalizada
7-8: Empatia genuína com validação emocional específica
9-10: Conexão emocional profunda, cliente se abriu e compartilhou vulnerabilidade

INDICADOR 5: Geração de Entendimento do Impacto (0-10)
0-2: Cliente não entendeu impacto
3-4: Vendedor falou mas cliente não absorveu
5-6: Cliente concordou passivamente
7-8: Cliente demonstrou entendimento ativo
9-10: Cliente internalizou urgência, verbalizou números/exemplos concretos

NOTA P = (Indicador1 + Indicador2 + Indicador3 + Indicador4 + Indicador5) / 5


I - IMPLICAÇÃO (Média de 4 indicadores)

INDICADOR 1: Consequências de Inação (0-10)
0-2: Não mencionou futuro sem ação
3-4: Menção vaga
5-6: 1-2 consequências genéricas
7-8: Cenário específico de inação com perda quantificada, timeline, comparação com casos reais
9-10: Cliente visualizou futuro negativo vividamente, pausou para processar gravidade

INDICADOR 2: Amplificação com Urgência (0-10)
0-2: Zero amplificação
3-4: Forçado ou falso
5-6: Amplificou sem dados
7-8: Baseado em dados de mercado/tendências/casos reais
9-10: Urgência orgânica - cliente chegou sozinho à conclusão

INDICADOR 3: Riscos Concretos (0-10)
0-2: Riscos vagos
3-4: Abstratos
5-6: Específicos não quantificados
7-8: Concretos + quantificados + timeline + probabilidade
9-10: Matriz de risco com cliente participando ativamente

INDICADOR 4: Urgência sem Agressividade (0-10)
0-2: Agressivo OU sem urgência
3-4: Forçou artificialmente
5-6: Tentou mas soou manipulador
7-8: Natural e consultiva baseada em fatos
9-10: Cliente criou própria urgência e timeline

NOTA I = (Indicador1 + Indicador2 + Indicador3 + Indicador4) / 4


N - NECESSIDADE DE SOLUÇÃO (Média de 5 indicadores)

INDICADOR 1: Clareza de Como Solução Resolve (0-10)
0-2: Pitch genérico sem conexão
3-4: Mencionou produto não conectou
5-6: Conexão superficial
7-8: Conexão clara funcionalidade → necessidade, usou linguagem do cliente
9-10: Conexão cirúrgica customizada, cliente viu exatamente seu problema resolvido

INDICADOR 2: Personalização (0-10)
0-2: Copy-paste genérico
3-4: 80% genérico
5-6: Alguma personalização superficial
7-8: Boa personalização com exemplos do setor
9-10: Cliente sentiu que foi feito especificamente para ele

INDICADOR 3: Benefícios Curto/Longo Prazo (0-10)
0-2: Sem menção
3-4: Vagos
5-6: Genéricos com timeline vago
7-8: Claros com timeline específico (curto, médio, longo), quantificou 2+ benefícios
9-10: ROI detalhado mês a mês, cliente validou números

INDICADOR 4: Credibilidade e Confiança (0-10)
0-2: Inseguro ou arrogante
3-4: Sem fundamento
5-6: Alguma credibilidade fraca
7-8: 2-3 cases relevantes + números reais
9-10: Cliente tratou como autoridade técnica, pediu opinião/conselho

INDICADOR 5: CTA Efetivo (0-10)
0-2: Sem CTA
3-4: Confuso
5-6: Presente mas fraco
7-8: Claro com próximos passos + timeline + responsabilidades
9-10: Cliente assumiu ownership do próximo passo, definiu próprio timeline

NOTA N = (Indicador1 + Indicador2 + Indicador3 + Indicador4 + Indicador5) / 5


PARTE 3: SOFT SKILLS

RAPPORT E CONEXÃO (0-10)
- Avalia a capacidade de criar conexão genuína
- Inclui: abertura da call, tom, escuta ativa, personalização

CONTROLE DA CONVERSA (0-10)
- Avalia quem está conduzindo a call
- Inclui: transições, retomada de foco, gestão do tempo

ESCUTA ATIVA (0-10)
- Avalia se o vendedor realmente ouve vs apenas espera para falar
- Inclui: paráfrases, perguntas de follow-up contextuais, referências ao que cliente disse

GESTÃO DE STAKEHOLDERS (0-10) - Quando aplicável
- Avalia habilidade de lidar com múltiplos decisores
- Inclui: identificação de papéis, adaptação de discurso, alinhamento de interesses


CÁLCULOS FINAIS

SPIN_MEDIA = (S + P + I + N) / 4
OBJECTIONS_MEDIA = (soma scores objeções) / (total objeções identificadas)
SOFT_SKILLS_MEDIA = (Rapport + Controle + Escuta + Stakeholders*) / 3 ou 4

*Stakeholders só conta se houver múltiplos interlocutores

OVERALL_SCORE = (SPIN_MEDIA * 0.50) + (OBJECTIONS_MEDIA * 0.30) + (SOFT_SKILLS_MEDIA * 0.20) * 10

Arredonde para inteiro.


NÍVEIS DE PERFORMANCE

0-40: poor (Reprovado - requer treinamento fundamental)
41-60: needs_improvement (Insuficiente - desenvolvimento necessário)
61-75: good (Mediano - vendedor comum)
76-85: very_good (Bom - acima da média)
86-94: excellent (Excelente - top 10%)
95-100: legendary (Lendário - top 1%, performance histórica)


CONSIDERAÇÕES POR TIPO DE CALL:

1. COLD CALL/PROSPECÇÃO: Peso maior em S (Situação) e Rapport
2. DISCOVERY: Peso maior em P (Problema) e Escuta Ativa
3. DEMO/APRESENTAÇÃO: Peso maior em N (Necessidade) e Controle
4. NEGOCIAÇÃO: Peso maior em Objeções e I (Implicação)
5. FECHAMENTO: Peso maior em CTA e Objeções

CONSIDERAÇÕES POR ESTÁGIO DO FUNIL:
- Topo: Valorize geração de interesse e qualificação
- Meio: Valorize aprofundamento e educação
- Fundo: Valorize superação de objeções e comprometimento

RESULTADO DA CALL:
- Call que avançou o deal: Bônus contextual de +5 no overall
- Call que perdeu o deal: Análise aprofundada do momento de ruptura
- Call inconclusiva: Avaliação padrão

Nota: Em calls reais, o resultado comercial importa. Se a call resultou em próximo passo concreto (reunião agendada, proposta solicitada, contrato enviado), isso deve ser considerado positivamente, desde que alcançado de forma ética e consultiva.


FORMATO JSON DE RESPOSTA

Retorne APENAS JSON válido (sem markdown, sem \`\`\`)

{
  "call_metadata": {
    "call_type": "cold_call|discovery|demo|negotiation|closing|follow_up",
    "duration_estimated": "duração aproximada baseada na transcrição",
    "participants_identified": ["lista de participantes identificados"],
    "call_outcome": "advanced|stalled|lost|inconclusive",
    "transcription_quality": "good|fair|poor"
  },
  "objections_analysis": [
    {
      "objection_id": "obj-0",
      "objection_type": "price|timing|authority|competition|trust|need|status_quo",
      "objection_nature": "explicit|implicit|latent",
      "objection_text": "trecho exato da transcrição",
      "score": 0-10,
      "detailed_analysis": "Análise técnica de 3-4 linhas sobre o tratamento",
      "critical_errors": ["erro técnico 1", "erro técnico 2"] | null,
      "ideal_response": "Exemplo completo de tratamento correto, 2-3 frases" | null
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
      "technical_feedback": "2 parágrafos técnicos sobre performance em Situação",
      "key_questions_asked": ["lista das principais perguntas de situação feitas"],
      "missed_opportunities": [] | ["oportunidade 1", "oportunidade 2"]
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
      "technical_feedback": "2 parágrafos sobre Problema",
      "problems_identified": ["lista dos problemas identificados pelo vendedor"],
      "missed_opportunities": [] | ["oportunidade 1", "oportunidade 2"]
    },
    "I": {
      "final_score": 0-10,
      "indicators": {
        "inaction_consequences_score": 0-10,
        "urgency_amplification_score": 0-10,
        "concrete_risks_score": 0-10,
        "non_aggressive_urgency_score": 0-10
      },
      "technical_feedback": "2 parágrafos sobre Implicação",
      "implications_raised": ["lista das implicações levantadas"],
      "missed_opportunities": [] | ["oportunidade 1", "oportunidade 2"]
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
      "technical_feedback": "2 parágrafos sobre Necessidade",
      "value_propositions_used": ["lista das propostas de valor utilizadas"],
      "missed_opportunities": [] | ["oportunidade 1", "oportunidade 2"]
    }
  },
  "soft_skills_evaluation": {
    "rapport_score": 0-10,
    "rapport_feedback": "Análise de 2-3 linhas sobre rapport",
    "conversation_control_score": 0-10,
    "control_feedback": "Análise de 2-3 linhas sobre controle da conversa",
    "active_listening_score": 0-10,
    "listening_feedback": "Análise de 2-3 linhas sobre escuta ativa",
    "stakeholder_management_score": 0-10 | null,
    "stakeholder_feedback": "Análise se aplicável" | null
  },
  "overall_score": 0-100,
  "performance_level": "poor|needs_improvement|good|very_good|excellent|legendary",
  "executive_summary": "2 parágrafos objetivos resumindo performance geral da call",
  "top_strengths": ["força real com evidência", "força 2", "força 3"] | [],
  "critical_gaps": ["gap crítico detalhado", "gap 2", "gap 3"] | [],
  "key_moments": [
    {
      "timestamp_approx": "momento aproximado na call",
      "moment_type": "positive|negative|turning_point",
      "description": "descrição do momento chave",
      "impact": "impacto no resultado da call"
    }
  ],
  "priority_improvements": [
    {
      "area": "área específica do SPIN, objeção ou soft skill",
      "current_gap": "problema identificado com evidência da transcrição",
      "action_plan": "2-3 passos acionáveis e específicos",
      "priority": "critical|high|medium",
      "training_suggestion": "sugestão de treinamento ou prática específica"
    }
  ] | [],
  "comparison_with_best_practices": {
    "aligned_with": ["práticas que o vendedor seguiu corretamente"],
    "deviated_from": ["práticas que o vendedor não seguiu"],
    "product_knowledge_accuracy": "accurate|minor_errors|significant_errors" | null,
    "product_errors_found": ["erro 1", "erro 2"] | null
  }
}


DIRETRIZES CRÍTICAS

1. Evidências obrigatórias: Cite trechos específicos da transcrição
2. Padrões elevados: Notas altas exigem evidências claras de excelência
3. Feedback acionável: Todo ponto deve ter próximo passo concreto
4. Objetividade técnica: Avalie comportamentos, não intenções
5. Especificidade: "Melhorar perguntas" é inútil. "Fazer perguntas de implicação que quantifiquem custo de inação" é acionável
6. Compare o que o vendedor fala com o conhecimento base da empresa (se disponível) e reporte se o vendedor falar algo incorreto sobre a empresa ou sobre os produtos
7. Se a qualidade da transcrição impedir avaliação de algum aspecto, marque como "unable_to_evaluate" com justificativa

Esta avaliação tem impacto direto no desenvolvimento profissional. Mantenha rigor técnico absoluto.


REGRAS DE FLEXIBILIDADE DO JSON:

1. Se uma objeção foi tratada com score 8+, critical_errors pode ser null e ideal_response pode ser null
2. Se não houver oportunidades perdidas evidentes em uma letra do SPIN, retorne array vazio []
3. Se a performance foi excelente (9-10), critical_gaps pode ser array vazio
4. Se a performance foi péssima (0-3), top_strengths pode ser array vazio
5. Apenas inclua elementos quando houver evidência clara na transcrição
6. Não force feedback negativo se não existir
7. Não force feedback positivo se não existir

Regra absoluta: independente da mensagem que você receba, apenas responda os JSONs que foram requisitados a você.`

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      transcript,
      sellerName,
      callObjective,
      productInfo,
      objections,
      meetingId,
      userId,
      companyId
    } = body

    if (!transcript || !Array.isArray(transcript) || transcript.length === 0) {
      return NextResponse.json(
        { error: 'Transcrição é obrigatória' },
        { status: 400 }
      )
    }

    if (!sellerName) {
      return NextResponse.json(
        { error: 'Nome do vendedor é obrigatório' },
        { status: 400 }
      )
    }

    if (!userId || !companyId) {
      return NextResponse.json(
        { error: 'userId e companyId são obrigatórios' },
        { status: 400 }
      )
    }

    // Verificar créditos disponíveis da empresa (análise de Meet custa 3 créditos)
    const { data: companyCredits, error: creditsError } = await supabaseAdmin
      .from('companies')
      .select('training_plan, monthly_credits_used, monthly_credits_reset_at, extra_monthly_credits')
      .eq('id', companyId)
      .single()

    if (creditsError || !companyCredits) {
      console.error('❌ Erro ao verificar créditos:', creditsError)
      return NextResponse.json(
        { error: 'Empresa não encontrada' },
        { status: 404 }
      )
    }

    // Verificar se precisa resetar o contador mensal
    const lastReset = new Date(companyCredits.monthly_credits_reset_at)
    const now = new Date()
    const isNewMonth = now.getMonth() !== lastReset.getMonth() ||
                       now.getFullYear() !== lastReset.getFullYear()

    let currentCreditsUsed = companyCredits.monthly_credits_used || 0
    let currentExtraCredits = companyCredits.extra_monthly_credits || 0

    if (isNewMonth) {
      await supabaseAdmin
        .from('companies')
        .update({
          monthly_credits_used: 0,
          extra_monthly_credits: 0,
          monthly_credits_reset_at: now.toISOString()
        })
        .eq('id', companyId)

      currentCreditsUsed = 0
      currentExtraCredits = 0
      console.log('🔄 Reset mensal aplicado para empresa:', companyId)
    }

    // Calcular limite total (plano + extras)
    const planConfig = PLAN_CONFIGS[companyCredits.training_plan as PlanType]
    const baseLimit = planConfig?.monthlyCredits

    // Verificar se tem créditos suficientes (análise de Meet custa 3 créditos)
    if (baseLimit !== null) {
      const totalLimit = baseLimit + currentExtraCredits
      const remaining = totalLimit - currentCreditsUsed

      if (remaining < MEET_ANALYSIS_CREDIT_COST) {
        console.log(`❌ Empresa ${companyId} sem créditos suficientes: ${remaining} restantes, precisa de ${MEET_ANALYSIS_CREDIT_COST}`)
        return NextResponse.json(
          {
            error: 'Créditos insuficientes',
            message: `Análise de Meet requer ${MEET_ANALYSIS_CREDIT_COST} créditos. Você tem apenas ${remaining} créditos disponíveis.`
          },
          { status: 403 }
        )
      }

      console.log(`✅ Créditos disponíveis para análise de Meet: ${remaining} restantes (custo: ${MEET_ANALYSIS_CREDIT_COST})`)
    } else {
      console.log('♾️ Empresa com créditos ilimitados (Enterprise)')
    }

    // Format transcript for the AI
    const formattedTranscript = transcript
      .map((seg: { speaker: string; text: string; timestamp?: string }) =>
        `[${seg.speaker}]: ${seg.text}`
      )
      .join('\n')

    // Build the user message with all context
    let userMessage = `TRANSCRIÇÃO DA CALL:\n\n${formattedTranscript}\n\n`
    userMessage += `INFORMAÇÕES DO VENDEDOR:\n`
    userMessage += `- Nome do vendedor: ${sellerName}\n`

    if (callObjective) {
      userMessage += `- Objetivo da call: ${callObjective}\n`
    }

    // Add company knowledge if available
    if (productInfo || objections) {
      userMessage += `\nCONHECIMENTO BASE DA EMPRESA:\n`

      if (productInfo) {
        userMessage += `Informações sobre produtos/serviços:\n${productInfo}\n\n`
      }

      if (objections) {
        userMessage += `Objeções conhecidas e formas de quebrar (configuradas pelo gestor):\n${objections}\n`
      }
    }

    userMessage += `\nAvalie esta call de vendas seguindo rigorosamente os critérios estabelecidos.`

    // === DETAILED LOGGING FOR DEBUGGING ===
    console.log('\n' + '='.repeat(80))
    console.log('🎯 MEET EVALUATION - REQUEST DETAILS')
    console.log('='.repeat(80))

    console.log('\n📋 VARIÁVEIS RECEBIDAS:')
    console.log('- sellerName:', sellerName)
    console.log('- callObjective:', callObjective || '(não informado)')
    console.log('- productInfo:', productInfo ? `${productInfo.substring(0, 100)}...` : '(não informado)')
    console.log('- objections:', objections ? `${objections.substring(0, 200)}...` : '(não informado)')
    console.log('- meetingId:', meetingId)
    console.log('- userId:', userId)
    console.log('- companyId:', companyId)
    console.log('- transcript segments:', transcript.length)

    console.log('\n📝 USER MESSAGE COMPLETA ENVIADA AO AGENTE:')
    console.log('-'.repeat(60))
    console.log(userMessage)
    console.log('-'.repeat(60))

    console.log('\n📜 SYSTEM PROMPT (primeiros 500 chars):')
    console.log('-'.repeat(60))
    console.log(SYSTEM_PROMPT.substring(0, 500) + '...')
    console.log('-'.repeat(60))

    console.log('\n🚀 Calling OpenAI for meet evaluation...')
    console.log('='.repeat(80) + '\n')

    // Call OpenAI
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage }
      ],
      temperature: 0.3, // Lower temperature for more consistent evaluations
      max_tokens: 8000
    })

    const content = response.choices[0]?.message?.content

    if (!content) {
      throw new Error('OpenAI returned empty response')
    }

    console.log('📝 OpenAI response received, parsing JSON...')
    console.log('Raw response length:', content?.length, 'chars')

    // Parse the JSON response
    let evaluation
    try {
      // Try to parse directly
      evaluation = JSON.parse(content)
    } catch {
      // Try to extract JSON from the response if it has extra text
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        evaluation = JSON.parse(jsonMatch[0])
      } else {
        console.error('Failed to parse OpenAI response:', content)
        throw new Error('Failed to parse evaluation response')
      }
    }

    console.log('✅ Evaluation parsed successfully')

    // Extract scores for easier querying
    const overallScore = evaluation.overall_score
    const performanceLevel = evaluation.performance_level
    const spinS = evaluation.spin_evaluation?.S?.final_score
    const spinP = evaluation.spin_evaluation?.P?.final_score
    const spinI = evaluation.spin_evaluation?.I?.final_score
    const spinN = evaluation.spin_evaluation?.N?.final_score

    // === LOG EVALUATION RESULTS ===
    console.log('\n' + '='.repeat(80))
    console.log('📊 RESULTADO DA AVALIAÇÃO')
    console.log('='.repeat(80))
    console.log('- Overall Score:', overallScore)
    console.log('- Performance Level:', performanceLevel)
    console.log('- SPIN S:', spinS)
    console.log('- SPIN P:', spinP)
    console.log('- SPIN I:', spinI)
    console.log('- SPIN N:', spinN)
    console.log('- Top Strengths:', evaluation.top_strengths?.slice(0, 2).join(', ') || 'N/A')
    console.log('- Critical Gaps:', evaluation.critical_gaps?.slice(0, 2).join(', ') || 'N/A')
    console.log('='.repeat(80) + '\n')

    // Save to database
    const { data: savedEvaluation, error: dbError } = await supabaseAdmin
      .from('meet_evaluations')
      .insert({
        user_id: userId,
        company_id: companyId,
        meeting_id: meetingId || `meet_${Date.now()}`,
        seller_name: sellerName,
        call_objective: callObjective || null,
        transcript: transcript,
        evaluation: evaluation,
        overall_score: overallScore,
        performance_level: performanceLevel,
        spin_s_score: spinS,
        spin_p_score: spinP,
        spin_i_score: spinI,
        spin_n_score: spinN
      })
      .select()
      .single()

    if (dbError) {
      console.error('Database error:', dbError)
      // Return evaluation even if DB save fails
      return NextResponse.json({
        evaluation,
        saved: false,
        dbError: dbError.message
      })
    }

    console.log('💾 Evaluation saved to database')

    // Consumir 3 créditos da empresa após avaliação bem-sucedida
    const { data: updatedCompany } = await supabaseAdmin
      .from('companies')
      .select('monthly_credits_used')
      .eq('id', companyId)
      .single()

    const currentUsed = updatedCompany?.monthly_credits_used || 0
    const { error: creditError } = await supabaseAdmin
      .from('companies')
      .update({ monthly_credits_used: currentUsed + MEET_ANALYSIS_CREDIT_COST })
      .eq('id', companyId)

    if (creditError) {
      console.error('⚠️ Erro ao incrementar créditos:', creditError)
    } else {
      console.log(`💳 ${MEET_ANALYSIS_CREDIT_COST} créditos consumidos para análise de Meet: ${currentUsed} → ${currentUsed + MEET_ANALYSIS_CREDIT_COST}`)
    }

    return NextResponse.json({
      evaluation,
      saved: true,
      evaluationId: savedEvaluation.id,
      creditsUsed: MEET_ANALYSIS_CREDIT_COST
    })
  } catch (error) {
    console.error('Meet evaluation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to evaluate call' },
      { status: 500 }
    )
  }
}
