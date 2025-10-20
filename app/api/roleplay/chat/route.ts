import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const ASSISTANT_ID = process.env.OPENAI_ASSISTANT_ID_ROLEPLAY || ''

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { threadId, message, config } = body

    console.log('📨 Requisição recebida:', { threadId, hasMessage: !!message, hasConfig: !!config })

    // Validar API Key
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API Key não configurada' }, { status: 500 })
    }

    // Validar Assistant ID
    if (!ASSISTANT_ID) {
      return NextResponse.json({ error: 'Assistant ID não configurado' }, { status: 500 })
    }

    // CASO 1: Criar nova thread (início do roleplay)
    if (!threadId && config) {
      console.log('🎭 Criando nova sessão de roleplay...')
      console.log('📋 Config:', config)

      const thread = await openai.beta.threads.create()
      console.log('✅ Thread criada:', thread.id)

      // Montar mensagem de contexto
      let objectionsText = 'Nenhuma objeção específica'
      if (config.objections?.length > 0) {
        objectionsText = config.objections.map((obj: any) => {
          if (typeof obj === 'string') {
            return obj
          }
          // Formato novo: { name: string, rebuttals: string[] }
          let text = obj.name
          if (obj.rebuttals && obj.rebuttals.length > 0) {
            text += `\n  Formas de quebrar esta objeção:\n`
            text += obj.rebuttals.map((r: string, i: number) => `  ${i + 1}. ${r}`).join('\n')
          }
          return text
        }).join('\n\n')
      }

      // Montar informações da persona
      let personaInfo = ''
      if (config.persona) {
        const p = config.persona
        if (p.business_type === 'B2B') {
          personaInfo = `
PERFIL DO CLIENTE B2B:
- Cargo: ${p.job_title || 'Não especificado'}
- Empresa: ${p.company_type || 'Não especificado'}
- Contexto: ${p.context || 'Não especificado'}
- O que busca para a empresa: ${p.company_goals || 'Não especificado'}
- Principais desafios do negócio: ${p.business_challenges || 'Não especificado'}
- O que já sabe sobre sua empresa: ${p.prior_knowledge || 'Não sabe nada ainda'}`
        } else if (p.business_type === 'B2C') {
          personaInfo = `
PERFIL DO CLIENTE B2C:
- Profissão: ${p.profession || 'Não especificado'}
- Contexto: ${p.context || 'Não especificado'}
- O que busca/valoriza: ${p.what_seeks || 'Não especificado'}
- Principais dores/problemas: ${p.main_pains || 'Não especificado'}
- O que já sabe sobre sua empresa: ${p.prior_knowledge || 'Não sabe nada ainda'}`
        }
      }

      const contextMessage = `Você está em uma simulação de venda. Características do cliente:
- Idade: ${config.age} anos
- Temperamento: ${config.temperament}
${personaInfo}

Objeções que o cliente pode usar:
${objectionsText}

Interprete este personagem de forma realista e consistente com todas as características acima. Inicie a conversa como cliente.`

      console.log('📝 Enviando contexto...')

      // Adicionar contexto à thread
      await openai.beta.threads.messages.create(thread.id, {
        role: 'user',
        content: contextMessage,
      })

      // Executar assistant
      console.log('🚀 Executando assistant...')
      const run = await openai.beta.threads.runs.createAndPoll(thread.id, {
        assistant_id: ASSISTANT_ID,
      })

      console.log('✅ Run completado:', run.status)

      if (run.status === 'completed') {
        const messages = await openai.beta.threads.messages.list(thread.id)
        const lastMessage = messages.data[0]
        const responseText = lastMessage.content[0].type === 'text'
          ? lastMessage.content[0].text.value
          : 'Erro ao obter resposta'

        console.log('💬 Resposta:', responseText)

        return NextResponse.json({
          threadId: thread.id,
          message: responseText,
        })
      } else {
        throw new Error(`Run status: ${run.status}`)
      }
    }

    // CASO 2: Continuar conversa existente
    if (threadId && message) {
      console.log('💬 Continuando conversa:', threadId)

      // Adicionar mensagem do vendedor
      await openai.beta.threads.messages.create(threadId, {
        role: 'user',
        content: message,
      })

      // Executar assistant e aguardar resposta
      const run = await openai.beta.threads.runs.createAndPoll(threadId, {
        assistant_id: ASSISTANT_ID,
      })

      if (run.status === 'completed') {
        const messages = await openai.beta.threads.messages.list(threadId)
        const lastMessage = messages.data[0]
        const responseText = lastMessage.content[0].type === 'text'
          ? lastMessage.content[0].text.value
          : 'Erro ao obter resposta'

        console.log('✅ Resposta:', responseText)

        return NextResponse.json({
          threadId,
          message: responseText,
        })
      } else {
        throw new Error(`Run status: ${run.status}`)
      }
    }

    return NextResponse.json({ error: 'Requisição inválida' }, { status: 400 })

  } catch (error: any) {
    console.error('❌ Erro:', error)
    return NextResponse.json(
      {
        error: 'Erro ao processar mensagem',
        details: error?.message || 'Erro desconhecido',
      },
      { status: 500 }
    )
  }
}
