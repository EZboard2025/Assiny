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

    // Extrair dados da configuração da sessão para manter consistência
    const sessionConfig = session.config || {}
    const clientName = sessionConfig.clientName || 'Cliente'
    const age = sessionConfig.age || 30
    const temperament = sessionConfig.temperament || 'Analítico'

    // Formatar persona e objeções
    let personaFormatted = ''
    if (sessionConfig.persona) {
      const p = sessionConfig.persona
      if (p.business_type === 'B2B') {
        personaFormatted = `
PERFIL DO CLIENTE B2B:
- Cargo: ${p.cargo || 'Não especificado'}
- Empresa: ${p.tipo_empresa_faturamento || 'Não especificado'}
- Contexto: ${p.contexto || 'Não especificado'}
- O que busca: ${p.busca || 'Não especificado'}
- Principais desafios: ${p.dores || 'Não especificado'}`
      } else if (p.business_type === 'B2C') {
        personaFormatted = `
PERFIL DO CLIENTE B2C:
- Profissão: ${p.cargo || 'Não especificado'}
- Contexto: ${p.contexto || 'Não especificado'}
- O que busca: ${p.busca || 'Não especificado'}
- Principais dores: ${p.dores || 'Não especificado'}`
      }
    }

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

    console.log('📤 Enviando para N8N:', {
      sessionId: threadId,
      chatInput: message.substring(0, 50) + '...',
      companyId: session.company_id,
      companyName: companyData?.nome,
      clientName: clientName
    })

    // Enviar para N8N com variáveis separadas para System Prompt
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
        // Dados da empresa
        companyName: companyData?.nome || null,
        companyDescription: companyData?.descricao || null,
        companyType: companyType,
        // Variáveis para o System Prompt do agente N8N:
        nome: clientName,
        idade: age,
        temperamento: temperament,
        persona: personaFormatted.trim(),
        objecoes: objectionsFormatted
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
