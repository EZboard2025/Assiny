import { NextRequest, NextResponse } from 'next/server'
import { generatePDI, EnrichedPerformance } from '@/lib/evaluation/generatePDI'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const {
      userId,
      userName,
      enrichedPerformance,
      companyName,
      companyDescription,
      companyType,
      personas,
      objections
    } = body

    // Validação básica
    if (!userId || !userName || !enrichedPerformance) {
      return NextResponse.json(
        { error: 'userId, userName e enrichedPerformance são obrigatórios' },
        { status: 400 }
      )
    }

    // Validar estrutura mínima do enrichedPerformance
    if (!enrichedPerformance.spin || !enrichedPerformance.totalSessions) {
      return NextResponse.json(
        { error: 'enrichedPerformance deve conter spin e totalSessions' },
        { status: 400 }
      )
    }

    console.log(`📋 Gerando PDI para ${userName} (${userId})`)
    console.log(`🏢 Empresa: ${companyName} (${companyType})`)
    console.log(`📊 Sessões: ${enrichedPerformance.totalSessions} | Tendência: ${enrichedPerformance.trend}`)

    // Gerar PDI via OpenAI com dados enriquecidos
    const pdiResult = await generatePDI({
      userId,
      userName,
      enrichedPerformance: enrichedPerformance as EnrichedPerformance,
      companyName: companyName || 'Empresa',
      companyDescription: companyDescription || '',
      companyType: companyType || 'B2B',
      personas: personas || 'Nenhuma persona cadastrada',
      objections: objections || 'Nenhuma objeção cadastrada'
    })

    console.log(`✅ PDI gerado - Foco: ${pdiResult.foco_da_semana?.area} | Indicador: ${pdiResult.foco_da_semana?.indicador_foco} | Nota: ${pdiResult.diagnostico?.nota_geral}`)

    return NextResponse.json({
      success: true,
      pdi: pdiResult
    })

  } catch (error: any) {
    console.error('❌ Erro ao gerar PDI:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao gerar PDI' },
      { status: 500 }
    )
  }
}
