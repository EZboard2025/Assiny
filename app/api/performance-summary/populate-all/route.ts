import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Rota para popular resumos de todos os usuários com sessões existentes
export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    if (!supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Service role key not configured' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Buscar todos os usuários de todas as fontes (roleplay + meet)
    const [sessionsResult, meetResult] = await Promise.all([
      supabase
        .from('roleplay_sessions')
        .select('user_id')
        .not('evaluation', 'is', null),
      supabase
        .from('meet_evaluations')
        .select('user_id')
    ])

    if (sessionsResult.error) {
      return NextResponse.json(
        { error: 'Failed to fetch roleplay sessions' },
        { status: 500 }
      )
    }

    // Obter IDs únicos de usuários (roleplay + meet)
    const allUserIds = [
      ...(sessionsResult.data || []).map(s => s.user_id),
      ...(meetResult.data || []).map(m => m.user_id)
    ]
    const uniqueUserIds = Array.from(new Set(allUserIds))

    console.log(`📊 Encontrados ${uniqueUserIds.length} usuários com sessões completadas`)

    const results = []

    // Processar cada usuário
    for (const userId of uniqueUserIds) {
      try {
        console.log(`🔄 Processando usuário: ${userId}`)

        // Chamar a função de atualização (reutilizando a lógica da outra rota)
        const updateUrl = new URL('/api/performance-summary/update', request.url)

        const response = await fetch(updateUrl.toString(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId })
        })

        if (response.ok) {
          const data = await response.json()
          results.push({
            userId,
            success: true,
            data: data.data
          })
          console.log(`✅ Usuário ${userId} processado com sucesso`)
        } else {
          const error = await response.text()
          results.push({
            userId,
            success: false,
            error
          })
          console.error(`❌ Erro ao processar usuário ${userId}:`, error)
        }
      } catch (error: any) {
        results.push({
          userId,
          success: false,
          error: error.message
        })
        console.error(`❌ Exceção ao processar usuário ${userId}:`, error)
      }
    }

    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length

    return NextResponse.json({
      success: true,
      message: `Processamento concluído: ${successCount} sucessos, ${failCount} falhas`,
      totalUsers: uniqueUserIds.length,
      successCount,
      failCount,
      results
    })

  } catch (error: any) {
    console.error('❌ Erro ao popular resumos:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
