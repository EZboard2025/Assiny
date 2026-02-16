import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { PLAN_CONFIGS, PlanType } from '@/lib/types/plans'
import { sendAutopilotMessage, pushAutopilotEvent } from '@/lib/whatsapp-client'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

// Last-resort dedup: prevent the same contact from being processed twice within 90s
// This catches duplicates even when in-memory guards in whatsapp-client.ts are bypassed
const globalForRespond = globalThis as unknown as { autopilotRespondDedup?: Map<string, number> }
if (!globalForRespond.autopilotRespondDedup) {
  globalForRespond.autopilotRespondDedup = new Map()
}
const respondDedup = globalForRespond.autopilotRespondDedup

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { userId, contactPhone, contactName, incomingMessage, companyId, mode = 'respond' } = body

    if (!userId || !contactPhone || !incomingMessage || !companyId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Dedup check: skip if this userId+contact+mode was processed very recently
    const phoneSuffix9 = contactPhone.replace(/[^0-9]/g, '').slice(-9)
    const dedupKey = `${userId}:${phoneSuffix9}:${mode}`
    const lastProcessed = respondDedup.get(dedupKey)
    if (lastProcessed && Date.now() - lastProcessed < 90_000) {
      console.log(`[Autopilot] Dedup: ${contactPhone} ${mode} was processed ${Math.round((Date.now() - lastProcessed) / 1000)}s ago — skipping`)
      return NextResponse.json({ action: 'skipped_dedup' })
    }
    // Mark as processing NOW (before the AI call) to block concurrent requests
    respondDedup.set(dedupKey, Date.now())
    setTimeout(() => respondDedup.delete(dedupKey), 120_000) // Auto-cleanup after 2 min

    const isComplement = mode === 'complement'
    console.log(`[Autopilot] Processing ${isComplement ? 'COMPLEMENT' : 'response'} for ${contactPhone} (user ${userId})`)

    // 1. Load autopilot config
    const { data: configs, error: configError } = await supabaseAdmin
      .from('autopilot_config')
      .select('*')
      .eq('user_id', userId)
      .limit(1)

    if (configError) {
      console.error(`[Autopilot] Config query error:`, configError.message)
      return NextResponse.json({ action: 'skipped_error', reason: configError.message }, { status: 500 })
    }

    const config = configs?.[0]
    if (!config?.enabled) {
      console.log(`[Autopilot] Config not enabled for user ${userId}`)
      return NextResponse.json({ action: 'skipped_disabled' })
    }

    const settings = config.settings || {}

    // 2. Check working hours
    if (settings.working_hours_only) {
      const now = new Date()
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      const start = settings.working_hours_start || '08:00'
      const end = settings.working_hours_end || '18:00'

      if (currentTime < start || currentTime > end) {
        console.log(`[Autopilot] Outside working hours (${currentTime}, range ${start}-${end})`)

        await supabaseAdmin.from('autopilot_log').insert({
          user_id: userId,
          company_id: companyId,
          contact_phone: contactPhone,
          contact_name: contactName,
          incoming_message: incomingMessage.slice(0, 2000),
          action: 'skipped_hours',
          ai_reasoning: `Fora do horário comercial (${currentTime})`
        })

        pushAutopilotEvent('response_skipped', userId, contactPhone, contactName, `Fora do horário (${currentTime})`)
        return NextResponse.json({ action: 'skipped_hours' })
      }
    }

    // 3. Check daily limit for this contact (suffix match for phone format compatibility)
    const phoneSuffix = contactPhone.replace(/[^0-9]/g, '').slice(-9)
    const { data: allContacts } = await supabaseAdmin
      .from('autopilot_contacts')
      .select('*')
      .eq('user_id', userId)
      .eq('enabled', true)

    const contactRecord = allContacts?.find(c => {
      const cSuffix = c.contact_phone.replace(/@.*$/, '').replace(/[^0-9]/g, '').slice(-9)
      return cSuffix === phoneSuffix
    })

    if (!contactRecord || contactRecord.objective_reached) {
      return NextResponse.json({ action: 'skipped_not_monitored' })
    }
    // Use the stored phone for DB updates
    const storedPhone = contactRecord.contact_phone

    // Reset daily counter if last response was on a different day
    let dailyCount = contactRecord.auto_responses_today || 0
    if (contactRecord.last_auto_response_at) {
      const lastDate = new Date(contactRecord.last_auto_response_at).toDateString()
      const today = new Date().toDateString()
      if (lastDate !== today) {
        dailyCount = 0
      }
    }

    const maxPerDay = settings.max_responses_per_contact_per_day || 5
    if (!isComplement && dailyCount >= maxPerDay) {
      console.log(`[Autopilot] Daily limit reached for ${contactPhone} (${dailyCount}/${maxPerDay})`)

      await supabaseAdmin.from('autopilot_log').insert({
        user_id: userId,
        company_id: companyId,
        contact_phone: contactPhone,
        contact_name: contactName,
        incoming_message: incomingMessage.slice(0, 2000),
        action: 'skipped_limit',
        ai_reasoning: `Limite diário atingido (${dailyCount}/${maxPerDay})`
      })

      pushAutopilotEvent('response_skipped', userId, contactPhone, contactName, `Limite diário (${dailyCount}/${maxPerDay})`)
      return NextResponse.json({ action: 'skipped_limit' })
    }

    // 4. Check credits
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

      if (isNewMonth) {
        await supabaseAdmin
          .from('companies')
          .update({ monthly_credits_used: 0, extra_monthly_credits: 0, monthly_credits_reset_at: now.toISOString() })
          .eq('id', companyId)
        currentCreditsUsed = 0
      }

      const planConfig = PLAN_CONFIGS[companyCredits.training_plan as PlanType]
      const baseLimit = planConfig?.monthlyCredits
      const extraCredits = companyCredits.extra_monthly_credits || 0

      if (baseLimit !== null) {
        const remaining = (baseLimit + extraCredits) - currentCreditsUsed
        if (remaining <= 0) {
          console.log(`[Autopilot] No credits remaining for company ${companyId}`)

          await supabaseAdmin.from('autopilot_log').insert({
            user_id: userId,
            company_id: companyId,
            contact_phone: contactPhone,
            contact_name: contactName,
            incoming_message: incomingMessage.slice(0, 2000),
            action: 'skipped_credits',
            ai_reasoning: 'Créditos mensais esgotados'
          })

          pushAutopilotEvent('response_skipped', userId, contactPhone, contactName, 'Créditos esgotados')
          return NextResponse.json({ action: 'skipped_credits' })
        }
      }
    }

    // 5. Load conversation context (last 30 messages from DB)
    // IMPORTANT: Query DESC to get the NEWEST 30 messages, then reverse to chronological order
    const phoneSuffixForQuery = contactPhone.replace(/[^0-9]/g, '').slice(-9)
    const { data: recentMessagesDesc } = await supabaseAdmin
      .from('whatsapp_messages')
      .select('direction, content, contact_name, message_timestamp, transcription')
      .eq('user_id', userId)
      .like('contact_phone', `%${phoneSuffixForQuery}`)
      .order('message_timestamp', { ascending: false })
      .limit(30)

    // Reverse to chronological order (oldest first) for the AI to read naturally
    const recentMessages = recentMessagesDesc?.reverse() || []

    let conversationContext = ''
    if (recentMessages.length > 0) {
      conversationContext = recentMessages.map(m => {
        const sender = m.direction === 'outbound' ? 'Vendedor' : (contactName || 'Lead')
        const text = m.content || (m.transcription ? `[Áudio transcrito]: ${m.transcription}` : '[mídia]')
        return `${sender}: ${text}`
      }).join('\n')
    }

    // Debug: show last 3 messages the AI will see
    const lastMsgs = recentMessages.slice(-3)
    console.log(`[Autopilot] Context for ${contactPhone}: ${recentMessages.length} msgs, last 3:`,
      lastMsgs.map(m => `${m.direction === 'outbound' ? 'OUT' : 'IN'}: ${(m.content || '').slice(0, 60)}`))

    // 6. RAG pipeline (same as copilot)
    const embeddingText = `${incomingMessage}\n${conversationContext.slice(-500)}`
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: embeddingText.slice(0, 8000)
    })
    const queryEmbedding = embeddingResponse.data[0].embedding

    const ragResults = await Promise.allSettled([
      supabaseAdmin.rpc('match_followup_success', {
        query_embedding: queryEmbedding,
        company_id_filter: companyId,
        match_threshold: 0.4,
        match_count: 3
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
    const companyKnowledge = ragResults[1].status === 'fulfilled' ? (ragResults[1].value.data || []) : []
    const companyData = ragResults[2].status === 'fulfilled' ? ragResults[2].value.data : null

    // 7. Build system prompt — profile-specific instructions with fallback
    const tone = settings.tone || 'consultivo'
    let instructions = config.custom_instructions || ''

    // If contact has a profile, use profile-specific instructions
    if (contactRecord?.profile_id) {
      const { data: profile } = await supabaseAdmin
        .from('autopilot_profiles')
        .select('custom_instructions')
        .eq('id', contactRecord.profile_id)
        .single()

      if (profile?.custom_instructions) {
        instructions = profile.custom_instructions
      }
    }
    // Extract objetivo from structured instructions (first line starting with "Objetivo:")
    const objetivoMatch = instructions.match(/^Objetivo:\s*(.+)$/m)
    const objetivoVendedor = objetivoMatch?.[1]?.trim() || instructions.split('\n')[0] || 'qualificar o lead e entender suas necessidades'

    let systemPrompt = `Voce e um vendedor ${tone} que conversa com leads no WhatsApp. Voce atua como se fosse o proprio vendedor — humano, natural, nunca robotico.

=== INSTRUCOES DO VENDEDOR ===
${instructions || `Objetivo: ${objetivoVendedor}`}

=== FORMATO DE RESPOSTA (OBRIGATORIO) ===
Voce DEVE responder em JSON valido. SEM markdown, SEM code blocks, APENAS JSON puro.

Se PODE responder:
{"canRespond": true, "response": ["mensagem 1", "mensagem 2"], "objectiveReached": false}

Se NAO pode responder:
{"canRespond": false, "reason": "motivo"}

REGRAS DE SEPARACAO DE MENSAGENS:
- Separe a resposta em 2-3 mensagens curtas (como um vendedor real faria no WhatsApp)
- Cada mensagem deve ter no maximo 2-3 linhas
- Se a resposta for simples (cumprimento, resposta curta), pode ser 1 mensagem so: ["mensagem unica"]
- NUNCA mais que 3 mensagens por resposta
- response DEVE ser um array de strings, NUNCA uma string unica

=== ESTAGIO DA CONVERSA (FUNDAMENTAL) ===
Antes de responder, analise o estagio atual da conversa:

ESTAGIO 1 — RAPPORT (primeiras 2-3 trocas de mensagens):
- Cumprimente, seja cordial e crie conexao HUMANA
- Faca UMA pergunta leve sobre a situacao do lead (ex: "Como ta o movimento ai?", "Ha quanto tempo voce ta nessa area?")
- NAO fale sobre produto/servico ainda. NAO faca pitch. NAO mencione beneficios.
- Objetivo: fazer o lead se sentir ouvido e confortavel

ESTAGIO 2 — QUALIFICACAO (apos rapport, proximas 2-4 trocas):
- Investigue a situacao atual do lead com perguntas abertas
- Entenda DOR, NECESSIDADE e CONTEXTO antes de oferecer qualquer coisa
- Perguntas como: "Qual seu maior desafio hoje com [area]?", "Como voce faz [processo] atualmente?", "O que te motivou a responder?"
- NAO apresente solucao ainda. Primeiro entenda o cenario.

ESTAGIO 3 — APRESENTACAO (so depois de entender a situacao):
- Conecte o que o lead disse com sua solucao (usando as palavras DELE)
- Apresente valor de forma especifica para a dor que ele mencionou
- Use prova social ou dados quando disponivel

ESTAGIO 4 — CONVITE/CTA (so quando o lead demonstrou interesse):
- Proponha o proximo passo natural: ${objetivoVendedor}
- Nao force. Ofereça como sugestao natural da conversa.

REGRA DE OURO: Se voce ainda nao sabe qual a DOR ou SITUACAO do lead, voce esta no estagio 1 ou 2.
NUNCA pule para o estagio 3 ou 4 sem ter passado pelos anteriores.
Analise o HISTORICO DA CONVERSA para determinar em qual estagio voce esta.

=== OBJETIVO ALCANCADO (objectiveReached) ===
Retorne "objectiveReached": true APENAS quando:
- O lead ACEITOU EXPLICITAMENTE o objetivo (ex: "vamos agendar", "pode marcar", "quero sim", "manda o link")
- O lead confirmou que vai fazer a acao desejada
- O lead demonstrou comprometimento claro (data, horario, confirmacao)
IMPORTANTE: O objetivo do vendedor e: ${objetivoVendedor}
So marque como alcancado se o lead demonstrou COMPROMETIMENTO CLARO com esse objetivo especifico.
Em todos os outros casos, retorne "objectiveReached": false.

=== ESTILO DE CONVERSA ===
- Cada mensagem DEVE terminar com uma pergunta que estimule o lead a responder
- Perguntas devem ser SOBRE O LEAD (situacao, dor, contexto), nao sobre seu produto
- So fale do produto quando o lead perguntar ou quando voce ja entendeu a situacao dele
- NUNCA mande duas informacoes sobre o produto na mesma resposta — dosifique
- Se o lead fez uma pergunta, responda ELA primeiro, depois faca sua pergunta

=== QUANDO RESPONDER canRespond=FALSE ===
- O lead pergunta sobre AGENDA, HORARIOS DISPONIVEIS ou DISPONIBILIDADE para reuniao/ligacao
- O lead pergunta sobre PRECOS ESPECIFICOS, DESCONTOS ou CONDICOES DE PAGAMENTO que NAO estao nos dados da empresa
- O lead pede para FALAR COM ALGUEM ESPECIFICO (gerente, diretor, outra pessoa)
- O lead faz uma PERGUNTA TECNICA MUITO ESPECIFICA que nao esta nos dados da empresa
- O lead expressa uma RECLAMACAO SERIA ou INSATISFACAO que precisa de tratamento humano
- O lead pede algo que REQUER ACAO HUMANA (enviar contrato, agendar visita, enviar proposta personalizada)
- Voce NAO TEM CERTEZA da resposta correta. NUNCA invente informacoes.
- A conversa esta num ponto de NEGOCIACAO AVANCADA que precisa de decisao humana

=== FORMATACAO WHATSAPP ===
- Paragrafos curtos (maximo 3 linhas cada). Evite blocos de texto densos.
- Use *negrito* apenas em informacoes cruciais (precos, prazos, beneficios principais)
- Emojis com moderacao (1-2 max por mensagem) para tom humano e profissional
- Tom: ${tone}. Use "Oi", "Tudo bem?", "Com certeza". Evite "Prezado", "Estimado", "Cordialmente"
- Fale SEMPRE em primeira pessoa ("Eu", "Nos"). NUNCA se identifique como IA, robo ou assistente automatico.
- NUNCA invente informacoes que nao estao nos dados da empresa
- Seja CONCISO. Mensagens longas assustam no WhatsApp.`

    // Company data
    if (companyData) {
      systemPrompt += `\n\nDADOS DA EMPRESA:`
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

    // Company knowledge (RAG)
    if (companyKnowledge.length > 0) {
      systemPrompt += `\n\nCONHECIMENTO DA EMPRESA (base de dados):`
      companyKnowledge.forEach((doc: any) => {
        systemPrompt += `\n- ${doc.category}: ${doc.content?.slice(0, 300)}`
      })
    }

    // Success examples
    if (successExamples.length > 0) {
      systemPrompt += `\n\nEXEMPLOS DE ABORDAGENS QUE FUNCIONARAM:`
      successExamples.forEach((ex: any, i: number) => {
        const text = ex.transcricao || ex.content || ''
        systemPrompt += `\n\nExemplo ${i + 1}:\n${text.slice(0, 400)}`
      })
    }

    // Conversation context
    if (conversationContext) {
      systemPrompt += `\n\nCONVERSA ATUAL COM O LEAD (${contactName || contactPhone}):\n${conversationContext}`
    }

    // Complement mode: add specific instructions with strong conservative bias
    if (isComplement) {
      // Count recent outbound messages to detect if seller already sent multiple
      const recentOutbound = recentMessages?.filter(m => m.direction === 'outbound') || []
      const lastMessages = recentMessages?.slice(-5) || []
      const consecutiveOutbound = lastMessages.reverse().findIndex(m => m.direction !== 'outbound')
      const sellerSentMultiple = consecutiveOutbound === -1 ? lastMessages.length : consecutiveOutbound

      systemPrompt += `\n\n=== MODO COMPLEMENTO (ANALISE CRITICA OBRIGATORIA) ===
O VENDEDOR acabou de enviar uma mensagem para este lead. Voce DEVE avaliar com RIGOR se um complemento e realmente necessario.

VIES PADRAO: NAO COMPLEMENTAR. Na duvida, retorne canRespond: false.
Complementar desnecessariamente e PIOR que nao complementar — parece robotico, ansioso e invasivo.

CONTEXTO DO HISTORICO:
- O vendedor mandou ${sellerSentMultiple} mensagem(ns) seguida(s) recentemente
- Total de mensagens outbound no historico: ${recentOutbound.length}

=== QUANDO *NAO* COMPLEMENTAR (canRespond: false) ===
Retorne false em QUALQUER uma dessas situacoes:

1. MENSAGEM JA TEM PERGUNTA — Se termina com "?", ja engaja. Nao precisa de complemento.
   Ex: "Oi tudo bem? Como vai?" → NÃO complementar
   Ex: "Posso te ajudar com algo?" → NÃO complementar

2. VENDEDOR JA MANDOU 2+ MENSAGENS SEGUIDAS — Ja esta complementando sozinho. Mais uma msg pareceria spam.
   ${sellerSentMultiple >= 2 ? '⚠️ ATENCAO: O vendedor JA mandou ' + sellerSentMultiple + ' msgs seguidas. NAO complementar.' : ''}

3. MENSAGEM E INFORMATIVA E SUFICIENTE — Vendedor respondeu algo que o lead pediu. Nao precisa de gancho extra.
   Ex: "O preco e R$299/mes" → Lead vai processar e responder. Nao complementar.
   Ex: "Vou verificar e te retorno" → Vendedor sinalizou acao. Nao complementar.

4. CONTEXTO DA CONVERSA JA E ENGAJADOR — Se a conversa ja tem boa cadencia (pergunta-resposta), nao precisa de intervencao.

5. MENSAGEM E UM ENCERRAMENTO — Vendedor esta finalizando ou pausando.
   Ex: "Valeu!", "Abraco!", "Qualquer coisa me chama" → Nao complementar.

6. LEAD JA RESPONDEU RECENTEMENTE — Se a ultima msg do lead foi ha pouco tempo, o fluxo esta natural.

7. E A PRIMEIRA MENSAGEM PARA O LEAD E JA E COMPLETA — Se o vendedor mandou "Oi Arthur, aqui e o Joao da empresa X, prazer! Como voce ta?" → JA e completa. Tem saudacao + identificacao + pergunta.

=== QUANDO *SIM* COMPLEMENTAR (canRespond: true) — SOMENTE SE TODOS OS CRITERIOS FOREM ATENDIDOS ===

Todos esses criterios devem ser TRUE simultaneamente:
✅ A mensagem do vendedor NAO termina com pergunta
✅ O vendedor mandou APENAS 1 mensagem (nao 2+ seguidas)
✅ A mensagem e um "beco sem saida conversacional" — o lead NAO tem razao clara para responder
✅ Nao e uma mensagem de encerramento ou pausa intencional
✅ O complemento vai GENUINAMENTE melhorar a chance de resposta do lead

Exemplos CLAROS onde complementar:
- "Oi, aqui e o Arthur da Ramppy, prazer!" → SEM pergunta, sem gancho. Lead pensa "ok, e dai?". Complementar com pergunta.
- "Mandei o material por email" → Informacao solta sem proximo passo. Complementar com "Conseguiu dar uma olhada?"
- "Bom dia!" → Cumprimento isolado sem contexto. Complementar com identificacao + pergunta.

Exemplos onde PARECE que deveria complementar MAS NAO DEVE:
- "Oi tudo bem?" → Ja tem pergunta implicita. Lead vai responder "tudo e voce?". NAO complementar.
- "Te mandei uma proposta, da uma olhada quando puder" → Ja tem CTA. NAO complementar.
- "Obrigado pelo retorno! Vou analisar aqui." → Vendedor esta processando. NAO complementar.

=== SE DECIDIR COMPLEMENTAR ===
- APENAS 1 mensagem curta (1-2 linhas MAXIMO)
- Deve parecer continuacao 100% natural (como se o vendedor tivesse digitado mais uma msg)
- Geralmente sera UMA pergunta simples e leve
- Use o mesmo tom e linguagem do vendedor
- NAO repita informacoes que o vendedor ja deu
- NAO seja formal demais nem de menos — espelhe o estilo do vendedor
- response DEVE ser um array: ["mensagem complementar"]

LEMBRE-SE: Se voce nao tem CERTEZA ABSOLUTA que o complemento vai melhorar a conversa, NAO ENVIE.`
    }

    // 8. Call GPT-4.1 with structured JSON output
    const userMessage = isComplement
      ? `O VENDEDOR enviou para o lead: "${incomingMessage}"\n\nAvalie se precisa de complemento. Responda em JSON.`
      : `O lead enviou: "${incomingMessage}"\n\nResponda em JSON.`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      max_tokens: 500,
      temperature: 0.5,
      response_format: { type: 'json_object' }
    })

    const rawResponse = completion.choices[0]?.message?.content || '{}'
    console.log(`[Autopilot] AI response for ${contactPhone}:`, rawResponse.slice(0, 200))

    let aiDecision: {
      canRespond: boolean
      response?: string | string[]
      reason?: string
      objectiveReached?: boolean
    }
    try {
      aiDecision = JSON.parse(rawResponse)
    } catch {
      console.error(`[Autopilot] Failed to parse AI response:`, rawResponse)
      aiDecision = { canRespond: false, reason: 'Erro ao processar resposta da IA' }
    }

    // 9. Act on AI decision
    if (!aiDecision.canRespond) {
      // Flag contact as needs human
      console.log(`[Autopilot] Flagging ${contactPhone} as needs human: ${aiDecision.reason}`)

      await Promise.all([
        supabaseAdmin
          .from('autopilot_contacts')
          .update({
            enabled: false,
            needs_human: true,
            needs_human_reason: aiDecision.reason || 'IA não soube responder',
            needs_human_at: new Date().toISOString()
          })
          .eq('user_id', userId)
          .eq('contact_phone', storedPhone),

        // Update conversation indicator (suffix match for phone format)
        supabaseAdmin
          .from('whatsapp_conversations')
          .update({ autopilot_needs_human: true })
          .like('contact_phone', `%${phoneSuffix}`),

        // Log
        supabaseAdmin.from('autopilot_log').insert({
          user_id: userId,
          company_id: companyId,
          contact_phone: contactPhone,
          contact_name: contactName,
          incoming_message: incomingMessage.slice(0, 2000),
          action: 'flagged_human',
          ai_reasoning: aiDecision.reason
        })
      ])

      pushAutopilotEvent('flagged_human', userId, contactPhone, contactName, aiDecision.reason || 'IA não soube responder')
      return NextResponse.json({
        action: 'flagged_human',
        reason: aiDecision.reason
      })
    }

    // AI can respond - normalize response to array of messages
    let messages: string[] = []
    if (aiDecision.response) {
      messages = Array.isArray(aiDecision.response)
        ? aiDecision.response
        : [aiDecision.response]
    }
    messages = messages.filter(m => m.trim())

    if (messages.length === 0) {
      console.log(`[Autopilot] Empty AI response, skipping`)
      return NextResponse.json({ action: 'skipped_error', reason: 'Empty response' })
    }

    // 10. Send each message bubble with delay between them
    const messageIds: string[] = []
    for (let i = 0; i < messages.length; i++) {
      const sendResult = await sendAutopilotMessage(userId, contactPhone, messages[i])

      if (!sendResult.success) {
        console.error(`[Autopilot] Failed to send bubble ${i + 1}/${messages.length} to ${contactPhone}`)
        if (messageIds.length === 0) {
          // First bubble failed — log error and bail
          await supabaseAdmin.from('autopilot_log').insert({
            user_id: userId,
            company_id: companyId,
            contact_phone: contactPhone,
            contact_name: contactName,
            incoming_message: incomingMessage.slice(0, 2000),
            action: 'skipped_error',
            ai_response: messages.join(' | '),
            ai_reasoning: 'Falha ao enviar mensagem via WhatsApp'
          })
          return NextResponse.json({ action: 'skipped_error', reason: 'Send failed' })
        }
        break // Partial send — continue with what we got
      }

      if (sendResult.messageId) messageIds.push(sendResult.messageId)

      // Delay between bubbles (2-4s) — skip after last message
      if (i < messages.length - 1) {
        await new Promise(r => setTimeout(r, 2000 + Math.random() * 2000))
      }
    }

    // 11. Mark all sent messages as autopilot
    if (messageIds.length > 0) {
      setTimeout(async () => {
        try {
          for (const msgId of messageIds) {
            await supabaseAdmin
              .from('whatsapp_messages')
              .update({ is_autopilot: true })
              .eq('wa_message_id', msgId)
          }
        } catch (e) {
          console.error('[Autopilot] Failed to mark messages as autopilot:', e)
        }
      }, 2000)
    }

    // 12. Check if objective was reached
    if (aiDecision.objectiveReached) {
      console.log(`[Autopilot] Objective reached for ${contactPhone}!`)
      await Promise.all([
        supabaseAdmin
          .from('autopilot_contacts')
          .update({
            enabled: false,
            objective_reached: true,
            objective_reached_reason: 'Lead aceitou o objetivo',
            objective_reached_at: new Date().toISOString()
          })
          .eq('user_id', userId)
          .eq('contact_phone', storedPhone),

        supabaseAdmin.from('autopilot_log').insert({
          user_id: userId,
          company_id: companyId,
          contact_phone: contactPhone,
          contact_name: contactName,
          incoming_message: incomingMessage.slice(0, 2000),
          action: 'objective_reached',
          ai_response: messages.join(' | '),
          ai_reasoning: 'Objetivo alcancado — autopilot encerrado para este contato'
        })
      ])
    }

    // 13. Update contact stats (skip for complements — they don't count as AI responses)
    if (!isComplement) {
      await supabaseAdmin
        .from('autopilot_contacts')
        .update({
          auto_responses_today: dailyCount + 1,
          last_auto_response_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('contact_phone', storedPhone)
    }

    // 14. Consume 1 credit
    if (companyCredits) {
      await supabaseAdmin
        .from('companies')
        .update({ monthly_credits_used: (companyCredits.monthly_credits_used || 0) + 1 })
        .eq('id', companyId)
    }

    // 15. Log success
    const logAction = isComplement ? 'complemented' : 'responded'
    await supabaseAdmin.from('autopilot_log').insert({
      user_id: userId,
      company_id: companyId,
      contact_phone: contactPhone,
      contact_name: contactName,
      incoming_message: incomingMessage.slice(0, 2000),
      action: logAction,
      ai_response: messages.join(' | '),
      credits_used: 1
    })

    console.log(`[Autopilot] Successfully ${logAction} ${contactPhone} with ${messages.length} bubble(s)`)

    if (aiDecision.objectiveReached) {
      pushAutopilotEvent('objective_reached', userId, contactPhone, contactName, `Objetivo alcançado! Autopilot encerrado.`)
    } else {
      pushAutopilotEvent('response_sent', userId, contactPhone, contactName, `${isComplement ? 'Complemento' : 'Resposta'} enviada (${messages.length} balão${messages.length > 1 ? 'ões' : ''})`)
    }

    return NextResponse.json({
      action: aiDecision.objectiveReached ? 'objective_reached' : logAction,
      response: messages
    })

  } catch (error: any) {
    console.error('[Autopilot Respond] Error:', error)
    return NextResponse.json(
      { error: error.message, action: 'skipped_error' },
      { status: 500 }
    )
  }
}
