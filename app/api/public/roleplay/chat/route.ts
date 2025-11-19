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
    const { sessionId, threadId, message } = await request.json()

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

    // Buscar dados da empresa
    const { data: companyData } = await supabaseAdmin
      .from('company_data')
      .select('*')
      .eq('company_id', session.company_id)
      .single()

    // Buscar company_type
    const { data: companyTypeData } = await supabaseAdmin
      .from('company_type')
      .select('type')
      .eq('company_id', session.company_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    const companyType = companyTypeData?.type || 'B2C'

    console.log('📤 Enviando para N8N:', {
      sessionId: threadId,
      chatInput: message.substring(0, 50) + '...',
      companyId: session.company_id,
      companyName: companyData?.nome
    })

    // Enviar para N8N
    const n8nResponse = await fetch(N8N_ROLEPLAY_WEBHOOK, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'sendMessage',
        sessionId: threadId,
        chatInput: message,
        companyId: session.company_id,
        companyName: companyData?.nome || null,
        companyDescription: companyData?.descricao || null,
        companyType: companyType
      })
    })

    if (!n8nResponse.ok) {
      const errorText = await n8nResponse.text()
      console.error('❌ Erro N8N:', n8nResponse.status, errorText)
      throw new Error('Erro ao processar mensagem no N8N')
    }

    const n8nData = await n8nResponse.json()
    console.log('📥 Resposta N8N:', n8nData)

    const responseText = n8nData.output || n8nData[0]?.output || ''
    console.log('💬 Texto extraído:', responseText.substring(0, 100))

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
