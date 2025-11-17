import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

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

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function POST(request: Request) {
  try {
    const {
      participantName,
      companyId,
      config // age, temperament, personaId, objectionIds
    } = await request.json()

    if (!participantName || !companyId) {
      return NextResponse.json(
        { error: 'Nome e empresa são obrigatórios' },
        { status: 400 }
      )
    }

    // Buscar persona selecionada
    const { data: persona } = await supabaseAdmin
      .from('personas')
      .select('*')
      .eq('id', config.personaId)
      .single()

    // Buscar objeções selecionadas
    const { data: objections } = await supabaseAdmin
      .from('objections')
      .select('*')
      .in('id', config.objectionIds)

    // Criar thread no OpenAI Assistant
    const thread = await openai.beta.threads.create()

    // Preparar contexto do roleplay
    const systemPrompt = `Você é um cliente ${config.age} anos, ${config.temperament.toLowerCase()},
      interessado em ${persona?.busca || 'produtos/serviços'}.
      Contexto: ${persona?.contexto || ''}
      Dores: ${persona?.dores || ''}
      Durante a conversa, apresente estas objeções: ${objections?.map(o => o.name).join(', ') || ''}
      Seja natural e realista na conversa.`

    // Criar sessão no banco de dados
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('roleplays_unicos')
      .insert({
        company_id: companyId,
        participant_name: participantName,
        thread_id: thread.id,
        config: {
          age: config.age,
          temperament: config.temperament,
          persona: persona,
          objections: objections,
          systemPrompt
        },
        status: 'em_andamento'
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

    // Incrementar contador de uso
    await supabaseAdmin.rpc('increment', {
      table_name: 'roleplay_links',
      column_name: 'usage_count',
      row_id: companyId
    })

    return NextResponse.json({
      sessionId: session.id,
      threadId: thread.id,
      config: session.config
    })
  } catch (error) {
    console.error('Erro ao iniciar roleplay:', error)
    return NextResponse.json(
      { error: 'Erro ao iniciar roleplay' },
      { status: 500 }
    )
  }
}