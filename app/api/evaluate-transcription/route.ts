import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { evaluateRoleplay } from '@/lib/evaluation/evaluateRoleplay'

const supabase = createClient(
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
    const { transcription, companyId } = await request.json()

    if (!transcription || !transcription.trim()) {
      return NextResponse.json({ error: 'Transcrição é obrigatória' }, { status: 400 })
    }

    console.log('📋 Avaliação de transcrição colada | Empresa:', companyId || 'não informada')
    console.log('📝 Tamanho:', transcription.length, 'caracteres')

    // Buscar objetivo padrão (genérico)
    const objetivo = 'Avaliar a performance do vendedor com base na transcrição fornecida'

    // Montar perfil genérico do cliente (sem config de roleplay)
    const clientProfile = `PERFIL DO CLIENTE SIMULADO

DADOS DEMOGRÁFICOS:
- Idade: Não especificado
- Temperamento: Não especificado
- Persona/Segmento: Não especificado

OBJETIVO DO ROLEPLAY:
Avaliação manual de transcrição colada

OBJEÇÕES TRABALHADAS:

Nenhuma objeção específica foi configurada — avalie quaisquer objeções que apareçam naturalmente na transcrição.`

    const evaluation = await evaluateRoleplay({
      transcription,
      clientProfile,
      objetivo,
      companyId: companyId || null
    })

    console.log('✅ Avaliação pronta - Score:', evaluation.overall_score, '| Level:', evaluation.performance_level)

    return NextResponse.json({
      success: true,
      evaluation
    })

  } catch (error: any) {
    console.error('❌ Erro na avaliação de transcrição:', error)
    return NextResponse.json(
      { error: error.message || 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
