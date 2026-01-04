import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getRandomMaleClientName } from '@/lib/utils/randomNames'

const N8N_ROLEPLAY_WEBHOOK = 'https://ezboard.app.n8n.cloud/webhook/d40a1fd9-bfb3-4588-bd45-7bcf2123725d/chat'

// Cliente Supabase com service role (sem autenticação de usuário)
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
    const body = await request.json()
    const {
      // Lead info
      leadName,
      leadEmail,
      leadPhone,
      // Company info fornecido pelo lead
      companyInfo,
      // Config do roleplay
      businessType,
      personaData,
      objectionsData,
      clientAge,
      clientTemperament,
      objective
    } = body

    console.log('🔍 Dados recebidos no /api/teste/start:', {
      leadName,
      leadEmail,
      businessType,
      clientAge,
      clientTemperament
    })

    // Validações
    if (!leadName || !leadEmail || !leadPhone) {
      return NextResponse.json(
        { error: 'Nome, email e telefone são obrigatórios' },
        { status: 400 }
      )
    }

    if (!businessType || !personaData || !objectionsData || objectionsData.length === 0) {
      return NextResponse.json(
        { error: 'Configuração do roleplay incompleta' },
        { status: 400 }
      )
    }

    // Gerar threadId único para o N8N
    const threadId = `teste_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

    // Gerar nome aleatório para o cliente virtual
    const clientName = getRandomMaleClientName()
    console.log('👤 Nome do cliente gerado:', clientName)

    // Montar texto das objeções
    let objectionsText = 'Nenhuma objeção específica'
    if (objectionsData && objectionsData.length > 0) {
      objectionsText = objectionsData.map((obj: { name: string; rebuttals: string[] }, index: number) => {
        let text = `OBJEÇÃO ${index + 1}:\n${obj.name}`
        if (obj.rebuttals && obj.rebuttals.length > 0) {
          text += `\n\nFormas de quebrar esta objeção:`
          text += obj.rebuttals.map((r: string, i: number) => `\n  ${i + 1}. ${r}`).join('')
        }
        return text
      }).join('\n\n---\n\n')
    }

    // Montar informações da persona baseado no tipo
    let personaInfo = ''
    if (personaData) {
      if (businessType === 'B2B') {
        personaInfo = `
PERFIL DO CLIENTE B2B:
- Cargo: ${personaData.job_title || 'Não especificado'}
- Empresa: ${personaData.company_type || 'Não especificado'}
- Contexto: ${personaData.context || 'Não especificado'}
- O que busca para a empresa: ${personaData.company_goals || 'Não especificado'}
- Principais desafios do negócio: ${personaData.business_challenges || 'Não especificado'}`
      } else if (businessType === 'B2C') {
        personaInfo = `
PERFIL DO CLIENTE B2C:
- Profissão: ${personaData.profession || 'Não especificado'}
- Contexto: ${personaData.context || 'Não especificado'}
- O que busca/valoriza: ${personaData.what_seeks || 'Não especificado'}
- Principais dores/problemas: ${personaData.main_pains || 'Não especificado'}`
      }
    }

    console.log('📝 PersonaInfo montada:', personaInfo)
    console.log('📝 Objeções:', objectionsText.substring(0, 200) + '...')

    // Enviar contexto para N8N com variáveis separadas para System Prompt
    const n8nResponse = await fetch(N8N_ROLEPLAY_WEBHOOK, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'sendMessage',
        chatInput: 'Inicie a conversa como cliente',
        sessionId: threadId,
        // Dados da empresa do lead (informados por ele)
        companyName: companyInfo?.nome || 'Empresa do Lead',
        companyDescription: companyInfo?.descricao || '',
        companyType: businessType,
        // Variáveis para o System Prompt do agente N8N:
        nome: clientName,
        idade: clientAge,
        temperamento: clientTemperament,
        persona: personaInfo.trim(),
        objecoes: objectionsText,
        objetivo: objective || 'Simulação de venda'
      }),
    })

    if (!n8nResponse.ok) {
      const errorText = await n8nResponse.text()
      console.error('❌ Erro N8N:', errorText)
      throw new Error('Erro ao iniciar roleplay no N8N')
    }

    const n8nData = await n8nResponse.json()
    console.log('📨 Resposta N8N:', n8nData)

    // Parse response (N8N retorna [{output: "..."}])
    let firstMessage = ''
    if (Array.isArray(n8nData) && n8nData[0]?.output) {
      firstMessage = n8nData[0].output
    } else if (n8nData?.output) {
      firstMessage = n8nData.output
    } else if (typeof n8nData === 'string') {
      firstMessage = n8nData
    }

    // Criar sessão no banco de dados
    const sessionData = {
      lead_name: leadName,
      lead_email: leadEmail,
      lead_phone: leadPhone,
      company_info: companyInfo || {},
      business_type: businessType,
      persona_data: personaData,
      objections_data: objectionsData,
      client_age: clientAge,
      client_temperament: clientTemperament,
      objective: objective || null,
      thread_id: threadId,
      client_name: clientName,
      messages: [],
      status: 'in_progress',
      user_agent: request.headers.get('user-agent') || null,
      referrer: request.headers.get('referer') || null
    }

    console.log('💾 Salvando sessão...')

    const { data: session, error: sessionError } = await supabaseAdmin
      .from('test_roleplays')
      .insert(sessionData)
      .select()
      .single()

    if (sessionError) {
      console.error('❌ Erro ao criar sessão:', sessionError)
      return NextResponse.json(
        { error: 'Erro ao criar sessão' },
        { status: 500 }
      )
    }

    console.log('✅ Sessão criada:', session.id)

    return NextResponse.json({
      sessionId: session.id,
      threadId: threadId,
      firstMessage: firstMessage,
      clientName: clientName
    })
  } catch (error) {
    console.error('❌ Erro ao iniciar roleplay de teste:', error)
    return NextResponse.json(
      { error: 'Erro ao iniciar roleplay' },
      { status: 500 }
    )
  }
}
