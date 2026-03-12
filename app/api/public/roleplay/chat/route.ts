import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'
import { buildSystemPrompt } from '@/lib/roleplay/buildSystemPrompt'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const OPENAI_TIMEOUT = 90000
const MAX_HISTORY_MESSAGES = 100

// Cliente Supabase com service role
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export async function POST(request: Request) {
  try {
    const { sessionId, message } = await request.json()

    if (!sessionId || !message) {
      return NextResponse.json(
        { error: 'Dados incompletos' },
        { status: 400 }
      )
    }

    // Verificar se a sessão existe e está ativa
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('roleplays_unicos')
      .select('*')
      .eq('id', sessionId)
      .eq('status', 'in_progress')
      .single()

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Sessão não encontrada ou já finalizada' },
        { status: 404 }
      )
    }

    const sessionConfig = session.config || {}

    // Reconstruir system prompt (usar o salvo na sessão ou reconstruir)
    let systemPrompt = sessionConfig.systemPrompt
    if (!systemPrompt) {
      // Fallback: reconstruir system prompt se não estiver salvo na sessão
      const { data: companyData } = await supabaseAdmin
        .from('company_data')
        .select('*')
        .eq('company_id', session.company_id)
        .single()

      const { data: companyTypeData } = await supabaseAdmin
        .from('company_type')
        .select('type')
        .eq('company_id', session.company_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      const companyType = companyTypeData?.type || 'B2C'

      // Formatar persona
      let personaFormatted = ''
      if (sessionConfig.persona) {
        const p = sessionConfig.persona
        if (p.business_type === 'B2B') {
          personaFormatted = `
PERFIL DO CLIENTE B2B:
- Cargo: ${p.job_title || p.cargo || 'Não especificado'}
- Empresa: ${p.company_type || p.tipo_empresa_faturamento || 'Não especificado'}
- Contexto: ${p.context || p.contexto || 'Não especificado'}
- O que busca: ${p.company_goals || p.busca || 'Não especificado'}
- Principais desafios: ${p.business_challenges || p.dores || 'Não especificado'}
- O que já sabe sobre sua empresa: ${p.prior_knowledge || 'Não sabe nada ainda'}`
        } else if (p.business_type === 'B2C') {
          personaFormatted = `
PERFIL DO CLIENTE B2C:
- Profissão: ${p.profession || p.cargo || 'Não especificado'}
- Contexto: ${p.context || p.contexto || 'Não especificado'}
- O que busca: ${p.what_seeks || p.busca || 'Não especificado'}
- Principais dores: ${p.main_pains || p.dores || 'Não especificado'}
- O que já sabe sobre sua empresa: ${p.prior_knowledge || 'Não sabe nada ainda'}`
        }
      }

      // Formatar objeções
      let objectionsFormatted = 'Nenhuma objeção específica'
      if (sessionConfig.objections && sessionConfig.objections.length > 0) {
        objectionsFormatted = sessionConfig.objections.map((obj: any, index: number) => {
          let text = `OBJEÇÃO ${index + 1}:\n${obj.name || obj}`
          if (obj.rebuttals && obj.rebuttals.length > 0) {
            text += `\n\nFormas de quebrar esta objeção:`
            text += obj.rebuttals.map((r: string, i: number) => `\n  ${i + 1}. ${r}`).join('')
          }
          return text
        }).join('\n\n---\n\n')
      }

      systemPrompt = buildSystemPrompt({
        companyName: companyData?.nome || null,
        companyDescription: companyData?.descricao || null,
        companyType,
        objetivo: sessionConfig.objective?.name
          ? `${sessionConfig.objective.name}${sessionConfig.objective.description ? `\nDescrição: ${sessionConfig.objective.description}` : ''}`
          : 'Não especificado',
        nome: sessionConfig.clientName || 'Cliente',
        idade: sessionConfig.age || '35',
        temperamento: sessionConfig.temperament || 'Analítico',
        persona: personaFormatted.trim(),
        objecoes: objectionsFormatted
      })
    }

    // Construir histórico de mensagens para o OpenAI
    const chatMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt }
    ]

    // Adicionar mensagens anteriores da sessão
    const existingMessages = session.messages || []
    const limitedMessages = existingMessages.slice(-MAX_HISTORY_MESSAGES)

    for (const msg of limitedMessages) {
      if (msg.role === 'seller') {
        chatMessages.push({ role: 'user', content: msg.text })
      } else if (msg.role === 'client') {
        chatMessages.push({ role: 'assistant', content: msg.text })
      }
    }

    // Adicionar nova mensagem do vendedor
    chatMessages.push({ role: 'user', content: message })

    console.log('📤 Enviando para OpenAI:', {
      sessionId,
      chatInput: message.substring(0, 50) + '...',
      companyId: session.company_id,
      totalMessages: chatMessages.length
    })

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), OPENAI_TIMEOUT)

    let responseText = ''
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4.1',
        messages: chatMessages,
        max_tokens: 500,
        temperature: 0.8,
      })

      clearTimeout(timeoutId)
      responseText = completion.choices[0]?.message?.content || ''
      console.log('✅ Resposta OpenAI:', responseText.substring(0, 100) + '...')
    } catch (openaiError: any) {
      clearTimeout(timeoutId)
      if (openaiError.name === 'AbortError') {
        console.error('❌ Timeout na chamada OpenAI')
        return NextResponse.json(
          { error: 'Timeout ao processar mensagem. Tente novamente.' },
          { status: 504 }
        )
      }
      throw openaiError
    }

    // Atualizar mensagens na sessão
    const updatedMessages = [
      ...(session.messages || []),
      { role: 'seller', text: message, timestamp: new Date().toISOString() },
      { role: 'client', text: responseText, timestamp: new Date().toISOString() }
    ]

    await supabaseAdmin
      .from('roleplays_unicos')
      .update({ messages: updatedMessages })
      .eq('id', sessionId)

    return NextResponse.json({
      response: responseText,
      messages: updatedMessages
    })
  } catch (error) {
    console.error('Erro no chat:', error)
    return NextResponse.json(
      { error: 'Erro ao processar mensagem' },
      { status: 500 }
    )
  }
}
