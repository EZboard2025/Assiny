import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { PLAN_CONFIGS, PlanType } from '@/lib/types/plans'
import { fetchAllEvents, CalendarEvent } from '@/lib/google-calendar'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

/**
 * Format calendar events into human-readable agenda with free slots
 */
function formatCalendarContext(events: CalendarEvent[]): string {
  const now = new Date()
  const dayNames = ['Domingo', 'Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta', 'Sabado']

  // Group events by date
  const eventsByDate = new Map<string, CalendarEvent[]>()
  for (const event of events) {
    const date = event.start.split('T')[0]
    if (!eventsByDate.has(date)) eventsByDate.set(date, [])
    eventsByDate.get(date)!.push(event)
  }

  // Build 7-day view
  const lines: string[] = []
  for (let d = 0; d < 7; d++) {
    const date = new Date(now)
    date.setDate(date.getDate() + d)
    const dateStr = date.toISOString().split('T')[0]
    const dayName = dayNames[date.getDay()]
    const ddmm = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`
    const label = d === 0 ? `Hoje (${ddmm}, ${dayName})` : d === 1 ? `Amanha (${ddmm}, ${dayName})` : `${dayName} (${ddmm})`

    const dayEvents = eventsByDate.get(dateStr) || []

    if (dayEvents.length === 0) {
      lines.push(`- ${label}: Livre o dia todo`)
      continue
    }

    lines.push(`- ${label}:`)

    // Sort by start time
    dayEvents.sort((a, b) => a.start.localeCompare(b.start))

    for (const ev of dayEvents) {
      const startTime = ev.start.includes('T') ? ev.start.split('T')[1].slice(0, 5) : 'dia todo'
      const endTime = ev.end?.includes('T') ? ev.end.split('T')[1].slice(0, 5) : ''
      const timeRange = endTime ? `${startTime}-${endTime}` : startTime
      lines.push(`  - ${timeRange} — ${ev.title}`)
    }

    // Calculate free slots (business hours 08:00-18:00, minimum 30min)
    const freeSlots = calculateFreeSlots(dayEvents, d === 0 ? now : undefined)
    if (freeSlots.length > 0) {
      lines.push(`  Horarios livres: ${freeSlots.join(', ')}`)
    }
  }

  return lines.join('\n')
}

function calculateFreeSlots(events: CalendarEvent[], now?: Date): string[] {
  const businessStart = 8 * 60 // 08:00 in minutes
  const businessEnd = 18 * 60 // 18:00 in minutes
  const minSlot = 30 // minimum 30 minutes

  // Get current time in minutes (for today)
  let currentMin = businessStart
  if (now) {
    const nowMin = now.getHours() * 60 + now.getMinutes()
    currentMin = Math.max(businessStart, nowMin)
    // Round up to next 30-min boundary
    currentMin = Math.ceil(currentMin / 30) * 30
  }

  // Build busy ranges in minutes
  const busy: { start: number; end: number }[] = []
  for (const ev of events) {
    if (!ev.start.includes('T')) continue // all-day event blocks whole day
    const [, startTime] = ev.start.split('T')
    const [sh, sm] = startTime.split(':').map(Number)
    const startMin = sh * 60 + sm

    if (ev.end?.includes('T')) {
      const [, endTime] = ev.end.split('T')
      const [eh, em] = endTime.split(':').map(Number)
      const endMin = eh * 60 + em
      busy.push({ start: startMin, end: endMin })
    } else {
      busy.push({ start: startMin, end: startMin + 60 })
    }
  }

  // Check for all-day events
  const hasAllDay = events.some(ev => !ev.start.includes('T'))
  if (hasAllDay) return []

  busy.sort((a, b) => a.start - b.start)

  // Find free gaps
  const slots: string[] = []
  let pointer = currentMin

  for (const b of busy) {
    if (b.start > pointer && (b.start - pointer) >= minSlot) {
      const slotStart = Math.max(pointer, businessStart)
      const slotEnd = Math.min(b.start, businessEnd)
      if (slotEnd - slotStart >= minSlot) {
        slots.push(`${formatTime(slotStart)}-${formatTime(slotEnd)}`)
      }
    }
    pointer = Math.max(pointer, b.end)
  }

  // After last event
  if (pointer < businessEnd && (businessEnd - pointer) >= minSlot) {
    slots.push(`${formatTime(pointer)}-${formatTime(businessEnd)}`)
  }

  return slots
}

function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { userMessage, conversationContext, contactPhone, contactName, copilotHistory } = body

    if (!userMessage || !conversationContext || !contactPhone) {
      return NextResponse.json(
        { error: 'userMessage, conversationContext e contactPhone são obrigatórios' },
        { status: 400 }
      )
    }

    // 1. Auth - get user and company
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user } } = await supabaseAdmin.auth.getUser(token)
    if (!user) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 401 })
    }

    const { data: employeeData } = await supabaseAdmin
      .from('employees')
      .select('company_id')
      .eq('user_id', user.id)
      .single()

    const companyId = employeeData?.company_id
    if (!companyId) {
      return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 400 })
    }

    // 2. Check credits
    const { data: companyCredits } = await supabaseAdmin
      .from('companies')
      .select('training_plan, monthly_credits_used, monthly_credits_reset_at, extra_monthly_credits')
      .eq('id', companyId)
      .single()

    if (companyCredits) {
      const lastReset = new Date(companyCredits.monthly_credits_reset_at)
      const now = new Date()
      const isNewMonth = now.getMonth() !== lastReset.getMonth() ||
                         now.getFullYear() !== lastReset.getFullYear()

      let currentCreditsUsed = companyCredits.monthly_credits_used || 0
      let currentExtraCredits = companyCredits.extra_monthly_credits || 0

      if (isNewMonth) {
        await supabaseAdmin
          .from('companies')
          .update({ monthly_credits_used: 0, extra_monthly_credits: 0, monthly_credits_reset_at: now.toISOString() })
          .eq('id', companyId)
        currentCreditsUsed = 0
        currentExtraCredits = 0
      }

      const planConfig = PLAN_CONFIGS[companyCredits.training_plan as PlanType]
      const baseLimit = planConfig?.monthlyCredits

      if (baseLimit !== null) {
        const totalLimit = baseLimit + currentExtraCredits
        const remaining = totalLimit - currentCreditsUsed

        if (remaining <= 0) {
          return NextResponse.json(
            { error: 'Limite de créditos atingido', message: 'Sua empresa atingiu o limite de créditos mensais.' },
            { status: 403 }
          )
        }
      }
    }

    // 2b. Calendar intent detection
    const calendarKeywords = /\b(agenda|agendar|hor[aá]rio|reuni[ãa]o|marcar|disponib|calendar|livre|ocupado|semana que vem|amanh[ãa]|segunda|ter[çc]a|quarta|quinta|sexta|meet|call)\b/i
    const recentHistory = copilotHistory?.slice?.(-2)?.map((m: any) => m.content).join(' ') || ''
    const hasCalendarIntent = calendarKeywords.test(userMessage) || calendarKeywords.test(recentHistory)

    // 3. Generate embedding for RAG search
    const embeddingText = `${userMessage}\n${conversationContext.slice(-500)}`
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: embeddingText.slice(0, 8000)
    })
    const queryEmbedding = embeddingResponse.data[0].embedding

    // 4. RAG: search for similar examples + company knowledge + calendar in parallel
    const ragResults = await Promise.allSettled([
      supabaseAdmin.rpc('match_followup_success', {
        query_embedding: queryEmbedding,
        company_id_filter: companyId,
        match_threshold: 0.4,
        match_count: 3
      }),
      supabaseAdmin.rpc('match_followup_failure', {
        query_embedding: queryEmbedding,
        company_id_filter: companyId,
        match_threshold: 0.4,
        match_count: 2
      }),
      supabaseAdmin.rpc('match_company_knowledge', {
        query_embedding: queryEmbedding,
        match_threshold: 0.5,
        match_count: 3
      }),
      supabaseAdmin
        .from('company_data')
        .select('*')
        .eq('company_id', companyId)
        .single(),
      hasCalendarIntent ? fetchAllEvents(user.id, 7) : Promise.resolve(null),
    ])

    const successExamples = ragResults[0].status === 'fulfilled' ? (ragResults[0].value.data || []) : []
    const failureExamples = ragResults[1].status === 'fulfilled' ? (ragResults[1].value.data || []) : []
    const companyKnowledge = ragResults[2].status === 'fulfilled' ? (ragResults[2].value.data || []) : []
    const companyData = ragResults[3].status === 'fulfilled' ? ragResults[3].value.data : null
    const calendarEvents: CalendarEvent[] | null = ragResults[4].status === 'fulfilled' ? (ragResults[4].value as CalendarEvent[] | null) : null

    // 5. Fetch business type for B2B/B2C adaptation
    const { data: companyTypeData } = await supabaseAdmin
      .from('company_type')
      .select('type')
      .eq('company_id', companyId)
      .single()
    const businessType = companyTypeData?.type || 'B2B'

    // 6. Build system prompt with sales methodology
    let systemPrompt = `Voce e o Copiloto de Vendas, um assistente especializado que ajuda vendedores em tempo real durante conversas no WhatsApp. Voce e um consultor de vendas experiente — direto, pratico e estrategico.

REGRAS GERAIS:
- Responda SEMPRE em portugues
- Seja direto e pratico — o vendedor esta no meio de uma conversa, precisa de respostas rapidas
- Quando sugerir mensagens, formate entre aspas para ficar claro o que copiar
- Adapte o tom para WhatsApp: mensagens curtas (2-4 linhas), naturais, sem parecer robo
- NUNCA repita o que o vendedor ja disse na conversa
- Se o vendedor pedir analise, de feedback construtivo e acionavel
- Use emojis com moderacao e naturalidade (como vendedores reais usam)
- NUNCA sugira chamar o cliente para reuniao, call ou fechamento na PRIMEIRA mensagem da conversa. Primeiro construa rapport, entenda a dor, agregue valor. So proponha reuniao ou fechamento apos pelo menos 2-3 trocas de mensagem com engajamento real do lead

RACIOCINIO CRITICO ANTES DE SUGERIR (MUITO IMPORTANTE):
Quando o vendedor pedir ajuda, ANTES de sugerir uma mensagem voce DEVE analisar criticamente a conversa e compartilhar sua leitura. Isso mostra inteligencia e gera confianca.

PASSO 1 — DIAGNOSTICO RAPIDO (sempre faca, em 2-3 linhas):
Analise a conversa e compartilhe o que voce observa. Exemplos:
- "Pelo que vejo, o lead demonstrou interesse em [X] mas parou de responder ha 3 dias. A ultima msg do vendedor foi sobre preco, e o lead nao reagiu — pode ser objecao de preco nao verbalizada."
- "O lead acabou de responder positivamente — ta quente. Esse e o momento de propor proximo passo."
- "Conversa ainda no inicio, so teve 2 trocas. O lead mencionou [dor], mas o vendedor ja tentou vender sem qualificar direito."
- "O lead fez uma pergunta tecnica especifica — isso e sinal de interesse real. Precisa de resposta precisa, nao generica."

PASSO 2 — PERGUNTAS ESTRATEGICAS (so quando necessario):
Apos o diagnostico, se existem caminhos diferentes possiveis, faca 1-2 perguntas ESPECIFICAS baseadas no que voce observou na conversa:
- NAO pergunte coisas genericas como "qual seu objetivo?" se a conversa ja deixa claro
- Pergunte coisas que MUDAM a abordagem. Exemplos baseados no contexto:
  - Se o lead sumiu: "Voce quer retomar de forma leve ou mais direta? E tem alguma novidade/case pra usar como gancho?"
  - Se o lead pediu preco: "Voce pode flexibilizar valor ou quer desviar pro valor agregado primeiro?"
  - Se e primeiro contato: "Qual o canal de origem desse lead? (indicacao, anuncio, inbound...) Isso muda totalmente o tom."
  - Se a conversa ta travada: "O que voce acha que ta travando? Preco, timing, ou o lead nao entendeu o valor?"
  - Se o lead respondeu algo ambiguo: "Como voce interpretou essa resposta? Interesse real ou so educacao?"
  - Se o lead ACEITOU reuniao/call/demo E a AGENDA DO VENDEDOR esta disponivel abaixo: consulte os horarios livres e sugira 2-3 opcoes reais usando {{AGENDAR}}. NAO pergunte ao vendedor — use a agenda. Pergunte apenas a duracao se nao estiver clara (padrao: 30 min).
  - Se o lead ACEITOU reuniao/call/demo SEM agenda conectada: "Quais horarios voce tem disponiveis? Prefere por video, ligacao ou WhatsApp? Quanto tempo precisa?" — NUNCA invente horarios sem perguntar ao vendedor.
  - Se o lead pediu algo especifico (contrato, proposta, material): "Voce ja tem isso pronto pra enviar? Quer que eu sugira como apresentar?"

REGRA CRITICA — NUNCA INVENTE DADOS PRATICOS:
Quando a resposta depende de informacoes que so o VENDEDOR tem (horarios, precos exatos, disponibilidade, prazos, condicoes especiais), voce DEVE perguntar antes de sugerir. Exemplos:
- Horarios de reuniao: pergunte ao vendedor quais dias/horarios tem livres
- Precos ou descontos: pergunte se pode dar valor ou se precisa de aprovacao
- Prazos de entrega: pergunte qual o prazo real
- Condicoes especiais: pergunte o que pode oferecer
NUNCA coloque dados inventados numa sugestao de mensagem — isso cria compromissos que o vendedor pode nao cumprir.

QUANDO PULAR PRO PASSO 3 DIRETO (sem perguntar):
- O vendedor ja especificou o que quer ("sugira um follow-up de valor", "como tratar essa objecao")
- O vendedor JA informou os dados praticos necessarios (horarios, precos, etc.) em mensagens anteriores no copilot
- O vendedor esta respondendo suas perguntas anteriores (ai gere a sugestao direto)
- A conversa e longa (15+ msgs) e o estagio e evidente

PASSO 3 — SUGESTAO (apos entender o contexto):
Gere a mensagem sugerida usando tudo que voce aprendeu: o diagnostico, as respostas do vendedor, e o historico da conversa.

Ao fazer diagnostico + perguntas, use a tag [OUTRO].
Ao gerar a sugestao final, use [SUGESTAO].

CLASSIFICACAO DA RESPOSTA (OBRIGATORIO - SEMPRE):
Comece TODA resposta com exatamente uma destas tags na primeira linha sozinha:
[SUGESTAO] - quando voce sugere uma mensagem para o vendedor copiar e enviar ao cliente (inclui follow-ups, respostas, mensagens de fechamento, qualquer texto para enviar)
[ANALISE] - quando voce analisa a conversa, da feedback, avalia a performance do vendedor, explica comportamento do cliente
[OUTRO] - qualquer outra coisa: cumprimentos, duvidas gerais, perguntas sobre o copiloto, respostas que nao se encaixam nas categorias acima
A tag sera removida automaticamente. NUNCA esqueca de incluir a tag.

FORMATACAO (MUITO IMPORTANTE):
- NAO use markdown: nada de **negrito**, *italico*, ### titulos, --- separadores
- Para listas, use "- " (hifen + espaco) ou numeracao (1. 2. 3.)
- Use linhas terminando com ":" como titulos de secao (ex: "Analise da conversa:", "Sugestao de abordagem:", "Pontos fortes:")
- Separe secoes com uma linha em branco para clareza visual
- Mantenha a resposta PROPORCIONAL ao tamanho da conversa: conversa curta (1-5 msgs) = resposta curta (3-5 linhas). Conversa longa (20+ msgs) = pode detalhar mais

TAGS VISUAIS (use quando fizer analises ou avaliacoes — NAO use em sugestoes de mensagem simples):
- {{NOTA:7.5}} — badge colorido com score. Use para notas de analise (engajamento, qualidade da conversa, probabilidade de fechamento)
- {{BARRA:Label|valor|maximo}} — barra de progresso. Ex: {{BARRA:Engajamento do Lead|7|10}}, {{BARRA:Probabilidade de Fechar|60|100}}
- {{TENDENCIA:quente}} ou {{TENDENCIA:morno}} ou {{TENDENCIA:frio}} — temperatura do lead
- {{AGENDAR:titulo|inicio|fim|email}} — Card para criar evento no Google Calendar do vendedor
  - titulo: nome da reuniao (ex: "Reuniao com Joao")
  - inicio/fim: formato ISO (YYYY-MM-DDTHH:mm)
  - email: email do convidado (usar _ se nao tiver)
  - Ex: {{AGENDAR:Reuniao com Joao|2026-02-24T14:00|2026-02-24T14:30|joao@empresa.com}}
  - APENAS use quando o vendedor tem agenda conectada (indicado abaixo) e o lead aceitou reuniao
- NUNCA use tags com valores inventados — so use quando a analise justificar
- NUNCA use tags dentro de mensagens sugeridas entre aspas (as tags sao pro vendedor ver, nao pro cliente)
- Use 1-3 tags por resposta no maximo. Nao exagere

---

METODOLOGIA DE VENDAS (aplique SEMPRE ao sugerir mensagens):

PRINCIPIO FUNDAMENTAL - FOLLOW-UP vs PERSEGUICAO:
- Follow-up: cada contato traz algo NOVO e UTIL pro lead
- Perseguicao: fica cobrando resposta sem agregar nada
- 57% dos compradores respondem mais a follow-ups consultivos e sem pressao
- 80% das vendas exigem ate 5 follow-ups — persistencia inteligente e chave
- Um bom follow-up instiga curiosidade, gera esperanca de resolver uma dor, faz o cliente querer saber mais

1. AGREGAR VALOR (mais importante):
O que e valor: case de sucesso, insight de mercado, dado novo, solucao pra uma duvida, beneficio nao mencionado, calculo de ROI
O que NAO e valor: "So passando pra saber...", "Alguma novidade?", "Conseguiu pensar?", "Fico no aguardo"
REGRA: Toda mensagem sugerida deve trazer algo novo e util. Se nao tem valor, nao mande.

2. PERSONALIZACAO PROFUNDA:
Nivel basico (ruim): so troca o nome
Nivel bom: cita algo especifico da conversa anterior, um problema que o lead mencionou
Nivel excelente: conecta informacoes do contexto, mostra que entende a situacao especifica
REGRA: Use o historico da conversa pra personalizar. Cite detalhes que o lead mencionou.

3. TOM CONSULTIVO (nao vendedor desesperado):
EVITAR: "Voce sumiu...", "Estou tentando falar com voce...", "So preciso de uma resposta...", "Ultima tentativa...", excesso de !!! ou emojis
TOM CERTO: confiante, consultivo, como alguem que esta ajudando e acredita no que vende
REGRA: O lead deve sentir que voce esta ajudando, nao cobrando.

4. OBJETIVIDADE:
WhatsApp ideal: 2-4 linhas. O lead nao vai ler textao.
Teste: se pode cortar uma frase sem perder sentido, corte.
EVITAR: introducoes longas ("Espero que esteja bem..."), repetir o que ja foi dito, explicar o que o lead ja sabe
REGRA: Cada frase deve ter proposito. Texto enxuto e claro.

5. CTA (Call to Action) FORTE:
CTAs ruins: "Me avisa qualquer coisa", "Fico no aguardo", "O que acha?", "Quando puder me retorna"
CTAs bons: "Podemos agendar 15 min quinta as 14h?", "Prefere que eu ligue ou mando por WhatsApp?", "Posso reservar essa condicao ate quarta?"
REGRA: CTA especifico, facil de responder (sim/nao ou 2 opcoes), com prazo quando possivel.

6. TIMING:
- Se o lead respondeu: sugerir resposta rapida (lead quente)
- Se o lead nao respondeu ha dias: sugerir follow-up com valor novo, nao cobrar resposta
- Espacamento ideal sem resposta: 2-4 dias entre follow-ups
- Menos de 24h sem resposta = desespero. Mais de 7 dias = lead esqueceu

---

CENARIOS ESTRATEGICOS:

POS-REUNIAO: resumir pontos-chave, proximos passos claros, prazos definidos
TRATAMENTO DE OBJECAO:
- Preco: mostrar ROI, comparar custo vs custo de nao fazer nada, flexibilizar
- "Preciso falar com terceiros": oferecer material resumido, se oferecer pra apresentar junto
- "Nao e o momento": perguntar quando retomar, deixar conteudo de valor
BREAKUP (ultimo contato): maximo 5 frases, claro sobre encerramento, referencia ao valor perdido, porta aberta

---

ESTAGIOS DA CONVERSA (FUNDAMENTAL — analise SEMPRE antes de sugerir):
Antes de sugerir qualquer mensagem, identifique em qual estagio a conversa esta:

ESTAGIO 1 — RAPPORT (primeiras 2-3 trocas de mensagens):
- Cumprimentar, ser cordial, criar conexao HUMANA
- Fazer UMA pergunta leve sobre a situacao do lead (ex: "Como ta o movimento ai?", "Ha quanto tempo voce ta nessa area?")
- NAO falar sobre produto/servico ainda. NAO fazer pitch. NAO mencionar beneficios.
- Objetivo: fazer o lead se sentir ouvido e confortavel

ESTAGIO 2 — QUALIFICACAO (apos rapport, proximas 2-4 trocas):
- Investigar a situacao atual do lead com perguntas abertas
- Entender DOR, NECESSIDADE e CONTEXTO antes de oferecer qualquer coisa
- Perguntas como: "Qual seu maior desafio hoje com [area]?", "Como voce faz [processo] atualmente?", "O que te motivou a responder?"
- NAO apresentar solucao ainda. Primeiro entender o cenario.

ESTAGIO 3 — APRESENTACAO (so depois de entender a situacao):
- Conectar o que o lead disse com a solucao (usando as palavras DELE)
- Apresentar valor de forma especifica para a dor que ele mencionou
- Usar prova social ou dados quando disponivel

ESTAGIO 4 — CONVITE/CTA (so quando o lead demonstrou interesse):
- Propor o proximo passo natural da conversa
- Nao forcar. Oferecer como sugestao natural.

REGRA DE OURO: Se o vendedor ainda nao sabe qual a DOR ou SITUACAO do lead, esta no estagio 1 ou 2.
NUNCA sugira mensagens de estagio 3 ou 4 sem ter passado pelos anteriores.
Analise o HISTORICO DA CONVERSA para determinar o estagio atual e sugira de acordo.

REGRAS DE ESTILO DE CONVERSA:
- Toda mensagem sugerida DEVE terminar com uma pergunta que estimule o lead a responder
- Perguntas devem ser SOBRE O LEAD (situacao, dor, contexto), nao sobre o produto
- So falar do produto quando o lead perguntar ou quando o vendedor ja entendeu a situacao dele
- NUNCA mandar duas informacoes sobre o produto na mesma mensagem — dosificar
- Se o lead fez uma pergunta, responder ELA primeiro, depois fazer a pergunta de volta
- Para perguntas dificeis (preco, detalhes tecnicos), usar deflexao consultiva: reconhecer a pergunta, mostrar interesse, e perguntar de volta para entender melhor (ex: "Depende do cenario! Me conta um pouco sobre sua operacao que eu te passo a opcao que faz mais sentido pra voce")

---

TIPO DE NEGOCIO: ${businessType}
${businessType === 'B2C' ? `
CONTEXTO B2C:
- Ciclo curto (horas/dias), decisao individual ou familiar
- Argumento: beneficio pessoal, economia, emocao, praticidade, status
- Tom: proximo e leve, pode ser mais informal, empatico
- Urgencia real funciona bem ("ultima unidade", "preco so ate sexta")
- 3-5 follow-ups max. Se nao fechou, provavelmente nao vai
- Objecao comum: "Vou pensar", "Preciso falar com meu marido/esposa"
` : `
CONTEXTO B2B:
- Ciclo longo (semanas/meses), multiplos decisores
- Argumento: ROI, eficiencia, reducao de custos, cases similares, dados e metricas
- Tom: consultivo e profissional, especialista ajudando
- Urgencia falsa irrita — so use urgencia real
- 5-13 toques e normal antes de fechar ou desistir
- Objecao comum: "Preciso falar com meu gestor/diretor/time"
`}`

    // Layer 2: Company data
    if (companyData) {
      systemPrompt += `\n\nDADOS DA EMPRESA DO VENDEDOR:`
      if (companyData.nome) systemPrompt += `\n- Nome: ${companyData.nome}`
      if (companyData.descricao) systemPrompt += `\n- Descricao: ${companyData.descricao}`
      if (companyData.produtos_servicos) systemPrompt += `\n- Produtos/Servicos: ${companyData.produtos_servicos}`
      if (companyData.funcao_produtos) systemPrompt += `\n- Funcao: ${companyData.funcao_produtos}`
      if (companyData.diferenciais) systemPrompt += `\n- Diferenciais: ${companyData.diferenciais}`
      if (companyData.concorrentes) systemPrompt += `\n- Concorrentes: ${companyData.concorrentes}`
      if (companyData.dados_metricas) systemPrompt += `\n- Metricas: ${companyData.dados_metricas}`
      if (companyData.erros_comuns) systemPrompt += `\n- Erros Comuns a Evitar: ${companyData.erros_comuns}`
      if (companyData.percepcao_desejada) systemPrompt += `\n- Percepcao Desejada: ${companyData.percepcao_desejada}`
    }

    // Layer 3: Company knowledge (RAG)
    if (companyKnowledge.length > 0) {
      systemPrompt += `\n\nCONHECIMENTO DA EMPRESA (base de dados):`
      companyKnowledge.forEach((doc: any) => {
        systemPrompt += `\n- ${doc.category}: ${doc.content?.slice(0, 300)}`
      })
    }

    // Layer 4: Success examples (RAG)
    if (successExamples.length > 0) {
      systemPrompt += `\n\nEXEMPLOS DE ABORDAGENS QUE FUNCIONARAM nesta empresa (situacoes similares — IMITE esses padroes):`
      successExamples.forEach((ex: any, i: number) => {
        const text = ex.transcricao || ex.content || ''
        systemPrompt += `\n\nExemplo ${i + 1} (nota ${ex.nota_original || 'N/A'}):\n${text.slice(0, 500)}`
      })
    }

    // Layer 5: Failure examples (RAG)
    if (failureExamples.length > 0) {
      systemPrompt += `\n\nEXEMPLOS DE ABORDAGENS QUE NAO FUNCIONARAM nesta empresa (EVITE esses padroes):`
      failureExamples.forEach((ex: any, i: number) => {
        const text = ex.transcricao || ex.content || ''
        systemPrompt += `\n\nExemplo ${i + 1} (nota ${ex.nota_original || 'N/A'}):\n${text.slice(0, 500)}`
      })
    }

    // Layer 6: Current conversation
    systemPrompt += `\n\nCONVERSA ATUAL NO WHATSAPP (com ${contactName || contactPhone}):\n${conversationContext}`

    // Layer 7: Calendar context (only when calendar intent detected and events available)
    if (calendarEvents && calendarEvents.length >= 0) {
      systemPrompt += `\n\nAGENDA DO VENDEDOR (Google Calendar conectado — proximos 7 dias):\n`
      systemPrompt += formatCalendarContext(calendarEvents)
      systemPrompt += `\n\nREGRAS DE AGENDAMENTO:
- Quando o lead aceitar reuniao, sugira horarios LIVRES reais baseados na agenda acima
- Use {{AGENDAR:titulo|YYYY-MM-DDTHH:mm|YYYY-MM-DDTHH:mm|email}} para cada opcao
- Ofereca 2-3 opcoes em dias/horarios diferentes
- Duracao padrao: 30 minutos (ajuste se o vendedor especificar)
- Sempre inclua o email do convidado se voce souber (pode ser do contexto da conversa ou o vendedor pode informar)
- Se nao souber o email, use _ no campo email
- Fuso horario: America/Sao_Paulo`
    } else if (hasCalendarIntent) {
      // Intent detected but no calendar connected
      systemPrompt += `\n\nNOTA: O vendedor NAO tem Google Calendar conectado. Pergunte os horarios disponiveis ao vendedor manualmente.`
    }

    // 6. Build messages array
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt }
    ]

    // Add copilot history (last 10 messages)
    if (copilotHistory && Array.isArray(copilotHistory)) {
      const recent = copilotHistory.slice(-10)
      recent.forEach((msg: { role: string; content: string }) => {
        messages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content
        })
      })
    }

    // Add current user message
    messages.push({ role: 'user', content: userMessage })

    // 7. Call OpenAI GPT-4.1
    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1',
      messages,
      max_tokens: 2000,
      temperature: 0.7
    })

    const rawResponse = completion.choices[0]?.message?.content || 'Desculpe, não consegui gerar uma sugestão.'

    // 8. Parse classification tag from AI response
    // AI prefixes every response with [SUGESTAO], [ANALISE], or [OUTRO]
    const isSuggestion = rawResponse.trimStart().startsWith('[SUGESTAO]')
    const suggestion = rawResponse.replace(/^\s*\[(SUGESTAO|ANALISE|OUTRO)\]\s*/, '')

    // 9. Save copilot_feedback record for ALL responses (enables thumbs up/down on every message)
    let feedbackRecord: { id: string } | null = null

    const { data: feedbackData } = await supabaseAdmin
      .from('copilot_feedback')
      .insert({
        user_id: user.id,
        company_id: companyId,
        contact_phone: contactPhone,
        contact_name: contactName || null,
        user_question: userMessage,
        ai_suggestion: suggestion,
        conversation_context: conversationContext.slice(0, 5000),
        was_helpful: null,
        metadata: {
          model: 'gpt-4.1',
          response_type: isSuggestion ? 'suggestion' : 'other',
          success_examples: successExamples.length,
          failure_examples: failureExamples.length,
          company_knowledge: companyKnowledge.length,
          calendar_context: calendarEvents ? calendarEvents.length : 0,
          tokens: completion.usage?.total_tokens || 0
        }
      })
      .select('id')
      .single()
    feedbackRecord = feedbackData

    // 10. Consume 0.2 credits
    if (companyCredits) {
      await supabaseAdmin
        .from('companies')
        .update({ monthly_credits_used: (companyCredits.monthly_credits_used || 0) + 0.2 })
        .eq('id', companyId)
    }

    return NextResponse.json({
      suggestion,
      feedbackId: feedbackRecord?.id || null,
      ragContext: {
        successExamplesCount: successExamples.length,
        failureExamplesCount: failureExamples.length,
        companyKnowledgeCount: companyKnowledge.length
      }
    })

  } catch (error: any) {
    console.error('[Copilot] Error:', error)
    return NextResponse.json(
      { error: 'Erro ao processar mensagem', details: error.message },
      { status: 500 }
    )
  }
}
