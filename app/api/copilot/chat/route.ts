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
      model: 'text-embedding-ada-002',
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

    // 5. Build system prompt with all layers
    let systemPrompt = `Voce é o Copiloto de Vendas, um assistente especializado que ajuda vendedores durante conversas no WhatsApp.

REGRAS:
- Responda SEMPRE em português
- Seja direto e prático. O vendedor está no meio de uma conversa, precisa de respostas rápidas.
- Sugira EXATAMENTE o que escrever quando pedido, com o tom correto para WhatsApp
- Considere o contexto da conversa atual ao responder
- Não repita o que o vendedor já disse
- Quando sugerir mensagens, use emojis de forma natural (como vendedores reais usam no WhatsApp)
- Se o vendedor pedir uma análise, analise a conversa e dê feedback construtivo
- Formate sugestões de mensagem entre aspas para ficar claro o que copiar`

    // Layer 2: Company data
    if (companyData) {
      systemPrompt += `\n\nDADOS DA EMPRESA:`
      if (companyData.nome) systemPrompt += `\n- Nome: ${companyData.nome}`
      if (companyData.descricao) systemPrompt += `\n- Descrição: ${companyData.descricao}`
      if (companyData.produtos_servicos) systemPrompt += `\n- Produtos/Serviços: ${companyData.produtos_servicos}`
      if (companyData.funcao_produtos) systemPrompt += `\n- Função: ${companyData.funcao_produtos}`
      if (companyData.diferenciais) systemPrompt += `\n- Diferenciais: ${companyData.diferenciais}`
      if (companyData.concorrentes) systemPrompt += `\n- Concorrentes: ${companyData.concorrentes}`
      if (companyData.dados_metricas) systemPrompt += `\n- Métricas: ${companyData.dados_metricas}`
      if (companyData.erros_comuns) systemPrompt += `\n- Erros Comuns a Evitar: ${companyData.erros_comuns}`
      if (companyData.percepcao_desejada) systemPrompt += `\n- Percepção Desejada: ${companyData.percepcao_desejada}`
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
      systemPrompt += `\n\nEXEMPLOS DE ABORDAGENS QUE FUNCIONARAM (situações similares):`
      successExamples.forEach((ex: any, i: number) => {
        const text = ex.transcricao || ex.content || ''
        systemPrompt += `\n\nExemplo ${i + 1} (nota ${ex.nota_original || 'N/A'}):\n${text.slice(0, 400)}`
      })
    }

    // Layer 5: Failure examples (RAG)
    if (failureExamples.length > 0) {
      systemPrompt += `\n\nEXEMPLOS DE ABORDAGENS QUE NÃO FUNCIONARAM (evite esses padrões):`
      failureExamples.forEach((ex: any, i: number) => {
        const text = ex.transcricao || ex.content || ''
        systemPrompt += `\n\nExemplo ${i + 1} (nota ${ex.nota_original || 'N/A'}):\n${text.slice(0, 400)}`
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

    // 7. Call OpenAI GPT-4o
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      max_tokens: 2000,
      temperature: 0.7
    })

    const suggestion = completion.choices[0]?.message?.content || 'Desculpe, não consegui gerar uma sugestão.'

    // 8. Save copilot_feedback record (was_helpful=null initially)
    const { data: feedbackRecord } = await supabaseAdmin
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
          model: 'gpt-4o',
          success_examples: successExamples.length,
          failure_examples: failureExamples.length,
          company_knowledge: companyKnowledge.length,
          tokens: completion.usage?.total_tokens || 0
        }
      })
      .select('id')
      .single()

    // 9. Consume 1 credit
    if (companyCredits) {
      await supabaseAdmin
        .from('companies')
        .update({ monthly_credits_used: (companyCredits.monthly_credits_used || 0) + 1 })
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
