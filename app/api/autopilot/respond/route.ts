import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { PLAN_CONFIGS, PlanType } from '@/lib/types/plans'
import { sendAutopilotMessage } from '@/lib/whatsapp-client'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { userId, contactPhone, contactName, incomingMessage, companyId } = body

    if (!userId || !contactPhone || !incomingMessage || !companyId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    console.log(`[Autopilot] Processing message from ${contactPhone} for user ${userId}`)

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

    if (!contactRecord) {
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
    if (dailyCount >= maxPerDay) {
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

          return NextResponse.json({ action: 'skipped_credits' })
        }
      }
    }

    // 5. Load conversation context (last 30 messages from DB)
    const { data: recentMessages } = await supabaseAdmin
      .from('whatsapp_messages')
      .select('direction, content, contact_name, message_timestamp, transcription')
      .eq('user_id', userId)
      .like('contact_phone', `%${contactPhone.slice(-9)}`)
      .order('message_timestamp', { ascending: true })
      .limit(30)

    let conversationContext = ''
    if (recentMessages && recentMessages.length > 0) {
      conversationContext = recentMessages.map(m => {
        const sender = m.direction === 'outbound' ? 'Vendedor' : (contactName || 'Lead')
        const text = m.content || (m.transcription ? `[Áudio transcrito]: ${m.transcription}` : '[mídia]')
        return `${sender}: ${text}`
      }).join('\n')
    }

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

    // 7. Build system prompt
    const tone = settings.tone || 'consultivo'

    let systemPrompt = `Voce e um assistente automatico de vendas que responde leads no WhatsApp quando o vendedor nao esta disponivel. Voce DEVE se comportar como se fosse o proprio vendedor.

REGRAS CRITICAS - FORMATO DE RESPOSTA:
Voce DEVE responder em JSON valido. SEM markdown, SEM code blocks, APENAS JSON puro.
O JSON deve ter EXATAMENTE este formato:
{"canRespond": true, "response": "sua resposta aqui"}
OU
{"canRespond": false, "reason": "motivo pelo qual nao pode responder"}

QUANDO RESPONDER canRespond=FALSE:
- O lead pergunta sobre AGENDA, HORARIOS DISPONIVEIS ou DISPONIBILIDADE para reuniao/ligacao
- O lead pergunta sobre PRECOS ESPECIFICOS, DESCONTOS ou CONDICOES DE PAGAMENTO que NAO estao nos dados da empresa
- O lead pede para FALAR COM ALGUEM ESPECIFICO (gerente, diretor, outra pessoa)
- O lead faz uma PERGUNTA TECNICA MUITO ESPECIFICA que nao esta nos dados da empresa
- O lead expressa uma RECLAMACAO SERIA ou INSATISFACAO que precisa de tratamento humano
- O lead pede algo que REQUER ACAO HUMANA (enviar contrato, agendar visita, enviar proposta personalizada)
- Voce NAO TEM CERTEZA da resposta correta
- A conversa esta num ponto de NEGOCIACAO AVANCADA que precisa de decisao humana
- O lead menciona DATAS ESPECIFICAS, PRAZOS ou DEADLINES que precisam de confirmacao humana

QUANDO RESPONDER canRespond=TRUE:
- O lead faz perguntas gerais sobre produtos/servicos (que estao nos dados da empresa)
- O lead quer saber mais sobre beneficios, funcionalidades, diferenciais
- O lead envia cumprimentos ou mensagens simples
- Voce pode agregar valor com informacoes que tem nos dados da empresa
- O lead faz perguntas frequentes (FAQ) com respostas claras nos dados

ESTILO DA RESPOSTA (quando canRespond=true):
- Mensagem CURTA: 2-4 linhas max (WhatsApp)
- Tom: ${tone} e natural
- Emojis com moderacao (1-2 max)
- NUNCA diga que voce e uma IA ou bot ou que esta respondendo automaticamente
- Fale como se fosse o vendedor (primeira pessoa)
- Sempre termine com uma pergunta ou CTA simples para manter a conversa
- NUNCA invente informacoes que nao estao nos dados da empresa
- Use linguagem natural de WhatsApp, nao formal demais`

    // Custom instructions from user
    if (config.custom_instructions) {
      systemPrompt += `\n\nINSTRUCOES ESPECIFICAS DO VENDEDOR:\n${config.custom_instructions}`
    }

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

    // 8. Call GPT-4.1 with structured JSON output
    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `O lead enviou: "${incomingMessage}"\n\nResponda em JSON.` }
      ],
      max_tokens: 500,
      temperature: 0.5,
      response_format: { type: 'json_object' }
    })

    const rawResponse = completion.choices[0]?.message?.content || '{}'
    console.log(`[Autopilot] AI response for ${contactPhone}:`, rawResponse.slice(0, 200))

    let aiDecision: { canRespond: boolean; response?: string; reason?: string }
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

      return NextResponse.json({
        action: 'flagged_human',
        reason: aiDecision.reason
      })
    }

    // AI can respond - send the message
    const responseText = aiDecision.response || ''
    if (!responseText.trim()) {
      console.log(`[Autopilot] Empty AI response, skipping`)
      return NextResponse.json({ action: 'skipped_error', reason: 'Empty response' })
    }

    // 10. Send via WhatsApp
    const sendResult = await sendAutopilotMessage(userId, contactPhone, responseText)

    if (!sendResult.success) {
      console.error(`[Autopilot] Failed to send message to ${contactPhone}`)

      await supabaseAdmin.from('autopilot_log').insert({
        user_id: userId,
        company_id: companyId,
        contact_phone: contactPhone,
        contact_name: contactName,
        incoming_message: incomingMessage.slice(0, 2000),
        action: 'skipped_error',
        ai_response: responseText,
        ai_reasoning: 'Falha ao enviar mensagem via WhatsApp'
      })

      return NextResponse.json({ action: 'skipped_error', reason: 'Send failed' })
    }

    // 11. Mark the sent message as autopilot
    if (sendResult.messageId) {
      // Small delay to let handleIncomingMessage save the message first
      setTimeout(async () => {
        try {
          await supabaseAdmin
            .from('whatsapp_messages')
            .update({ is_autopilot: true })
            .eq('wa_message_id', sendResult.messageId)
        } catch (e) {
          console.error('[Autopilot] Failed to mark message as autopilot:', e)
        }
      }, 2000)
    }

    // 12. Update contact stats
    await supabaseAdmin
      .from('autopilot_contacts')
      .update({
        auto_responses_today: dailyCount + 1,
        last_auto_response_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('contact_phone', storedPhone)

    // 13. Consume 1 credit
    if (companyCredits) {
      await supabaseAdmin
        .from('companies')
        .update({ monthly_credits_used: (companyCredits.monthly_credits_used || 0) + 1 })
        .eq('id', companyId)
    }

    // 14. Log success
    await supabaseAdmin.from('autopilot_log').insert({
      user_id: userId,
      company_id: companyId,
      contact_phone: contactPhone,
      contact_name: contactName,
      incoming_message: incomingMessage.slice(0, 2000),
      action: 'responded',
      ai_response: responseText,
      credits_used: 1
    })

    console.log(`[Autopilot] Successfully responded to ${contactPhone}`)

    return NextResponse.json({
      action: 'responded',
      response: responseText
    })

  } catch (error: any) {
    console.error('[Autopilot Respond] Error:', error)
    return NextResponse.json(
      { error: error.message, action: 'skipped_error' },
      { status: 500 }
    )
  }
}
