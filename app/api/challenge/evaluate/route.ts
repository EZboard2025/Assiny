import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { evaluateSimpleChallenge } from '@/lib/evaluation/evaluateSimpleChallenge'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { transcription, sessionId, leadId, userId } = await request.json()

    if (!transcription || !sessionId) {
      return NextResponse.json(
        { error: 'Transcrição e sessionId são obrigatórios' },
        { status: 400 }
      )
    }

    console.log(`📊 Avaliando desafio - Session: ${sessionId}`)
    console.log(`📋 Transcrição recebida (${transcription?.length || 0} chars):`, transcription?.substring(0, 1000))
    console.log(`🎯 LeadId: ${leadId || 'não fornecido'}`)
    console.log(`👤 UserId: ${userId || 'não fornecido'}`)

    // Buscar company_id do usuário
    let companyId: string | null = null
    if (userId) {
      const { data: employeeData } = await supabase
        .from('employees')
        .select('company_id')
        .eq('user_id', userId)
        .single()

      companyId = employeeData?.company_id || null
      if (companyId) {
        console.log('✅ company_id encontrado:', companyId)
      } else {
        console.warn('⚠️ company_id não encontrado para o usuário:', userId)
      }
    }

    // Avaliar desafio diretamente via OpenAI (substituiu N8N)
    console.log('📤 Iniciando avaliação direta via OpenAI...')

    const evaluation = await evaluateSimpleChallenge({
      transcription,
      companyId
    })

    console.log(`✅ Avaliação concluída - Score: ${evaluation.overall_score} | Level: ${evaluation.performance_level}`)
    if (evaluation.playbook_adherence) {
      console.log(`📖 Playbook Adherence - Score: ${evaluation.playbook_adherence.overall_adherence_score}%`)
    }

    return NextResponse.json({
      success: true,
      evaluation
    })

  } catch (error: any) {
    console.error('Erro na avaliação do desafio:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao avaliar desafio' },
      { status: 500 }
    )
  }
}
