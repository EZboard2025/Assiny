import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { fetchAllUserData, formatWeaknessesForPrompt, getTopWeakness } from '@/lib/challenges/analyzeUserWeaknesses'
import { calculateNextDifficulty } from '@/lib/challenges/trackChallengeEffectiveness'
import { PLAN_CONFIGS, PlanType } from '@/lib/types/plans'

const CHALLENGE_GENERATION_CREDIT_COST = 1

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Function to analyze company website for synthetic data generation
async function analyzeCompanyWebsite(websiteUrl: string): Promise<string | null> {
  if (!websiteUrl) return null

  try {
    // Ensure URL has protocol
    let fullUrl = websiteUrl.trim()
    if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) {
      fullUrl = `https://${fullUrl}`
    }

    // Fetch website content
    const response = await fetch(fullUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Assiny/1.0; +https://ramppy.site)',
        'Accept': 'text/html,application/xhtml+xml'
      },
      signal: AbortSignal.timeout(10000) // 10s timeout
    })

    if (!response.ok) {
      console.log(`      ⚠️ Website retornou status ${response.status}`)
      return null
    }

    const html = await response.text()

    // Extract text content (basic HTML parsing)
    const textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 8000) // Limit to 8k chars

    // Use OpenAI to extract relevant business info
    const analysisCompletion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Você é um analista de negócios. Extraia informações relevantes do conteúdo de um site empresarial para criar personas de clientes e objeções de vendas realistas.

Retorne um JSON com:
{
  "empresa": "Nome/descrição da empresa",
  "produtos_servicos": "Principais produtos/serviços",
  "proposta_valor": "Proposta de valor principal",
  "publico_alvo": "Perfil do público-alvo",
  "diferenciais": "Diferenciais competitivos",
  "possiveis_objecoes": ["Objeção 1", "Objeção 2", "Objeção 3"],
  "perfis_decisores": ["Perfil 1", "Perfil 2"]
}

Retorne APENAS o JSON, sem markdown.`
        },
        {
          role: 'user',
          content: `Analise este conteúdo extraído do site:\n\n${textContent}`
        }
      ],
      temperature: 0.3,
      max_tokens: 1000
    })

    const analysisText = analysisCompletion.choices[0].message.content || ''
    return analysisText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

  } catch (error) {
    console.log(`      ⚠️ Erro ao analisar website: ${error instanceof Error ? error.message : String(error)}`)
    return null
  }
}

interface GenerationResult {
  userId: string
  userName: string
  companyId: string
  companyName: string
  status: 'success' | 'skipped' | 'error'
  reason?: string
  challengeId?: string
}

// POST - Generate challenges now (admin only, deletes existing ones first)
export async function POST(req: NextRequest) {
  try {
    const today = new Date().toISOString().split('T')[0]
    const results: GenerationResult[] = []
    let totalGenerated = 0
    let totalSkipped = 0
    let totalErrors = 0
    let totalCreditsUsed = 0

    console.log(`\n${'='.repeat(60)}`)
    console.log(`🎯 GERAÇÃO MANUAL DE DESAFIOS - ${new Date().toLocaleString('pt-BR')}`)
    console.log(`${'='.repeat(60)}\n`)

    // Nota: Não deletamos mais desafios existentes - permitimos múltiplos por dia

    // 1. Get all companies with daily challenges enabled
    const { data: companies, error: companiesError } = await supabaseAdmin
      .from('companies')
      .select('id, name, subdomain, daily_challenges_enabled, training_plan, monthly_credits_used, monthly_credits_reset_at, extra_monthly_credits, website_url')
      .eq('daily_challenges_enabled', true)

    if (companiesError) {
      throw new Error(`Error fetching companies: ${companiesError.message}`)
    }

    if (!companies || companies.length === 0) {
      console.log('⚠️ Nenhuma empresa com desafios diários habilitados')
      return NextResponse.json({
        success: true,
        message: 'Nenhuma empresa com desafios diários habilitados',
        results: [],
        summary: { generated: 0, skipped: 0, errors: 0, creditsUsed: 0 }
      })
    }

    console.log(`📊 ${companies.length} empresas com desafios habilitados\n`)

    // 3. Process each company
    for (const company of companies) {
      console.log(`\n🏢 Processando: ${company.name} (${company.subdomain})`)

      // Check credits
      const lastReset = new Date(company.monthly_credits_reset_at)
      const now = new Date()
      const isNewMonth = now.getMonth() !== lastReset.getMonth() ||
                         now.getFullYear() !== lastReset.getFullYear()

      let currentCreditsUsed = company.monthly_credits_used || 0
      let currentExtraCredits = company.extra_monthly_credits || 0

      if (isNewMonth) {
        await supabaseAdmin
          .from('companies')
          .update({
            monthly_credits_used: 0,
            extra_monthly_credits: 0,
            monthly_credits_reset_at: now.toISOString()
          })
          .eq('id', company.id)

        currentCreditsUsed = 0
        currentExtraCredits = 0
      }

      const planConfig = PLAN_CONFIGS[company.training_plan as PlanType]
      const baseLimit = planConfig?.monthlyCredits

      // 4. Get all employees for this company
      const { data: employees, error: employeesError } = await supabaseAdmin
        .from('employees')
        .select('user_id, name, email')
        .eq('company_id', company.id)

      if (employeesError || !employees) {
        console.log(`  ❌ Erro ao buscar funcionários: ${employeesError?.message}`)
        continue
      }

      console.log(`  👥 ${employees.length} vendedores encontrados`)

      // 5. Process each employee
      for (const employee of employees) {
        const userId = employee.user_id
        const userName = employee.name || employee.email

        // Nota: Não verificamos mais se já existe desafio - permitimos múltiplos por dia

        // Check credits before generating
        if (baseLimit !== null) {
          const totalLimit = baseLimit + currentExtraCredits
          const remaining = totalLimit - currentCreditsUsed

          if (remaining < CHALLENGE_GENERATION_CREDIT_COST) {
            results.push({
              userId,
              userName,
              companyId: company.id,
              companyName: company.name,
              status: 'skipped',
              reason: 'Empresa sem créditos suficientes'
            })
            totalSkipped++
            console.log(`    ⏭️ ${userName}: empresa sem créditos`)
            continue
          }
        }

        try {
          // Fetch user data and analyze weaknesses
          const userData = await fetchAllUserData(userId, company.id)

          if (!userData) {
            results.push({
              userId,
              userName,
              companyId: company.id,
              companyName: company.name,
              status: 'skipped',
              reason: 'Erro ao buscar dados do usuário'
            })
            totalSkipped++
            continue
          }

          // Check if user has enough data
          const totalDataPoints = userData.roleplaySessions.length + userData.meetEvaluations.length

          if (totalDataPoints < 1) {
            results.push({
              userId,
              userName,
              companyId: company.id,
              companyName: company.name,
              status: 'skipped',
              reason: 'Dados insuficientes para gerar desafio'
            })
            totalSkipped++
            console.log(`    ⏭️ ${userName}: dados insuficientes`)
            continue
          }

          // Check if weaknesses were detected - if not, create advanced challenge
          const topWeakness = getTopWeakness(userData.weaknesses)
          const isAdvancedChallenge = userData.weaknesses.length === 0 || !topWeakness

          // Fetch personas and objections
          const [personasResult, objectionsResult, objectivesResult] = await Promise.all([
            supabaseAdmin.from('personas').select('*').eq('company_id', company.id),
            supabaseAdmin.from('objections').select('*').eq('company_id', company.id),
            supabaseAdmin.from('roleplay_objectives').select('*').eq('company_id', company.id)
          ])

          const personas = personasResult.data || []
          const objections = objectionsResult.data || []
          const objectives = objectivesResult.data || []

          // Note: AI can now create personas if none exist, so we don't skip

          // Calculate difficulty level (advanced challenges start at level 4-5)
          const difficultyLevel = isAdvancedChallenge
            ? Math.floor(Math.random() * 2) + 4 // Level 4 or 5 for advanced
            : await calculateNextDifficulty(userId, topWeakness!.target)

          // For 4+ difficulty, analyze company website for synthetic data generation
          let websiteAnalysis: string | null = null
          const isHighDifficulty = difficultyLevel >= 4
          if (isHighDifficulty && company.website_url) {
            console.log(`      🌐 Analisando site da empresa para desafio avançado...`)
            websiteAnalysis = await analyzeCompanyWebsite(company.website_url)
            if (websiteAnalysis) {
              console.log(`      ✅ Análise do site concluída`)
            }
          }

          // Generate challenge using OpenAI
          const weaknessPrompt = formatWeaknessesForPrompt(userData)

          const systemPrompt = `Você é um coach de vendas especialista em criar desafios de treinamento personalizados.

Sua tarefa é:
1. Analisar as fraquezas do vendedor
2. Criar um desafio de roleplay que vai ajudá-lo a melhorar
3. Gerar uma explicação motivacional e clara do PORQUÊ esse desafio é importante
4. Se necessário, criar novas personas ou objeções que sejam mais adequadas ao treinamento

PERSONAS EXISTENTES:
${personas.length > 0 ? personas.map((p, i) => `${i + 1}. ID: ${p.id}
   - Cargo: ${p.job_title || p.cargo || 'N/A'}
   - Empresa/Perfil: ${p.company_type || p.tipo_empresa_faturamento || 'N/A'}
   - Contexto: ${p.context || p.contexto || 'N/A'}
   - O que busca: ${p.company_goals || p.what_seeks || p.busca || 'N/A'}
   - Dores: ${p.business_challenges || p.main_pains || p.dores || 'N/A'}
`).join('\n') : '(Nenhuma persona cadastrada)'}

OBJEÇÕES EXISTENTES:
${objections.length > 0 ? objections.map((o, i) => `${i + 1}. ID: ${o.id}
   - Objeção: ${o.name}
   - Formas de quebrar: ${o.rebuttals?.join(', ') || 'N/A'}
`).join('\n') : '(Nenhuma objeção cadastrada)'}

${objectives.length > 0 ? `OBJETIVOS DISPONÍVEIS:
${objectives.map((o, i) => `${i + 1}. ID: ${o.id} - ${o.name}: ${o.description || 'Sem descrição'}`).join('\n')}` : ''}

NÍVEL DE DIFICULDADE ATUAL: ${difficultyLevel}/5

${isHighDifficulty && websiteAnalysis ? `
ANÁLISE DO SITE DA EMPRESA (use para criar personas e objeções mais realistas):
${websiteAnalysis}
` : ''}

REGRAS IMPORTANTES:
1. Se as personas existentes NÃO são adequadas para treinar a fraqueza identificada, crie uma nova persona
2. Se as objeções existentes NÃO são relevantes para o desafio, crie novas objeções com formas de quebrá-las
3. A explicação (ai_explanation) deve ser em português, empática, motivacional e explicar claramente POR QUE o vendedor precisa desse treino
4. Retorne APENAS JSON válido, sem markdown ou texto adicional

⚠️ REGRA CRÍTICA PARA METAS:
- O spin_min_score DEVE ser calculado assim: score_atual + 1.5 (mínimo de 7.0, máximo de 10.0)
- Se o vendedor tem score atual de 6.8, a meta deve ser 8.3 (arredondado para 8.5)
- Se o vendedor tem score atual de 4.0, a meta deve ser 7.0 (mínimo)
- Se o vendedor tem score atual de 9.0, a meta deve ser 10.0 (máximo)
- Um DESAFIO deve ser DESAFIADOR - nunca coloque uma meta abaixo do score atual!

5. CADA REBUTTAL DEVE SER DETALHADA seguindo este formato:
   "[Técnica]: [Contexto do por que funciona]. Exemplo: '[Frase exata que o vendedor pode usar]'"
   - Mínimo de 50 palavras por rebuttal
   - Inclua o PORQUÊ a técnica funciona
   - Dê EXEMPLOS de frases completas entre aspas simples
6. COACHING_TIPS DEVEM SER ESPECÍFICAS E ACIONÁVEIS:
   - Cada dica deve ter uma técnica concreta que o vendedor pode aplicar
   - Inclua exemplos de frases ou perguntas quando possível
   - Relacione diretamente com a fraqueza sendo treinada
   - NÃO use placeholders como "Dica 1", "Dica avançada 1" - seja ESPECÍFICO
${isHighDifficulty ? `
⚠️ OBRIGATÓRIO PARA DIFICULDADE 4+:
- SEMPRE crie uma nova persona (new_persona NÃO pode ser null) - deve ser um cenário mais complexo e realista
- A persona deve ter contexto detalhado: cargo específico, situação atual da empresa, pressões que enfrenta, histórico de decisões
- SEMPRE crie pelo menos 2 novas objeções (new_objections deve ter 2+ itens) com rebuttals MUITO detalhadas
- Cada rebuttal deve ter: contexto, técnica de vendas, exemplo de frase, e por que funciona
- Use dados do site da empresa (se disponível) para criar dados REALISTAS e específicos do negócio
- NÃO use IDs de personas/objeções existentes - crie dados sintéticos novos` : ''}`

          const userPrompt = isAdvancedChallenge
            ? `${weaknessPrompt}

VENDEDOR: ${userName}
TIPO DE DESAFIO: AVANÇADO (Sem fraquezas críticas detectadas!)
${websiteAnalysis ? `\nDADOS DO SITE DA EMPRESA PARA USAR:\n${websiteAnalysis}\n` : ''}

Este vendedor está com boa performance geral. Crie um desafio AVANÇADO para:
1. Buscar a EXCELÊNCIA (score 10) em uma letra SPIN específica
2. Explorar cenários COMPLEXOS e situações de alta pressão
3. Treinar habilidades AVANÇADAS como:
   - Multi-threading (múltiplos decisores)
   - Negociação com C-Level
   - Recuperação de deals perdidos
   - Vendas consultivas complexas
   - Objeções sofisticadas (política interna, compliance, etc.)

⚠️ OBRIGATÓRIO PARA DESAFIO AVANÇADO:
- CRIE UMA NOVA PERSONA (new_persona NÃO pode ser null) - deve ser um decisor sênior/C-Level
- CRIE PELO MENOS 2 NOVAS OBJEÇÕES (new_objections deve ter 2+ itens) sofisticadas
- As rebuttals devem incluir técnicas específicas E exemplos de frases práticas
- NÃO use personas ou objeções existentes - crie novos dados sintéticos baseados no contexto
- Se houver dados do site da empresa, use-os para criar cenários realistas

Retorne um JSON com esta estrutura:
{
  "title": "Título curto e desafiador (max 50 chars)",
  "description": "Descrição do cenário avançado (max 200 chars)",
  "target_weakness": "advanced_skill",
  "confidence_score": 0.9,

  "ai_explanation": "Explicação em português (2-4 parágrafos) parabenizando o vendedor pela boa performance e explicando: 1) Por que ele foi selecionado para um desafio avançado, 2) Qual skill específica será exercitada, 3) Como isso vai elevar ainda mais seu nível, 4) Dicas para esse cenário complexo",

  "roleplay_config": {
    "persona_id": null,
    "objection_ids": [],
    "age_range": "45-60",
    "temperament": "Analítico",
    "objective_id": null
  },

  "new_persona": {
    "job_title": "CFO / Diretor Financeiro",
    "company_type": "Indústria de manufatura com faturamento de R$50-100M/ano, 200 funcionários",
    "context": "A empresa passou por uma reestruturação recente após fusão. O CFO foi contratado há 8 meses e está sob pressão do conselho para reduzir custos operacionais em 15% até o final do ano fiscal. Já teve experiências ruins com fornecedores de tecnologia que prometeram ROI e não entregaram. Prefere análises detalhadas e cases comprovados antes de qualquer decisão.",
    "company_goals": "Reduzir custos operacionais, melhorar eficiência dos processos financeiros, ter visibilidade em tempo real dos indicadores. Precisa mostrar resultados rápidos para o board.",
    "business_challenges": "Múltiplos stakeholders para aprovar (CEO, COO, Diretor de TI), orçamento anual já alocado, resistência interna a mudanças após a fusão, equipe financeira sobrecarregada e resistente a novas ferramentas."
  },

  "new_objections": [
    {
      "name": "Precisamos envolver outras áreas antes de qualquer decisão",
      "rebuttals": [
        "Mapeamento de Stakeholders: Quando o cliente menciona outras áreas, é uma oportunidade de entender o processo de decisão e se posicionar como facilitador. Isso mostra que você entende a complexidade organizacional e não está tentando forçar uma venda. Exemplo: 'Faz total sentido envolver outras áreas, [nome]. Me ajuda a entender: quais áreas especificamente precisam participar dessa decisão? E qual delas você acha que teria mais a ganhar com essa solução? Posso preparar um material customizado para cada uma delas.'",
        "Criação de Aliados Internos: A técnica de criar aliados transforma o prospect em um champion interno. Ao perguntar qual área seria mais receptiva, você identifica onde começar a construir momentum interno. Exemplo: 'Entendo perfeitamente. Na sua visão, qual dessas áreas você acha que seria mais receptiva a uma conversa inicial? Muitas vezes, quando começamos por uma área que já sente a dor, fica mais fácil construir um business case sólido para apresentar às outras.'",
        "Oferta de Suporte Técnico: Oferecer participação em reuniões internas demonstra compromisso e reduz o trabalho do prospect de ter que explicar a solução. Isso também acelera o ciclo de vendas. Exemplo: 'Posso participar de uma reunião com essas áreas? Assim consigo responder às dúvidas técnicas na hora e você não precisa ficar no meio traduzindo informações. Qual seria a melhor forma de organizar isso?'"
      ]
    },
    {
      "name": "Nosso orçamento para este ano já está comprometido",
      "rebuttals": [
        "Exploração de Modelos Financeiros: Muitas empresas têm flexibilidade entre CAPEX e OPEX que o prospect pode não ter considerado. Essa pergunta abre possibilidades de estruturação criativa do deal. Exemplo: 'Entendo que o orçamento está alocado. Me tira uma dúvida: vocês trabalham mais com CAPEX ou OPEX para esse tipo de investimento? Pergunto porque às vezes conseguimos estruturar de uma forma que se encaixa em uma rubrica diferente, sem impactar o orçamento que já está comprometido.'",
        "Quantificação do Custo da Inação (SPIN - Implicação): Esta técnica faz o prospect calcular quanto está perdendo por não resolver o problema agora. Se o custo da inação for maior que o investimento, esperar não faz sentido financeiro. Exemplo: 'Faz sentido. Só para eu entender melhor: quanto vocês estimam que estão perdendo por mês com [problema específico que ele mencionou]? Porque se estamos falando de um payback de 3-4 meses, pode fazer mais sentido financeiro começar agora do que esperar o próximo ciclo e continuar tendo esse custo.'",
        "Proposta de Piloto Controlado: O piloto reduz o risco percebido e permite que o prospect prove valor internamente antes de um comprometimento maior. Também cria urgência pois o piloto tem prazo definido. Exemplo: 'E se fizéssemos diferente? Podemos começar com um piloto menor, focado em [área específica], que cabe no orçamento atual. Em 60 dias vocês teriam dados concretos de ROI para justificar o investimento completo no próximo ciclo. Isso faria sentido para vocês?'"
      ]
    }
  ],

  "success_criteria": {
    "spin_letter_target": "I",
    "spin_min_score": 8.0,
    "primary_indicator": "advanced_indicator",
    "primary_min_score": 8.0,
    "objection_handling_min": 8.0
  },

  "coaching_tips": [
    "Quantifique o custo da inação ANTES de falar de timeline - pergunte 'Quanto estão perdendo por mês com esse problema?'",
    "Com executivos C-Level, foque em ROI e métricas de negócio, não em funcionalidades técnicas",
    "Use a técnica de 'future pacing': 'Imagine daqui a 6 meses com esse problema resolvido...'"
  ],

  "analysis_summary": {
    "pattern_detected": "High performer - advanced challenge",
    "roleplay_evidence": { "avg_score": 7.5, "sessions_count": ${userData.roleplaySessions.length} },
    "meet_evidence": { "avg_score": 7.5, "calls_count": ${userData.meetEvaluations.length} }
  }
}`
            : `${weaknessPrompt}

VENDEDOR: ${userName}
FRAQUEZA PRINCIPAL A TRABALHAR: ${topWeakness!.target.toUpperCase()}
- Score atual: ${topWeakness!.currentScore.toFixed(1)}
- META MÍNIMA CALCULADA: ${Math.min(10, Math.max(7.0, topWeakness!.currentScore + 1.5)).toFixed(1)} (score atual + 1.5, mín 7.0, máx 10.0)
- Severidade: ${topWeakness!.severity}
${topWeakness!.pattern ? `- Padrão detectado: ${topWeakness!.pattern}` : ''}
${isHighDifficulty && websiteAnalysis ? `\nDADOS DO SITE DA EMPRESA PARA USAR:\n${websiteAnalysis}\n` : ''}
${isHighDifficulty ? `
⚠️ DESAFIO DE DIFICULDADE ${difficultyLevel}/5 - OBRIGATÓRIO:
- Crie PELO MENOS 2 objeções diferentes
- Se houver dados do site da empresa, use-os para criar objeções e personas mais realistas
` : ''}

Crie um desafio de roleplay personalizado.

Retorne um JSON com esta estrutura:
{
  "title": "Título curto e motivacional (max 50 chars)",
  "description": "Descrição do desafio (max 200 chars)",
  "target_weakness": "${topWeakness!.target}",
  "confidence_score": ${topWeakness!.confidence.toFixed(2)},

  "ai_explanation": "Explicação detalhada em português (2-4 parágrafos) explicando: 1) O que foi detectado nas análises do vendedor, 2) Por que isso é importante de melhorar, 3) Como esse desafio específico vai ajudar, 4) Dicas rápidas de como abordar",

  "roleplay_config": {
    "persona_id": "UUID da persona existente OU null se criar nova",
    "objection_ids": ["UUIDs existentes OU vazios se criar novas"],
    "age_range": "35-44",
    "temperament": "Analítico|Empático|Determinado|Indeciso|Sociável",
    "objective_id": null
  },

  "new_persona": null ou {
    "job_title": "Cargo específico (ex: Gerente de Compras, Diretor Comercial)",
    "company_type": "Tipo e porte da empresa com contexto (ex: Distribuidora de alimentos, 50 funcionários, R$10M/ano)",
    "context": "Situação atual detalhada: há quanto tempo está no cargo, desafios recentes, experiências anteriores com soluções similares, pressões que enfrenta",
    "company_goals": "Objetivos específicos e mensuráveis que busca alcançar",
    "business_challenges": "Dores concretas: problemas do dia-a-dia, gargalos operacionais, pressões internas e externas"
  },

  "new_objections": ${isHighDifficulty ? `[
    {
      "name": "Objeção realista e específica",
      "rebuttals": [
        "[Técnica 1]: [Por que funciona neste contexto - 2 frases]. Exemplo: '[Frase completa que o vendedor pode usar na prática]'",
        "[Técnica 2]: [Explicação do racional por trás - 2 frases]. Exemplo: '[Outra frase prática com personalização]'",
        "[Técnica 3]: [Contexto de quando usar - 2 frases]. Exemplo: '[Terceira opção de abordagem]'"
      ]
    },
    {
      "name": "Segunda objeção comum neste cenário",
      "rebuttals": [
        "[Técnica]: [Explicação detalhada]. Exemplo: '[Frase prática]'",
        "[Técnica]: [Explicação detalhada]. Exemplo: '[Frase prática]'",
        "[Técnica]: [Explicação detalhada]. Exemplo: '[Frase prática]'"
      ]
    }
  ]` : `null ou [{
    "name": "Objeção específica do contexto",
    "rebuttals": [
      "[Técnica]: [Por que funciona]. Exemplo: '[Frase que o vendedor pode usar]'",
      "[Técnica]: [Contexto]. Exemplo: '[Outra frase prática]'",
      "[Técnica]: [Explicação]. Exemplo: '[Terceira opção]'"
    ]
  }]`},

  "success_criteria": {
    "spin_letter_target": "${topWeakness!.target.toUpperCase()}",
    "spin_min_score": ${Math.min(10, Math.max(7.0, topWeakness!.currentScore + 1.5)).toFixed(1)},
    "primary_indicator": "nome_do_indicador",
    "primary_min_score": ${Math.min(10, Math.max(7.0, topWeakness!.currentScore + 1.5)).toFixed(1)},
    "objection_handling_min": 7.0
  },

  "coaching_tips": [
    "Para melhorar em [letra SPIN], use a técnica X: '[exemplo de pergunta]'",
    "Quando o cliente disser [objeção], responda com '[frase prática]'",
    "Pratique o silêncio após fazer perguntas de Implicação - deixe o cliente processar"
  ],

  "analysis_summary": {
    "pattern_detected": "descrição do padrão identificado",
    "roleplay_evidence": { "avg_score": 5.0, "sessions_count": 3 },
    "meet_evidence": { "avg_score": 5.0, "calls_count": 2 }
  }
}`

          const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            temperature: 0.7,
            max_tokens: 1500
          })

          let challengeConfig
          try {
            const responseText = completion.choices[0].message.content || ''
            const cleanJson = responseText
              .replace(/```json\n?/g, '')
              .replace(/```\n?/g, '')
              .trim()
            challengeConfig = JSON.parse(cleanJson)
          } catch (parseError) {
            results.push({
              userId,
              userName,
              companyId: company.id,
              companyName: company.name,
              status: 'error',
              reason: 'Erro ao processar resposta da IA'
            })
            totalErrors++
            console.log(`    ❌ ${userName}: erro ao processar resposta da IA`)
            continue
          }

          // POST-PROCESSING: Garantir que a meta seja desafiadora
          if (!isAdvancedChallenge && topWeakness && challengeConfig.success_criteria) {
            const currentScore = topWeakness.currentScore
            const calculatedTarget = Math.min(10, Math.max(7.0, currentScore + 1.5))
            const aiTarget = challengeConfig.success_criteria.spin_min_score || 6.0

            // Se a IA colocou uma meta muito baixa, ajustar
            if (aiTarget < calculatedTarget) {
              console.log(`      🔧 Ajustando meta: ${aiTarget} → ${calculatedTarget.toFixed(1)} (score atual: ${currentScore.toFixed(1)})`)
              challengeConfig.success_criteria.spin_min_score = parseFloat(calculatedTarget.toFixed(1))
              challengeConfig.success_criteria.primary_min_score = parseFloat(calculatedTarget.toFixed(1))
            }

            // Garantir que objection_handling_min seja pelo menos 7.0
            if ((challengeConfig.success_criteria.objection_handling_min || 0) < 7.0) {
              challengeConfig.success_criteria.objection_handling_min = 7.0
            }
          }

          // Create new persona if AI suggested one
          let newPersonaId: string | null = null
          if (challengeConfig.new_persona) {
            const { data: createdPersona, error: personaError } = await supabaseAdmin
              .from('personas')
              .insert({
                company_id: company.id,
                job_title: challengeConfig.new_persona.job_title,
                cargo: challengeConfig.new_persona.job_title,
                company_type: challengeConfig.new_persona.company_type,
                tipo_empresa_faturamento: challengeConfig.new_persona.company_type,
                context: challengeConfig.new_persona.context,
                contexto: challengeConfig.new_persona.context,
                company_goals: challengeConfig.new_persona.company_goals,
                what_seeks: challengeConfig.new_persona.company_goals,
                busca: challengeConfig.new_persona.company_goals,
                business_challenges: challengeConfig.new_persona.business_challenges,
                main_pains: challengeConfig.new_persona.business_challenges,
                dores: challengeConfig.new_persona.business_challenges
              })
              .select('id')
              .single()

            if (!personaError && createdPersona) {
              newPersonaId = createdPersona.id
              console.log(`      🆕 Nova persona criada: ${challengeConfig.new_persona.job_title}`)
            }
          }

          // Create new objections if AI suggested them (avoid duplicates)
          const newObjectionIds: string[] = []
          if (challengeConfig.new_objections && Array.isArray(challengeConfig.new_objections)) {
            for (const newObj of challengeConfig.new_objections) {
              // Check if objection with same name already exists for this company
              const { data: existingObjection } = await supabaseAdmin
                .from('objections')
                .select('id')
                .eq('company_id', company.id)
                .ilike('name', newObj.name)
                .single()

              if (existingObjection) {
                // Use existing objection instead of creating duplicate
                newObjectionIds.push(existingObjection.id)
                console.log(`      ♻️ Objeção existente reutilizada: ${newObj.name}`)
              } else {
                // Create new objection
                const { data: createdObjection, error: objectionError } = await supabaseAdmin
                  .from('objections')
                  .insert({
                    company_id: company.id,
                    name: newObj.name,
                    rebuttals: newObj.rebuttals || []
                  })
                  .select('id')
                  .single()

                if (!objectionError && createdObjection) {
                  newObjectionIds.push(createdObjection.id)
                  console.log(`      🆕 Nova objeção criada: ${newObj.name}`)
                }
              }
            }
          }

          // Validate or set persona ID
          if (newPersonaId) {
            challengeConfig.roleplay_config.persona_id = newPersonaId
          } else {
            const validPersona = personas.find(p => p.id === challengeConfig.roleplay_config.persona_id)
            if (!validPersona && personas.length > 0) {
              challengeConfig.roleplay_config.persona_id = personas[0].id
            }
          }

          // Validate or set objection IDs
          if (newObjectionIds.length > 0) {
            // Combine new objections with any valid existing ones
            const validExistingIds = (challengeConfig.roleplay_config.objection_ids || []).filter(
              (id: string) => objections.some(o => o.id === id)
            )
            challengeConfig.roleplay_config.objection_ids = [...newObjectionIds, ...validExistingIds]
          } else {
            const validObjectionIds = (challengeConfig.roleplay_config.objection_ids || []).filter(
              (id: string) => objections.some(o => o.id === id)
            )
            if (validObjectionIds.length === 0 && objections.length > 0) {
              challengeConfig.roleplay_config.objection_ids = [objections[0].id]
            } else {
              challengeConfig.roleplay_config.objection_ids = validObjectionIds
            }
          }

          // For 4+ difficulty, ensure at least 2 objections
          if (isHighDifficulty) {
            const currentObjectionIds = challengeConfig.roleplay_config.objection_ids || []
            if (currentObjectionIds.length < 2 && objections.length >= 2) {
              // Add more existing objections to meet the minimum
              const missingCount = 2 - currentObjectionIds.length
              const additionalObjections = objections
                .filter(o => !currentObjectionIds.includes(o.id))
                .slice(0, missingCount)
                .map(o => o.id)
              challengeConfig.roleplay_config.objection_ids = [...currentObjectionIds, ...additionalObjections]
              console.log(`      📌 Adicionadas ${missingCount} objeção(ões) extra para atingir mínimo de 2`)
            }
          }

          // Use AI explanation as the reasoning (more user-friendly)
          const aiReasoning = challengeConfig.ai_explanation || (topWeakness ? `
Analisamos sua performance recente e identificamos uma oportunidade de melhoria em ${topWeakness.target.toUpperCase()}.

Seu score atual nessa área é ${topWeakness.currentScore.toFixed(1)}, o que indica que há espaço para evolução. ${topWeakness.pattern ? `Detectamos um padrão: ${topWeakness.pattern}.` : ''}

Este desafio foi criado especificamente para ajudá-lo a desenvolver essa habilidade através de uma simulação prática com cenários realistas.

Dificuldade: ${difficultyLevel}/5
          `.trim() : `
Este é um desafio avançado projetado para vendedores experientes.

Você não possui fraquezas críticas detectadas, então criamos um cenário desafiador para manter suas habilidades afiadas e explorar situações mais complexas.

Dificuldade: ${difficultyLevel}/5
          `.trim())

          // Remove internal fields before saving
          delete challengeConfig.ai_explanation
          delete challengeConfig.new_persona
          delete challengeConfig.new_objections

          // Save challenge to database
          const { data: newChallenge, error: insertError } = await supabaseAdmin
            .from('daily_challenges')
            .insert({
              user_id: userId,
              company_id: company.id,
              challenge_date: today,
              status: 'pending',
              difficulty_level: difficultyLevel,
              challenge_config: challengeConfig,
              ai_reasoning: aiReasoning
            })
            .select()
            .single()

          if (insertError) {
            results.push({
              userId,
              userName,
              companyId: company.id,
              companyName: company.name,
              status: 'error',
              reason: `Erro ao salvar: ${insertError.message}`
            })
            totalErrors++
            console.log(`    ❌ ${userName}: erro ao salvar desafio`)
            continue
          }

          // Consume credit
          currentCreditsUsed += CHALLENGE_GENERATION_CREDIT_COST
          await supabaseAdmin
            .from('companies')
            .update({ monthly_credits_used: currentCreditsUsed })
            .eq('id', company.id)

          totalCreditsUsed += CHALLENGE_GENERATION_CREDIT_COST
          totalGenerated++

          results.push({
            userId,
            userName,
            companyId: company.id,
            companyName: company.name,
            status: 'success',
            challengeId: newChallenge.id
          })

          console.log(`    ✅ ${userName}: desafio ${isAdvancedChallenge ? 'AVANÇADO ' : ''}gerado (${challengeConfig.title})`)

        } catch (error) {
          results.push({
            userId,
            userName,
            companyId: company.id,
            companyName: company.name,
            status: 'error',
            reason: error instanceof Error ? error.message : String(error)
          })
          totalErrors++
          console.log(`    ❌ ${userName}: erro - ${error instanceof Error ? error.message : String(error)}`)
        }
      }
    }

    console.log(`\n${'='.repeat(60)}`)
    console.log(`📊 RESUMO DA GERAÇÃO MANUAL`)
    console.log(`${'='.repeat(60)}`)
    console.log(`✅ Gerados: ${totalGenerated}`)
    console.log(`⏭️ Pulados: ${totalSkipped}`)
    console.log(`❌ Erros: ${totalErrors}`)
    console.log(`💰 Créditos usados: ${totalCreditsUsed}`)
    console.log(`${'='.repeat(60)}\n`)

    // Store last manual generation info
    await supabaseAdmin
      .from('system_settings')
      .upsert({
        key: 'last_manual_challenge_generation',
        value: {
          timestamp: new Date().toISOString(),
          generated: totalGenerated,
          skipped: totalSkipped,
          errors: totalErrors,
          creditsUsed: totalCreditsUsed
        }
      }, { onConflict: 'key' })

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        generated: totalGenerated,
        skipped: totalSkipped,
        errors: totalErrors,
        creditsUsed: totalCreditsUsed
      },
      results
    })

  } catch (error) {
    console.error('💥 [admin/challenges/generate-now] Erro:', error)
    return NextResponse.json(
      { error: 'Erro interno', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
