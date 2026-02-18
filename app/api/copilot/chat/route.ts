import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { PLAN_CONFIGS, PlanType } from '@/lib/types/plans'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

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

    // 3. Generate embedding for RAG search
    const embeddingText = `${userMessage}\n${conversationContext.slice(-500)}`
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: embeddingText.slice(0, 8000)
    })
    const queryEmbedding = embeddingResponse.data[0].embedding

    // 4. RAG: search for similar examples + company knowledge in parallel
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
        .single()
    ])

    const successExamples = ragResults[0].status === 'fulfilled' ? (ragResults[0].value.data || []) : []
    const failureExamples = ragResults[1].status === 'fulfilled' ? (ragResults[1].value.data || []) : []
    const companyKnowledge = ragResults[2].status === 'fulfilled' ? (ragResults[2].value.data || []) : []
    const companyData = ragResults[3].status === 'fulfilled' ? ragResults[3].value.data : null

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

    // 9. Save copilot_feedback record ONLY for suggestion messages
    let feedbackRecord: { id: string } | null = null

    if (isSuggestion) {
      const { data } = await supabaseAdmin
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
            success_examples: successExamples.length,
            failure_examples: failureExamples.length,
            company_knowledge: companyKnowledge.length,
            tokens: completion.usage?.total_tokens || 0
          }
        })
        .select('id')
        .single()
      feedbackRecord = data
    }

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
