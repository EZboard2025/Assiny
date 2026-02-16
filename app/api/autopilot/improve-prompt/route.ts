import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' })

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { answers, currentInstructions, profileName } = await req.json()

    if (!answers) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    // Get user from auth token
    const authHeader = req.headers.get('authorization')
    let companyId: string | null = null
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '')
      const { data: { user } } = await supabaseAdmin.auth.getUser(token)
      if (user) {
        const { data: emp } = await supabaseAdmin
          .from('employees')
          .select('company_id')
          .eq('user_id', user.id)
          .limit(1)
        companyId = emp?.[0]?.company_id || null
      }
    }

    // Load company data for context
    const { data: companyData } = companyId ? await supabaseAdmin
      .from('company_data')
      .select('nome, descricao, produtos_servicos, funcao_produtos, diferenciais')
      .eq('company_id', companyId)
      .limit(1) : { data: null }

    const company = companyData?.[0]

    const systemPrompt = `Voce e um especialista em criar instrucoes de alta performance para agentes de IA de vendas no WhatsApp.

O vendedor respondeu 6 perguntas estrategicas sobre como quer que a IA atue. Com base nas respostas dele e nos dados da empresa, gere uma instrucao COMPLETA e ESTRUTURADA que o agente vai seguir.

${company ? `DADOS DA EMPRESA:
- Nome: ${company.nome || 'N/A'}
- Descricao: ${company.descricao || 'N/A'}
- Produtos/Servicos: ${company.produtos_servicos || 'N/A'}
- Funcao: ${company.funcao_produtos || 'N/A'}
- Diferenciais: ${company.diferenciais || 'N/A'}` : ''}

${profileName ? `PERFIL DE LEAD: Este prompt e para leads do tipo "${profileName}". Adapte a instrucao especificamente para esse perfil de lead.\n` : ''}${currentInstructions ? `INSTRUCAO ATUAL (para melhorar, nao repetir):\n${currentInstructions}` : ''}

RESPOSTAS DO VENDEDOR:
1. Objetivo (pra onde levar a conversa): ${answers.objetivo || 'Nao informado'}
2. Estrategia (como chegar la): ${answers.estrategia || 'Nao informado'}
3. Contexto dos leads (o que a IA precisa saber): ${answers.contexto || 'Nao informado'}
4. Limites e restricoes (o que NAO fazer): ${answers.restricoes || 'Nao informado'}
5. Escalonamento (quando parar e chamar o vendedor): ${answers.escalonamento || 'Nao informado'}

FORMATO DA INSTRUCAO GERADA:
Use EXATAMENTE este formato com as 5 secoes. Cada secao em uma linha, separada por quebra de linha.
Escreva de forma direta, como se o vendedor estivesse instruindo um assistente humano.
Linguagem simples, pratica, sem jargao corporativo.
Maximo 600 caracteres no total.
Preencha cada secao com base nas respostas acima. Se uma resposta estiver vazia, crie algo coerente com as outras respostas.

Objetivo: [acao concreta em 1 frase]
Estrategia: [abordagem em 1-2 frases]
Contexto: [o que a IA precisa saber em 1-2 frases]
Nao fazer: [lista curta separada por virgulas]
Escalonar quando: [situacoes em 1 frase]

Responda APENAS com a instrucao no formato acima, nada mais.`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Gere a instrucao otimizada no formato estruturado.' }
      ],
      max_tokens: 500,
      temperature: 0.7
    })

    const improvedPrompt = completion.choices[0]?.message?.content?.trim() || ''

    return NextResponse.json({ prompt: improvedPrompt })
  } catch (error: any) {
    console.error('[Autopilot] Improve prompt error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
