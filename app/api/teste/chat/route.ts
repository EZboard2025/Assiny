import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const N8N_ROLEPLAY_WEBHOOK = 'https://ezboard.app.n8n.cloud/webhook/d40a1fd9-bfb3-4588-bd45-7bcf2123725d/chat'

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
    const { sessionId, threadId, message, clientName, age, temperament, persona, objections, companyInfo, businessType, objective } = await request.json()

    if (!sessionId || !threadId || !message) {
      return NextResponse.json(
        { error: 'sessionId, threadId e message são obrigatórios' },
        { status: 400 }
      )
    }

    console.log('💬 Enviando mensagem para N8N:', { sessionId, threadId, messageLength: message.length })

    // Formatar objeções como texto se vierem como array/objeto
    let objectionsText = 'Nenhuma objeção específica'
    if (objections) {
      if (typeof objections === 'string') {
        objectionsText = objections
      } else if (Array.isArray(objections) && objections.length > 0) {
        objectionsText = objections.map((obj: { name: string; rebuttals?: string[] }, index: number) => {
          let text = `OBJEÇÃO ${index + 1}:\n${obj.name}`
          if (obj.rebuttals && obj.rebuttals.length > 0) {
            text += `\n\nFormas de quebrar esta objeção:`
            text += obj.rebuttals.map((r: string, i: number) => `\n  ${i + 1}. ${r}`).join('')
          }
          return text
        }).join('\n\n')
      }
    }

    // Formatar persona como texto
    let personaText = ''
    if (persona) {
      if (typeof persona === 'string') {
        personaText = persona
      } else if (typeof persona === 'object') {
        if (businessType === 'B2B') {
          personaText = `Cargo: ${persona.job_title || 'Não especificado'}
Tipo de empresa: ${persona.company_type || 'Não especificado'}
Contexto: ${persona.context || 'Não especificado'}
O que busca: ${persona.company_goals || 'Não especificado'}
Principais dores: ${persona.business_challenges || 'Não especificado'}`
        } else if (businessType === 'B2C') {
          personaText = `Profissão: ${persona.profession || 'Não especificado'}
Contexto: ${persona.context || 'Não especificado'}
O que busca/valoriza: ${persona.what_seeks || 'Não especificado'}
Principais dores/problemas: ${persona.main_pains || 'Não especificado'}`
        }
      }
    }

    // Enviar mensagem para N8N
    const response = await fetch(N8N_ROLEPLAY_WEBHOOK, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'sendMessage',
        chatInput: message,
        sessionId: threadId,
        // Dados da empresa do lead
        companyName: companyInfo?.nome || 'Empresa do Lead',
        companyDescription: companyInfo?.descricao || '',
        companyType: businessType || 'B2B',
        // Variáveis para consistência do System Prompt
        nome: clientName || 'Cliente',
        idade: age || '35',
        temperamento: temperament || 'Analítico',
        persona: personaText,
        objecoes: objectionsText,
        objetivo: objective || 'Simulação de venda'
      }),
    })

    if (!response.ok) {
      throw new Error(`N8N webhook error: ${response.status}`)
    }

    const data = await response.json()
    console.log('📨 Resposta do N8N:', data)

    // Parse response
    let responseText = ''
    if (Array.isArray(data) && data[0]?.output) {
      responseText = data[0].output
    } else if (data?.output) {
      responseText = data.output
    } else if (typeof data === 'string') {
      responseText = data
    } else {
      responseText = 'Erro ao obter resposta'
    }

    // Atualizar mensagens na sessão
    const { data: session } = await supabaseAdmin
      .from('test_roleplays')
      .select('messages')
      .eq('id', sessionId)
      .single()

    const currentMessages = session?.messages || []
    const updatedMessages = [
      ...currentMessages,
      { role: 'seller', text: message, timestamp: new Date().toISOString() },
      { role: 'client', text: responseText, timestamp: new Date().toISOString() }
    ]

    await supabaseAdmin
      .from('test_roleplays')
      .update({ messages: updatedMessages })
      .eq('id', sessionId)

    console.log('✅ Mensagens atualizadas, total:', updatedMessages.length)

    return NextResponse.json({
      sessionId,
      message: responseText,
      messages: updatedMessages
    })
  } catch (error) {
    console.error('❌ Erro no chat:', error)
    return NextResponse.json(
      { error: 'Erro ao processar mensagem' },
      { status: 500 }
    )
  }
}
