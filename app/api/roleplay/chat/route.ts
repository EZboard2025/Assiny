import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const N8N_ROLEPLAY_WEBHOOK = 'https://ezboard.app.n8n.cloud/webhook/d40a1fd9-bfb3-4588-bd45-7bcf2123725d/chat'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sessionId, message, config, userId, companyId } = body

    console.log('📨 Requisição recebida:', { sessionId, hasMessage: !!message, hasConfig: !!config, userId, companyId })

    // CASO 1: Criar nova sessão (início do roleplay)
    if (!sessionId && config) {
      console.log('🎭 Criando nova sessão de roleplay...')
      console.log('📋 Config:', config)

      // Gerar sessionId único
      const newSessionId = `roleplay_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
      console.log('✅ SessionId gerado:', newSessionId)

      // Buscar dados da empresa (filtrado por company_id)
      console.log('🏢 Buscando dados da empresa para company_id:', companyId)
      const { data: companyData, error: companyError } = await supabase
        .from('company_data')
        .select('*')
        .eq('company_id', companyId)
        .single()

      if (companyError) {
        console.warn('⚠️ Erro ao buscar company_data:', companyError)
      } else {
        console.log('✅ Dados da empresa encontrados:', companyData?.nome)
      }

      // Buscar company_type (B2B ou B2C)
      console.log('🏷️ Buscando company_type para company_id:', companyId)
      const { data: companyTypeData, error: companyTypeError } = await supabase
        .from('company_type')
        .select('name')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      const companyType = companyTypeData?.name || 'B2C' // Default B2C
      if (companyTypeError) {
        console.warn('⚠️ Erro ao buscar company_type:', companyTypeError)
      } else {
        console.log('✅ Company type encontrado:', companyType)
      }

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

      console.log('📝 Enviando contexto para N8N...')

      // Enviar para N8N com dados da empresa
      const response = await fetch(N8N_ROLEPLAY_WEBHOOK, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'sendMessage',
          chatInput: contextMessage,
          sessionId: newSessionId,
          userId: userId,
          companyId: companyId,
          companyData: companyData || null, // Dados da empresa para o agente
          companyType: companyType, // B2B ou B2C
        }),
      })

      if (!response.ok) {
        throw new Error(`N8N webhook error: ${response.status}`)
      }

      const data = await response.json()
      console.log('📨 Resposta do N8N:', data)

      // Parse response (N8N retorna [{output: "..."}])
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

      console.log('💬 Resposta:', responseText)

      return NextResponse.json({
        sessionId: newSessionId,
        message: responseText,
      })
    }

    // CASO 2: Continuar conversa existente
    if (sessionId && message) {
      console.log('💬 Continuando conversa:', sessionId)

      // Buscar dados da empresa (filtrado por company_id)
      console.log('🏢 Buscando dados da empresa para company_id:', companyId)
      const { data: companyData, error: companyError } = await supabase
        .from('company_data')
        .select('*')
        .eq('company_id', companyId)
        .single()

      if (companyError) {
        console.warn('⚠️ Erro ao buscar company_data:', companyError)
      } else {
        console.log('✅ Dados da empresa encontrados:', companyData?.nome)
      }

      // Buscar company_type (B2B ou B2C)
      console.log('🏷️ Buscando company_type para company_id:', companyId)
      const { data: companyTypeData, error: companyTypeError } = await supabase
        .from('company_type')
        .select('name')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      const companyType = companyTypeData?.name || 'B2C' // Default B2C
      if (companyTypeError) {
        console.warn('⚠️ Erro ao buscar company_type:', companyTypeError)
      } else {
        console.log('✅ Company type encontrado:', companyType)
      }

      // Enviar mensagem para N8N com dados da empresa
      const response = await fetch(N8N_ROLEPLAY_WEBHOOK, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'sendMessage',
          chatInput: message,
          sessionId: sessionId,
          userId: userId,
          companyId: companyId,
          companyData: companyData || null, // Dados da empresa para o agente
          companyType: companyType, // B2B ou B2C
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

      console.log('✅ Resposta:', responseText)

      return NextResponse.json({
        sessionId,
        message: responseText,
      })
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
