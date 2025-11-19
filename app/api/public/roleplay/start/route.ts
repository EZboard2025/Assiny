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
    const {
      participantName,
      companyId,
      linkId,
      config // age, temperament, personaId, objectionIds
    } = await request.json()

    if (!participantName || !companyId) {
      return NextResponse.json(
        { error: 'Nome e empresa são obrigatórios' },
        { status: 400 }
      )
    }

    // Gerar threadId único para o N8N
    const threadId = `roleplay_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

    // Buscar dados da empresa
    const { data: companyData } = await supabaseAdmin
      .from('company_data')
      .select('*')
      .eq('company_id', companyId)
      .single()

    // Buscar company_type (B2B ou B2C)
    const { data: companyTypeData } = await supabaseAdmin
      .from('company_type')
      .select('type')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    const companyType = companyTypeData?.type || 'B2C'

    // Buscar persona completa
    const { data: persona } = await supabaseAdmin
      .from('personas')
      .select('*')
      .eq('id', config.personaId)
      .single()

    // Buscar objeções completas
    const { data: objections } = await supabaseAdmin
      .from('objections')
      .select('*')
      .in('id', config.objectionIds)

    // Montar texto das objeções
    let objectionsText = 'Nenhuma objeção específica'
    if (objections && objections.length > 0) {
      objectionsText = objections.map((obj: any) => {
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
    if (persona) {
      if (persona.business_type === 'B2B') {
        personaInfo = `
PERFIL DO CLIENTE B2B:
- Cargo: ${persona.cargo || 'Não especificado'}
- Empresa: ${persona.tipo_empresa_faturamento || 'Não especificado'}
- Contexto: ${persona.contexto || 'Não especificado'}
- O que busca para a empresa: ${persona.busca || 'Não especificado'}
- Principais desafios do negócio: ${persona.dores || 'Não especificado'}`
      } else if (persona.business_type === 'B2C') {
        personaInfo = `
PERFIL DO CLIENTE B2C:
- Profissão: ${persona.cargo || 'Não especificado'}
- Contexto: ${persona.contexto || 'Não especificado'}
- O que busca/valoriza: ${persona.busca || 'Não especificado'}
- Principais dores/problemas: ${persona.dores || 'Não especificado'}`
      }
    }

    // Montar mensagem de contexto
    const contextMessage = `Você está em uma simulação de venda. Características do cliente:
- Idade: ${config.age} anos
- Temperamento: ${config.temperament}
${personaInfo}

Objeções que o cliente pode usar:
${objectionsText}

Interprete este personagem de forma realista e consistente com todas as características acima. Inicie a conversa como cliente.`

    // Enviar contexto para N8N e obter primeira resposta
    const n8nResponse = await fetch(N8N_ROLEPLAY_WEBHOOK, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'sendMessage',
        chatInput: contextMessage,
        sessionId: threadId,
        companyId: companyId,
        companyName: companyData?.nome || null,
        companyDescription: companyData?.descricao || null,
        companyType: companyType
      }),
    })

    if (!n8nResponse.ok) {
      throw new Error('Erro ao iniciar roleplay no N8N')
    }

    const n8nData = await n8nResponse.json()

    // Parse response (N8N retorna [{output: "..."}])
    let firstMessage = ''
    if (Array.isArray(n8nData) && n8nData[0]?.output) {
      firstMessage = n8nData[0].output
    } else if (n8nData?.output) {
      firstMessage = n8nData.output
    } else if (typeof n8nData === 'string') {
      firstMessage = n8nData
    }

    // Criar sessão no banco de dados (sem salvar a primeira mensagem)
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('roleplays_unicos')
      .insert({
        link_id: linkId,
        company_id: companyId,
        participant_name: participantName,
        thread_id: threadId,
        config: {
          age: config.age,
          temperament: config.temperament,
          persona: persona,
          objections: objections
        },
        messages: [],
        status: 'in_progress'
      })
      .select()
      .single()

    if (sessionError) {
      console.error('Erro ao criar sessão:', sessionError)
      return NextResponse.json(
        { error: 'Erro ao criar sessão' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      sessionId: session.id,
      threadId: threadId,
      firstMessage: firstMessage
    })
  } catch (error) {
    console.error('Erro ao iniciar roleplay:', error)
    return NextResponse.json(
      { error: 'Erro ao iniciar roleplay' },
      { status: 500 }
    )
  }
}
