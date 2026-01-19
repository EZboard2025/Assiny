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

    const { leadId, sessionId, evaluation, transcription } = await request.json()

    if (!leadId && !sessionId) {
      return NextResponse.json(
        { error: 'leadId ou sessionId são obrigatórios' },
        { status: 400 }
      )
    }

    console.log(`✅ Completando desafio - Lead: ${leadId}, Session: ${sessionId}`)

    // Extrair overall_score da avaliação
    const overallScore = evaluation?.overall_score || evaluation?.score || null

    // Atualizar o lead com a avaliação
    const updateData = {
      status: 'completed',
      completed_at: new Date().toISOString(),
      evaluation: evaluation || null,
      transcription: transcription || null,
      overall_score: overallScore
    }

    // Executar update baseado em leadId ou sessionId
    const { data: lead, error: updateError } = leadId
      ? await supabaseAdmin
          .from('challenge_leads')
          .update(updateData)
          .eq('id', leadId)
          .select()
          .single()
      : await supabaseAdmin
          .from('challenge_leads')
          .update(updateData)
          .eq('session_id', sessionId)
          .select()
          .single()

    if (updateError) {
      console.error('Erro ao atualizar lead:', updateError)
      throw updateError
    }

    console.log(`✅ Lead atualizado com avaliação: ${lead.id}`)

    return NextResponse.json({
      success: true,
      lead
    })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro ao completar desafio'
    console.error('Erro ao completar desafio:', error)
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
