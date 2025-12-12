import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getRandomMaleClientName } from '@/lib/utils/randomNames'

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

    console.log('🔍 Dados recebidos:', { participantName, companyId, linkId, config })

    if (!participantName || !companyId) {
      return NextResponse.json(
        { error: 'Nome e empresa são obrigatórios' },
        { status: 400 }
      )
    }

    // Gerar threadId único para o N8N
    const threadId = `roleplay_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

    // Gerar nome aleatório para o cliente virtual
    const clientName = getRandomMaleClientName()
    console.log('👤 Nome do cliente gerado:', clientName)

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
    console.log('🔍 Config completo recebido:', JSON.stringify(config, null, 2))
    console.log('🔍 Buscando persona com ID:', config.personaId)
    console.log('🔍 Tipo do personaId:', typeof config.personaId, '| Valor:', config.personaId)

    let persona = null
    if (config.personaId && config.personaId !== 'null' && config.personaId !== '') {
      const { data: personaData, error: personaError } = await supabaseAdmin
        .from('personas')
        .select('*')
        .eq('id', config.personaId)
        .single()

      persona = personaData
      console.log('👤 Persona retornada:', JSON.stringify(persona, null, 2))
      if (personaError) {
        console.error('❌ Erro ao buscar persona:', personaError)
      }
    } else {
      console.warn('⚠️ personaId está vazio, null ou inválido:', config.personaId)
    }

    // Buscar objeções completas
    console.log('🔍 Buscando objeções com IDs:', config.objectionIds)
    const { data: objections, error: objectionsError } = await supabaseAdmin
      .from('objections')
      .select('*')
      .in('id', config.objectionIds)

    console.log('📋 Objeções retornadas do banco:', objections)
    if (objectionsError) {
      console.error('❌ Erro ao buscar objeções:', objectionsError)
    }

    // Montar texto das objeções
    let objectionsText = 'Nenhuma objeção específica'
    if (objections && objections.length > 0) {
      objectionsText = objections.map((obj: any, index: number) => {
        let text = `OBJEÇÃO ${index + 1}:\n${obj.name}`
        if (obj.rebuttals && obj.rebuttals.length > 0) {
          text += `\n\nFormas de quebrar esta objeção:`
          text += obj.rebuttals.map((r: string, i: number) => `\n  ${i + 1}. ${r}`).join('')
        }
        return text
      }).join('\n\n---\n\n')
    }

    // Montar informações da persona - USANDO OS MESMOS CAMPOS DO ROLEPLAY DE TREINO
    let personaInfo = ''
    if (persona) {
      console.log('📊 Campos disponíveis na persona:', Object.keys(persona))
      if (persona.business_type === 'B2B') {
        personaInfo = `
PERFIL DO CLIENTE B2B:
- Cargo: ${persona.job_title || persona.cargo || 'Não especificado'}
- Empresa: ${persona.company_type || persona.tipo_empresa_faturamento || 'Não especificado'}
- Contexto: ${persona.context || persona.contexto || 'Não especificado'}
- O que busca para a empresa: ${persona.company_goals || persona.busca || 'Não especificado'}
- Principais desafios do negócio: ${persona.business_challenges || persona.dores || 'Não especificado'}`
      } else if (persona.business_type === 'B2C') {
        personaInfo = `
PERFIL DO CLIENTE B2C:
- Profissão: ${persona.profession || persona.cargo || 'Não especificado'}
- Contexto: ${persona.context || persona.contexto || 'Não especificado'}
- O que busca/valoriza: ${persona.what_seeks || persona.busca || 'Não especificado'}
- Principais dores/problemas: ${persona.main_pains || persona.dores || 'Não especificado'}`
      }
      console.log('📝 PersonaInfo montada:', personaInfo)
    }

    // Enviar contexto para N8N com variáveis separadas para System Prompt
    const n8nResponse = await fetch(N8N_ROLEPLAY_WEBHOOK, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'sendMessage',
        chatInput: 'Inicie a conversa como cliente',  // Mensagem simplificada
        sessionId: threadId,
        companyId: companyId,
        // Dados da empresa
        companyName: companyData?.nome || null,
        companyDescription: companyData?.descricao || null,
        companyType: companyType,
        // Variáveis para o System Prompt do agente N8N:
        nome: clientName,
        idade: config.age,
        temperamento: config.temperament,
        persona: personaInfo.trim(),
        objecoes: objectionsText
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
    const sessionData = {
      link_id: linkId,
      company_id: companyId,
      participant_name: participantName,
      thread_id: threadId,
      config: {
        age: config.age,
        temperament: config.temperament,
        persona: persona,
        objections: objections,
        clientName: clientName  // Armazenar o nome do cliente para uso nas próximas mensagens
      },
      messages: [],
      status: 'in_progress'
    }

    console.log('💾 Salvando sessão com dados:', sessionData)

    const { data: session, error: sessionError } = await supabaseAdmin
      .from('roleplays_unicos')
      .insert(sessionData)
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
      firstMessage: firstMessage,
      clientName: clientName  // Retornar o nome para o frontend
    })
  } catch (error) {
    console.error('Erro ao iniciar roleplay:', error)
    return NextResponse.json(
      { error: 'Erro ao iniciar roleplay' },
      { status: 500 }
    )
  }
}
