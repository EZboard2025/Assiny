import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

const ASSISTANT_ID = 'asst_D57k3beQ4axOMy22FVzpjomu'

export async function POST(request: NextRequest) {
  try {
    const { message, sessionId, threadId } = await request.json()

    if (!message || !sessionId) {
      return NextResponse.json(
        { error: 'Mensagem e sessionId são obrigatórios' },
        { status: 400 }
      )
    }

    console.log(`💬 Mensagem recebida: ${message}`)
    console.log(`🧵 Thread ID: ${threadId || 'Nova thread'}`)

    // Criar ou reutilizar thread
    let currentThreadId: string = threadId || ''

    if (!currentThreadId) {
      console.log('🆕 Criando nova thread...')
      const thread = await openai.beta.threads.create()
      currentThreadId = thread.id
      console.log(`✅ Thread criada: ${currentThreadId}`)
    }

    // Verificar que temos um threadId válido
    if (!currentThreadId) {
      throw new Error('Falha ao criar/obter thread ID')
    }

    console.log(`🧵 Usando thread: ${currentThreadId}`)

    // Adicionar mensagem do usuário à thread
    await openai.beta.threads.messages.create(currentThreadId, {
      role: 'user',
      content: message
    })

    console.log('📤 Mensagem adicionada à thread')

    // Executar o assistant e aguardar conclusão (usa createAndPoll para evitar bugs do SDK)
    console.log(`🏃 Iniciando run com createAndPoll...`)

    const run = await openai.beta.threads.runs.createAndPoll(currentThreadId, {
      assistant_id: ASSISTANT_ID
    })

    console.log(`✅ Run completado com status: ${run.status}`)

    if (run.status !== 'completed') {
      console.error(`❌ Run falhou: ${run.status}`)
      throw new Error(`Assistant run failed: ${run.status}`)
    }

    // Buscar a última mensagem do assistant
    const messages = await openai.beta.threads.messages.list(currentThreadId, {
      limit: 1,
      order: 'desc'
    })

    const lastMessage = messages.data[0]

    if (!lastMessage || lastMessage.role !== 'assistant') {
      throw new Error('Nenhuma resposta do assistant encontrada')
    }

    // Extrair texto da resposta
    let aiResponse = ''
    for (const content of lastMessage.content) {
      if (content.type === 'text') {
        aiResponse += content.text.value
      }
    }

    console.log(`🤖 Resposta da IA: ${aiResponse.substring(0, 100)}...`)

    return NextResponse.json({
      success: true,
      response: aiResponse,
      threadId: currentThreadId
    })

  } catch (error: any) {
    console.error('Erro no chat do desafio:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao processar mensagem' },
      { status: 500 }
    )
  }
}
