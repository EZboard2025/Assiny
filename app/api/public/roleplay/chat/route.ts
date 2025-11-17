import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

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

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

// ID do Assistant de Vendas
const ASSISTANT_ID = 'asst_VZqff7anRma9K2vXcSa4hfNe'

export async function POST(request: Request) {
  try {
    const { sessionId, threadId, message } = await request.json()

    if (!sessionId || !threadId || !message) {
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
      .eq('status', 'em_andamento')
      .single()

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Sessão não encontrada ou já finalizada' },
        { status: 404 }
      )
    }

    // Adicionar mensagem ao thread
    await openai.beta.threads.messages.create(threadId, {
      role: 'user',
      content: message
    })

    // Executar o assistant
    const run = await openai.beta.threads.runs.create(threadId, {
      assistant_id: ASSISTANT_ID
    })

    // Aguardar resposta
    let runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id)
    while (runStatus.status !== 'completed' && runStatus.status !== 'failed') {
      await new Promise(resolve => setTimeout(resolve, 500))
      runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id)
    }

    if (runStatus.status === 'failed') {
      throw new Error('Assistant failed to respond')
    }

    // Obter mensagens
    const messages = await openai.beta.threads.messages.list(threadId)
    const lastMessage = messages.data[0]
    const responseText = lastMessage.content[0]?.type === 'text'
      ? lastMessage.content[0].text.value
      : ''

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