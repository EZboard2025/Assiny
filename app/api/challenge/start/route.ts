import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    if (!serviceRoleKey) {
      console.error('SUPABASE_SERVICE_ROLE_KEY não configurada')
      return NextResponse.json(
        { error: 'Configuração do servidor incompleta' },
        { status: 500 }
      )
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    const { name, email, sessionId } = await request.json()

    if (!name || !email || !sessionId) {
      return NextResponse.json(
        { error: 'Nome, email e sessionId são obrigatórios' },
        { status: 400 }
      )
    }

    console.log(`🎯 Iniciando desafio para: ${name} (${email})`)

    // Criar lead no banco
    const { data: lead, error: leadError } = await supabaseAdmin
      .from('challenge_leads')
      .insert({
        name,
        email,
        session_id: sessionId,
        status: 'active',
        started_at: new Date().toISOString()
      })
      .select()
      .single()

    if (leadError) {
      console.error('Erro ao criar lead:', leadError)
      throw leadError
    }

    console.log(`✅ Lead criado: ${lead.id}`)

    return NextResponse.json({
      success: true,
      leadId: lead.id,
      sessionId: lead.session_id
    })

  } catch (error: any) {
    console.error('Erro ao iniciar desafio:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao iniciar desafio' },
      { status: 500 }
    )
  }
}
