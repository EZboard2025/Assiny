import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'
import { getRandomMaleClientName } from '@/lib/utils/randomNames'
import { buildSystemPrompt } from '@/lib/roleplay/buildSystemPrompt'
import { enrichRoleplayWithRealData, formatEnrichmentForPrompt } from '@/lib/ml/enrichRoleplayWithRealData'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Limite de caracteres por mensagem do usuário (para evitar overflow)
const MAX_USER_MESSAGE_LENGTH = 10000
// Máximo de mensagens no histórico (para manter contexto gerenciável)
const MAX_HISTORY_MESSAGES = 100
// Timeout para a API da OpenAI (em ms)
const OPENAI_TIMEOUT = 90000

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

// Função para truncar mensagem se necessário
function truncateMessage(message: string, maxLength: number): string {
  if (message.length <= maxLength) return message
  return message.substring(0, maxLength) + '... [mensagem truncada]'
}


export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const body = await request.json()
    const {
      sessionId,
      message,
      config,
      userId,
      companyId,
      clientName,
      age,
      temperament,
      persona,
      objections,
      objective, // Objetivo do roleplay
      // Histórico de mensagens para manter contexto
      chatHistory
    } = body

    console.log('📨 [chat-v2] Requisição recebida:', {
      sessionId,
      hasMessage: !!message,
      hasConfig: !!config,
      userId,
      companyId,
      messageLength: message?.length,
      historyLength: chatHistory?.length
    })

    // CASO 1: Criar nova sessão (início do roleplay)
    if (!sessionId && config) {
      console.log('🎭 [chat-v2] Criando nova sessão de roleplay...')

      // Gerar sessionId único
      const newSessionId = `roleplay_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
      console.log('✅ SessionId gerado:', newSessionId)

      // Gerar nome aleatório para o cliente virtual
      const generatedClientName = getRandomMaleClientName()
      console.log('👤 Nome do cliente gerado:', generatedClientName)

      // Buscar dados da empresa
      console.log('🏢 Buscando dados da empresa para company_id:', companyId)
      const { data: companyData, error: companyError } = await supabase
        .from('company_data')
        .select('*')
        .eq('company_id', companyId)
        .single()

      if (companyError) {
        console.warn('⚠️ Erro ao buscar company_data:', companyError)
      }

      // Buscar company_type (B2B ou B2C)
      const { data: companyTypeData } = await supabase
        .from('company_type')
        .select('type')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      const companyType = companyTypeData?.type || 'B2C'

      // Formatar objeções
      let objectionsText = 'Nenhuma objeção específica'
      if (config.objections?.length > 0) {
        objectionsText = config.objections.map((obj: any, index: number) => {
          if (typeof obj === 'string') {
            return `OBJEÇÃO ${index + 1}:\n${obj}`
          }
          let text = `OBJEÇÃO ${index + 1}:\n${obj.name}`
          if (obj.rebuttals && obj.rebuttals.length > 0) {
            text += `\n\nFormas de quebrar esta objeção:`
            text += obj.rebuttals.map((r: string, i: number) => `\n  ${i + 1}. ${r}`).join('')
          }
          return text
        }).join('\n\n---\n\n')
      }

      // Formatar persona (usando nomes de campos do banco de dados)
      let personaInfo = ''
      if (config.persona) {
        const p = config.persona
        if (p.business_type === 'B2B') {
          personaInfo = `
PERFIL DO CLIENTE B2B:
- Cargo: ${p.cargo || 'Não especificado'}
- Empresa: ${p.tipo_empresa_faturamento || 'Não especificado'}
- Contexto: ${p.contexto || 'Não especificado'}
- O que busca para a empresa: ${p.busca || 'Não especificado'}
- Principais desafios do negócio: ${p.dores || 'Não especificado'}
- O que já sabe sobre sua empresa: ${p.prior_knowledge || 'Não sabe nada ainda'}`
        } else if (p.business_type === 'B2C') {
          personaInfo = `
PERFIL DO CLIENTE B2C:
- Profissão: ${p.profissao || 'Não especificado'}
- Contexto: ${p.contexto || 'Não especificado'}
- O que busca/valoriza: ${p.busca || 'Não especificado'}
- Principais dores/problemas: ${p.dores || 'Não especificado'}
- O que já sabe sobre sua empresa: ${p.prior_knowledge || 'Não sabe nada ainda'}`
        }
      }

      // ML Enrichment: query real meeting patterns (non-blocking, fallback to empty)
      let realDataEnrichment = ''
      if (companyId) {
        try {
          const enrichment = await enrichRoleplayWithRealData(companyId, {
            persona: personaInfo.trim(),
            objections: objectionsText,
            companyType,
            temperament: config.temperament || '',
          })
          realDataEnrichment = formatEnrichmentForPrompt(enrichment)
          if (enrichment.hasData) {
            console.log('🧠 [chat-v2] ML enrichment applied (real meeting data injected)')
          }
        } catch (mlErr: any) {
          console.warn('⚠️ [chat-v2] ML enrichment failed (non-fatal):', mlErr.message)
        }
      }

      // Construir system prompt
      const systemPrompt = buildSystemPrompt({
        companyName: companyData?.nome || null,
        companyDescription: companyData?.descricao || null,
        companyType,
        objetivo: config.objective?.name
          ? `${config.objective.name}${config.objective.description ? `\nDescrição: ${config.objective.description}` : ''}`
          : 'Não especificado',
        nome: generatedClientName,
        idade: config.age,
        temperamento: config.temperament,
        persona: personaInfo.trim(),
        objecoes: objectionsText,
        realDataEnrichment,
      })

      // Log das variáveis de personalização
      console.log('🎭 [chat-v2] VARIÁVEIS DE PERSONALIZAÇÃO:')
      console.log('  - Empresa:', companyData?.nome || 'Não especificado')
      console.log('  - Tipo:', companyType)
      console.log('  - Objetivo:', config.objective?.name || 'Não especificado')
      console.log('  - Nome cliente:', generatedClientName)
      console.log('  - Idade:', config.age)
      console.log('  - Temperamento:', config.temperament)
      console.log('  - Persona completa:', JSON.stringify(config.persona, null, 2))
      console.log('  - Persona formatada:', personaInfo)
      console.log('  - Objeções:', objectionsText.substring(0, 200) + '...')

      // Fazer chamada para OpenAI
      const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Inicie a conversa como cliente' }
      ]

      console.log('📤 [chat-v2] Enviando para OpenAI...')

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), OPENAI_TIMEOUT)

      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4.1',
          messages,
          max_tokens: 500,
          temperature: 0.8,
        })

        clearTimeout(timeoutId)

        const responseText = completion.choices[0]?.message?.content || 'Erro ao obter resposta'

        console.log('✅ [chat-v2] Resposta recebida:', responseText.substring(0, 100) + '...')
        console.log(`⏱️ [chat-v2] Tempo total: ${Date.now() - startTime}ms`)

        return NextResponse.json({
          sessionId: newSessionId,
          message: responseText,
          clientName: generatedClientName,
          // Retornar o system prompt para o frontend armazenar
          systemPrompt
        })
      } catch (openaiError: any) {
        clearTimeout(timeoutId)
        if (openaiError.name === 'AbortError') {
          console.error('❌ [chat-v2] Timeout na chamada OpenAI')
          return NextResponse.json(
            { error: 'Timeout ao processar mensagem. Tente novamente.' },
            { status: 504 }
          )
        }
        throw openaiError
      }
    }

    // CASO 2: Continuar conversa existente
    if (sessionId && message) {
      console.log('💬 [chat-v2] Continuando conversa:', sessionId)

      // Truncar mensagem se muito longa
      const truncatedMessage = truncateMessage(message, MAX_USER_MESSAGE_LENGTH)
      if (truncatedMessage !== message) {
        console.warn(`⚠️ [chat-v2] Mensagem truncada de ${message.length} para ${MAX_USER_MESSAGE_LENGTH} caracteres`)
      }

      // Buscar dados da empresa
      const { data: companyData } = await supabase
        .from('company_data')
        .select('*')
        .eq('company_id', companyId)
        .single()

      const { data: companyTypeData } = await supabase
        .from('company_type')
        .select('type')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      const companyType = companyTypeData?.type || 'B2C'

      // Formatar objeções
      let objectionsText = 'Nenhuma objeção específica'
      if (objections) {
        if (typeof objections === 'string') {
          objectionsText = objections
        } else if (Array.isArray(objections) && objections.length > 0) {
          objectionsText = objections.map((obj: any, index: number) => {
            if (typeof obj === 'string') {
              return `OBJEÇÃO ${index + 1}:\n${obj}`
            }
            let text = `OBJEÇÃO ${index + 1}:\n${obj.name}`
            if (obj.rebuttals && obj.rebuttals.length > 0) {
              text += `\n\nFormas de quebrar esta objeção:`
              text += obj.rebuttals.map((r: string, i: number) => `\n  ${i + 1}. ${r}`).join('')
            }
            return text
          }).join('\n\n')
        }
      }

      // Formatar persona (usando nomes de campos do banco de dados)
      let personaText = ''
      if (persona) {
        if (typeof persona === 'string') {
          personaText = persona
        } else if (typeof persona === 'object') {
          if (persona.business_type === 'B2B') {
            personaText = `Cargo: ${persona.cargo || 'Não especificado'}
Tipo de empresa: ${persona.tipo_empresa_faturamento || 'Não especificado'}
Contexto: ${persona.contexto || 'Não especificado'}
O que busca: ${persona.busca || 'Não especificado'}
Principais dores: ${persona.dores || 'Não especificado'}
O que já sabe sobre sua empresa: ${persona.prior_knowledge || 'Não sabe nada ainda'}`
          } else if (persona.business_type === 'B2C') {
            personaText = `Profissão: ${persona.profissao || 'Não especificado'}
Contexto: ${persona.contexto || 'Não especificado'}
O que busca/valoriza: ${persona.busca || 'Não especificado'}
Principais dores/problemas: ${persona.dores || 'Não especificado'}
O que já sabe sobre sua empresa: ${persona.prior_knowledge || 'Não sabe nada ainda'}`
          }
        }
      }

      // ML Enrichment: query real meeting patterns (non-blocking)
      let realDataEnrichment = ''
      if (companyId) {
        try {
          const enrichment = await enrichRoleplayWithRealData(companyId, {
            persona: personaText,
            objections: objectionsText,
            companyType,
            temperament: temperament || '',
          })
          realDataEnrichment = formatEnrichmentForPrompt(enrichment)
        } catch (mlErr: any) {
          console.warn('⚠️ [chat-v2] ML enrichment failed (non-fatal):', mlErr.message)
        }
      }

      // Construir system prompt
      const systemPrompt = buildSystemPrompt({
        companyName: companyData?.nome || null,
        companyDescription: companyData?.descricao || null,
        companyType,
        objetivo: objective?.name
          ? `${objective.name}${objective.description ? `\nDescrição: ${objective.description}` : ''}`
          : 'Não especificado',
        nome: clientName || 'Cliente',
        idade: age || '35',
        temperamento: temperament || 'Analítico',
        persona: personaText,
        objecoes: objectionsText,
        realDataEnrichment,
      })

      // Construir histórico de mensagens
      const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt }
      ]

      // Adicionar histórico de chat (limitado)
      if (chatHistory && Array.isArray(chatHistory)) {
        // Pegar apenas as últimas N mensagens para evitar overflow de contexto
        const limitedHistory = chatHistory.slice(-MAX_HISTORY_MESSAGES)

        if (chatHistory.length > MAX_HISTORY_MESSAGES) {
          console.warn(`⚠️ [chat-v2] Histórico limitado de ${chatHistory.length} para ${MAX_HISTORY_MESSAGES} mensagens`)
        }

        for (const msg of limitedHistory) {
          if (msg.role === 'client') {
            messages.push({ role: 'assistant', content: msg.text })
          } else if (msg.role === 'seller') {
            messages.push({ role: 'user', content: msg.text })
          }
        }
      }

      // Adicionar nova mensagem do usuário
      messages.push({ role: 'user', content: truncatedMessage })

      console.log(`📊 [chat-v2] Total de mensagens no contexto: ${messages.length}`)
      console.log('📤 [chat-v2] Enviando para OpenAI...')

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), OPENAI_TIMEOUT)

      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4.1',
          messages,
          max_tokens: 500,
          temperature: 0.8,
        })

        clearTimeout(timeoutId)

        const responseText = completion.choices[0]?.message?.content || 'Erro ao obter resposta'

        console.log('✅ [chat-v2] Resposta recebida:', responseText.substring(0, 100) + '...')
        console.log(`⏱️ [chat-v2] Tempo total: ${Date.now() - startTime}ms`)
        console.log(`📊 [chat-v2] Tokens usados: ${completion.usage?.total_tokens || 'N/A'}`)

        return NextResponse.json({
          sessionId,
          message: responseText,
          tokensUsed: completion.usage?.total_tokens
        })
      } catch (openaiError: any) {
        clearTimeout(timeoutId)
        if (openaiError.name === 'AbortError') {
          console.error('❌ [chat-v2] Timeout na chamada OpenAI')
          return NextResponse.json(
            { error: 'Timeout ao processar mensagem. Tente novamente.' },
            { status: 504 }
          )
        }
        throw openaiError
      }
    }

    return NextResponse.json({ error: 'Requisição inválida' }, { status: 400 })

  } catch (error: any) {
    console.error('❌ [chat-v2] Erro:', error)

    // Tratamento específico para erros da OpenAI
    if (error?.code === 'context_length_exceeded') {
      return NextResponse.json(
        {
          error: 'Conversa muito longa. Por favor, finalize esta sessão e inicie uma nova.',
          code: 'CONTEXT_TOO_LONG'
        },
        { status: 400 }
      )
    }

    if (error?.code === 'rate_limit_exceeded') {
      return NextResponse.json(
        {
          error: 'Muitas requisições. Aguarde alguns segundos e tente novamente.',
          code: 'RATE_LIMIT'
        },
        { status: 429 }
      )
    }

    return NextResponse.json(
      {
        error: 'Erro ao processar mensagem',
        details: error?.message || 'Erro desconhecido',
      },
      { status: 500 }
    )
  }
}
