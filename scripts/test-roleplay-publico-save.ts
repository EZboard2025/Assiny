import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function testRoleplayPublicoSave() {
  console.log('🔍 Verificando estrutura e dados da tabela roleplays_unicos...\n')

  // 1. Buscar últimas 3 sessões
  const { data: sessions, error } = await supabaseAdmin
    .from('roleplays_unicos')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(3)

  if (error) {
    console.error('❌ Erro ao buscar sessões:', error)
    return
  }

  if (!sessions || sessions.length === 0) {
    console.log('⚠️  Nenhuma sessão encontrada na tabela roleplays_unicos')
    return
  }

  console.log(`✅ Encontradas ${sessions.length} sessões\n`)

  // 2. Analisar cada sessão
  sessions.forEach((session, index) => {
    const divider = '--------------------------------------------------------------------------------'
    console.log('\n[SESSAO ' + (index + 1) + ']')
    console.log(divider)

    // Dados básicos
    console.log('ID:', session.id)
    console.log('Nome do Participante:', session.participant_name || '[NAO SALVO]')
    console.log('Link ID:', session.link_id || '[NAO SALVO]')
    console.log('Company ID:', session.company_id || '[NAO SALVO]')

    // Datas e duração
    console.log('\n[DATAS]:')
    console.log('  Inicio:', session.started_at || session.created_at || '[NAO SALVO]')
    console.log('  Fim:', session.ended_at || '[EM ANDAMENTO]')
    const durationText = session.duration_seconds ? session.duration_seconds + 's (' + Math.floor(session.duration_seconds / 60) + 'min)' : '[EM ANDAMENTO]'
    console.log('  Duracao:', durationText)

    // Status
    console.log('\n[STATUS]:')
    console.log('  Status:', session.status || '[NAO SALVO]')
    console.log('  Thread ID:', session.thread_id ? '[OK]' : '[NAO SALVO]')

    // Configuração
    console.log('\n[CONFIGURACAO]:')
    if (session.config) {
      const config = session.config as any
      console.log('  Idade:', config.age || '[NAO SALVO]')
      console.log('  Temperamento:', config.temperament || '[NAO SALVO]')
      console.log('  Persona:', config.persona?.cargo || '[NAO SALVO]')
      console.log('  Objecoes:', config.objections?.length || 0, 'itens')
    } else {
      console.log('  [CONFIGURACAO NAO SALVA]')
    }

    // Mensagens
    console.log('\n[MENSAGENS]:')
    if (session.messages && Array.isArray(session.messages)) {
      console.log('  Total:', session.messages.length, 'mensagens')
      if (session.messages.length > 0) {
        const firstMsg = (session.messages[0] as any).text?.substring(0, 50) + '...'
        const lastMsg = (session.messages[session.messages.length - 1] as any).text?.substring(0, 50) + '...'
        console.log('  Primeira:', firstMsg)
        console.log('  Ultima:', lastMsg)
      }
    } else {
      console.log('  [MENSAGENS NAO SALVAS]')
    }

    // Avaliação
    console.log('\n[AVALIACAO]:')
    if (session.evaluation) {
      const evalData = session.evaluation as any
      console.log('  [Avaliacao salva]')
      console.log('  Score Geral:', session.overall_score || evalData.overall_score || '[NAO SALVO]')
      console.log('  Nivel de Performance:', session.performance_level || evalData.performance_level || '[NAO SALVO]')

      // Verificar estrutura SPIN
      if (evalData.spin_evaluation) {
        const spin = evalData.spin_evaluation
        console.log('  SPIN Scores:')
        console.log('    S:', spin.S?.final_score !== undefined ? spin.S.final_score : '[X]')
        console.log('    P:', spin.P?.final_score !== undefined ? spin.P.final_score : '[X]')
        console.log('    I:', spin.I?.final_score !== undefined ? spin.I.final_score : '[X]')
        console.log('    N:', spin.N?.final_score !== undefined ? spin.N.final_score : '[X]')
      } else {
        console.log('  [SPIN Evaluation nao encontrada]')
      }
    } else {
      console.log('  [Avaliacao ainda nao foi executada]')
    }

    console.log('\n' + divider)
  })

  // 3. Resumo geral
  const divider2 = '================================================================================'
  console.log('\n\n[RESUMO GERAL]:')
  console.log(divider2)

  const completedSessions = sessions.filter(s => s.status === 'completed')
  const withEvaluation = sessions.filter(s => s.evaluation)
  const withScore = sessions.filter(s => s.overall_score !== null && s.overall_score !== undefined)

  console.log('[OK] Sessoes completas:', completedSessions.length, '/', sessions.length)
  console.log('[OK] Com avaliacao:', withEvaluation.length, '/', sessions.length)
  console.log('[OK] Com score:', withScore.length, '/', sessions.length)

  // Verificar campos críticos
  const criticalFieldsCheck = {
    participant_name: sessions.every(s => s.participant_name),
    dates: sessions.every(s => s.started_at || s.created_at),
    config: sessions.every(s => s.config),
    messages: sessions.every(s => s.messages && Array.isArray(s.messages))
  }

  console.log('\n[VERIFICACAO DE CAMPOS CRITICOS]:')
  Object.entries(criticalFieldsCheck).forEach(([field, isOk]) => {
    console.log('  ' + (isOk ? '[OK]' : '[FAIL]') + ' ' + field)
  })

  console.log('\n')
}

testRoleplayPublicoSave()
