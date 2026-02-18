import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { PLAN_CONFIGS, PlanType } from '@/lib/types/plans'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    const { data: { user } } = await supabaseAdmin.auth.getUser(token)
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Verify role is admin or gestor
    const { data: requestingEmployee } = await supabaseAdmin
      .from('employees')
      .select('company_id, role')
      .eq('user_id', user.id)
      .single()

    if (!requestingEmployee?.company_id) {
      return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 })
    }

    const role = (requestingEmployee.role || '').toLowerCase()
    if (role !== 'admin' && role !== 'gestor') {
      return NextResponse.json({ error: 'Acesso restrito a gestores' }, { status: 403 })
    }

    const companyId = requestingEmployee.company_id
    const { userMessage, conversationHistory } = await request.json()

    if (!userMessage) {
      return NextResponse.json({ error: 'Mensagem é obrigatória' }, { status: 400 })
    }

    // Check credits
    const { data: companyCredits } = await supabaseAdmin
      .from('companies')
      .select('training_plan, monthly_credits_used, monthly_credits_reset_at, extra_monthly_credits')
      .eq('id', companyId)
      .single()

    if (companyCredits) {
      const lastReset = new Date(companyCredits.monthly_credits_reset_at)
      const now = new Date()
      const isNewMonth = now.getMonth() !== lastReset.getMonth() ||
                         now.getFullYear() !== lastReset.getFullYear()

      let currentCreditsUsed = companyCredits.monthly_credits_used || 0

      if (isNewMonth) {
        await supabaseAdmin
          .from('companies')
          .update({ monthly_credits_used: 0, extra_monthly_credits: 0, monthly_credits_reset_at: now.toISOString() })
          .eq('id', companyId)
        currentCreditsUsed = 0
      }

      const planConfig = PLAN_CONFIGS[companyCredits.training_plan as PlanType]
      const baseLimit = planConfig?.monthlyCredits
      const extraCredits = companyCredits.extra_monthly_credits || 0

      if (baseLimit !== null) {
        const remaining = (baseLimit + extraCredits) - currentCreditsUsed
        if (remaining <= 0) {
          return NextResponse.json({ error: 'Créditos mensais esgotados' }, { status: 403 })
        }
      }
    }

    // Fetch ALL company data in parallel — NO LIMITS
    const [
      employeesResult,
      roleplayResult,
      meetsResult,
      challengesResult,
      followupsResult,
      summariesResult,
      pdisResult,
      playbookResult,
      whatsappEvalsResult,
      companyDataResult,
      companyInfoResult
    ] = await Promise.all([
      // All employees
      supabaseAdmin
        .from('employees')
        .select('user_id, name, email, role')
        .eq('company_id', companyId),

      // ALL roleplay sessions — no limit
      supabaseAdmin
        .from('roleplay_sessions')
        .select('user_id, created_at, evaluation, status')
        .eq('status', 'completed')
        .not('evaluation', 'is', null)
        .order('created_at', { ascending: false }),

      // ALL meet evaluations — no limit
      supabaseAdmin
        .from('meet_evaluations')
        .select('user_id, seller_name, created_at, evaluation, overall_score, performance_level, spin_s_score, spin_p_score, spin_i_score, spin_n_score')
        .order('created_at', { ascending: false }),

      // ALL daily challenges — no limit
      supabaseAdmin
        .from('daily_challenges')
        .select('user_id, created_at, challenge_type, score, completed, feedback')
        .order('created_at', { ascending: false }),

      // ALL follow-up analyses — no limit
      supabaseAdmin
        .from('followup_analyses')
        .select('user_id, created_at, nota_final, classificacao, tipo_venda, fase_funil, avaliacao')
        .order('created_at', { ascending: false }),

      // Performance summaries
      supabaseAdmin
        .from('user_performance_summaries')
        .select('*'),

      // ALL PDIs (active and inactive)
      supabaseAdmin
        .from('pdis')
        .select('user_id, created_at, status, meta_objetivo, resumo, nota_situacao, nota_problema, nota_implicacao, nota_necessidade')
        .order('created_at', { ascending: false }),

      // Company playbook — FULL content
      supabaseAdmin
        .from('sales_playbooks')
        .select('title, content')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single(),

      // ALL WhatsApp round evaluations — NO date limit
      supabaseAdmin
        .from('conversation_round_evaluations')
        .select('user_id, created_at, nota_final, avaliacao, contact_name, contact_phone')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false }),

      // Company data (info about the company)
      supabaseAdmin
        .from('company_data')
        .select('*')
        .eq('company_id', companyId)
        .limit(1)
        .single(),

      // Company info
      supabaseAdmin
        .from('companies')
        .select('name, subdomain')
        .eq('id', companyId)
        .single()
    ])

    const employees = employeesResult.data || []
    const companyUserIds = employees.map(e => e.user_id)
    const companyName = companyInfoResult.data?.name || 'Empresa'

    // Filter data to company users only
    const roleplaySessions = (roleplayResult.data || []).filter((s: any) => companyUserIds.includes(s.user_id))
    const meetEvaluations = (meetsResult.data || []).filter((m: any) => companyUserIds.includes(m.user_id))
    const dailyChallenges = (challengesResult.data || []).filter((c: any) => companyUserIds.includes(c.user_id))
    const followupAnalyses = (followupsResult.data || []).filter((f: any) => companyUserIds.includes(f.user_id))
    const summaries = (summariesResult.data || []).filter((s: any) => companyUserIds.includes(s.user_id))
    const allPdis = (pdisResult.data || []).filter((p: any) => companyUserIds.includes(p.user_id))
    const playbook = playbookResult.data || null
    const whatsappEvals = whatsappEvalsResult.data || []
    const companyData = companyDataResult.data || null

    // Helper to parse evaluation
    const parseEval = (evaluation: any) => {
      if (!evaluation) return null
      if (typeof evaluation === 'object' && 'output' in evaluation) {
        try { return JSON.parse(evaluation.output) } catch { return null }
      }
      return evaluation
    }

    // Build COMPREHENSIVE context per seller
    const sellerContexts: string[] = []

    for (const emp of employees) {
      if (emp.role === 'admin') continue

      const userId = emp.user_id
      const summary = summaries.find((s: any) => s.user_id === userId)

      // ALL roleplay sessions for this seller
      const userRoleplays = roleplaySessions.filter((s: any) => s.user_id === userId)
      let rpTotalScore = 0
      let rpScoredCount = 0
      const spinTotals = { S: 0, P: 0, I: 0, N: 0 }
      const spinCounts = { S: 0, P: 0, I: 0, N: 0 }
      const allStrengths: string[] = []
      const allGaps: string[] = []
      const rpDetails: string[] = []

      userRoleplays.forEach((session: any, i: number) => {
        const evaluation = parseEval(session.evaluation)
        if (!evaluation) return

        let score = evaluation.overall_score || 0
        if (score > 10) score = score / 10
        rpTotalScore += score
        rpScoredCount++

        if (evaluation.spin_evaluation) {
          const spin = evaluation.spin_evaluation
          if (spin.S?.final_score !== undefined) { spinTotals.S += spin.S.final_score; spinCounts.S++ }
          if (spin.P?.final_score !== undefined) { spinTotals.P += spin.P.final_score; spinCounts.P++ }
          if (spin.I?.final_score !== undefined) { spinTotals.I += spin.I.final_score; spinCounts.I++ }
          if (spin.N?.final_score !== undefined) { spinTotals.N += spin.N.final_score; spinCounts.N++ }
        }

        if (evaluation.top_strengths) allStrengths.push(...evaluation.top_strengths)
        if (evaluation.critical_gaps) allGaps.push(...evaluation.critical_gaps)

        const date = new Date(session.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
        rpDetails.push(`  Sessao ${i + 1} (${date}): ${score.toFixed(1)}/10 | ${evaluation.performance_level || 'N/A'}${evaluation.executive_summary ? ' | ' + evaluation.executive_summary.substring(0, 100) : ''}`)
      })

      const rpAvg = rpScoredCount > 0 ? rpTotalScore / rpScoredCount : 0

      // ALL meet evaluations
      const userMeets = meetEvaluations.filter((m: any) => m.user_id === userId)
      let meetTotal = 0
      const meetDetails: string[] = []
      userMeets.forEach((m: any, i: number) => {
        const evaluation = parseEval(m.evaluation)
        let score = evaluation?.overall_score || m.overall_score || 0
        if (score > 10) score = score / 10
        meetTotal += score
        const date = new Date(m.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
        const playbookAdh = evaluation?.playbook_adherence
        const spinStr = m.spin_s_score !== null ? ` | SPIN: S=${m.spin_s_score?.toFixed(1)} P=${m.spin_p_score?.toFixed(1)} I=${m.spin_i_score?.toFixed(1)} N=${m.spin_n_score?.toFixed(1)}` : ''
        meetDetails.push(`  Reuniao ${i + 1} (${date}): ${typeof score === 'number' ? score.toFixed(1) : score}/10 | ${m.performance_level || 'N/A'}${spinStr}${playbookAdh ? ' | Playbook: ' + (playbookAdh.overall_adherence_score || playbookAdh.overall_score || 'N/A') + '%' : ''}${evaluation?.executive_summary ? ' | ' + evaluation.executive_summary.substring(0, 80) : ''}`)
      })
      const meetAvg = userMeets.length > 0 ? meetTotal / userMeets.length : 0

      // ALL challenges
      const userChallenges = dailyChallenges.filter((c: any) => c.user_id === userId)
      const completedChallenges = userChallenges.filter((c: any) => c.completed || c.score > 0)
      const avgChallengeScore = completedChallenges.length > 0
        ? completedChallenges.reduce((sum: number, c: any) => sum + (c.score || 0), 0) / completedChallenges.length
        : 0

      // ALL follow-ups
      const userFollowups = followupAnalyses.filter((f: any) => f.user_id === userId)
      const fuAvg = userFollowups.length > 0
        ? userFollowups.reduce((sum: number, f: any) => sum + (f.nota_final || 0), 0) / userFollowups.length
        : 0
      const fuDetails: string[] = []
      userFollowups.forEach((f: any, i: number) => {
        const date = new Date(f.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
        fuDetails.push(`  Follow-up ${i + 1} (${date}): ${f.nota_final?.toFixed(1) || 'N/A'}/10 | ${f.classificacao || 'N/A'} | ${f.tipo_venda || ''} ${f.fase_funil || ''}`)
      })

      // ALL WhatsApp evaluations
      const userWAEvals = whatsappEvals.filter((e: any) => e.user_id === userId)
      const waAvg = userWAEvals.length > 0
        ? userWAEvals.reduce((sum: number, e: any) => sum + (e.nota_final || 0), 0) / userWAEvals.length
        : 0
      const waDetails: string[] = []
      userWAEvals.forEach((e: any, i: number) => {
        const date = new Date(e.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
        const notas = e.avaliacao?.notas || {}
        const criteriaStr = Object.entries(notas).map(([k, v]: [string, any]) => `${k}:${v.nota}`).join(' ')
        waDetails.push(`  WA ${i + 1} (${date}): ${e.nota_final?.toFixed(1) || 'N/A'}/10 | ${e.contact_name || e.contact_phone || 'N/A'}${criteriaStr ? ' | ' + criteriaStr : ''}`)
      })

      // PDIs
      const userPdis = allPdis.filter((p: any) => p.user_id === userId)
      const activePDI = userPdis.find((p: any) => p.status === 'ativo')

      // Trend
      const overallAvg = summary?.overall_average || rpAvg
      const totalSessions = summary?.total_sessions || userRoleplays.length
      let trend = 'estavel'
      if (userRoleplays.length >= 3) {
        const getScore = (s: any) => {
          const ev = parseEval(s.evaluation)
          let sc = ev?.overall_score || 0
          if (sc > 10) sc = sc / 10
          return sc
        }
        const recent = userRoleplays.slice(0, 2)
        const older = userRoleplays.slice(-2)
        const recentAvg = recent.reduce((sum: number, s: any) => sum + getScore(s), 0) / recent.length
        const olderAvg = older.reduce((sum: number, s: any) => sum + getScore(s), 0) / older.length
        if (recentAvg > olderAvg + 0.5) trend = 'melhorando'
        else if (recentAvg < olderAvg - 0.5) trend = 'piorando'
      }

      // Deduplicate and count strengths/gaps
      const strengthCounts = new Map<string, number>()
      allStrengths.forEach(s => strengthCounts.set(s, (strengthCounts.get(s) || 0) + 1))
      const topStrengths = Array.from(strengthCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5)

      const gapCounts = new Map<string, number>()
      allGaps.forEach(g => gapCounts.set(g, (gapCounts.get(g) || 0) + 1))
      const topGaps = Array.from(gapCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5)

      const spinAvg = {
        S: spinCounts.S > 0 ? (spinTotals.S / spinCounts.S).toFixed(1) : 'N/A',
        P: spinCounts.P > 0 ? (spinTotals.P / spinCounts.P).toFixed(1) : 'N/A',
        I: spinCounts.I > 0 ? (spinTotals.I / spinCounts.I).toFixed(1) : 'N/A',
        N: spinCounts.N > 0 ? (spinTotals.N / spinCounts.N).toFixed(1) : 'N/A',
      }

      // Build seller context
      let ctx = `\n========================================`
      ctx += `\n${emp.name} (${emp.email})`
      ctx += `\n========================================`
      ctx += `\nMedia Geral: ${overallAvg.toFixed(1)}/10 | Tendencia: ${trend}`
      ctx += `\nSPIN: S=${spinAvg.S} P=${spinAvg.P} I=${spinAvg.I} N=${spinAvg.N}`
      ctx += `\nTotal: ${totalSessions} roleplays, ${userMeets.length} reunioes, ${userFollowups.length} follow-ups, ${completedChallenges.length}/${userChallenges.length} desafios, ${userWAEvals.length} avaliacoes WA`

      if (rpAvg > 0) ctx += `\nMedia Roleplay: ${rpAvg.toFixed(1)}/10`
      if (meetAvg > 0) ctx += `\nMedia Reunioes: ${meetAvg.toFixed(1)}/10`
      if (fuAvg > 0) ctx += `\nMedia Follow-ups: ${fuAvg.toFixed(1)}/10`
      if (avgChallengeScore > 0) ctx += `\nMedia Desafios: ${avgChallengeScore.toFixed(1)}/10`
      if (waAvg > 0) ctx += `\nMedia WhatsApp: ${waAvg.toFixed(1)}/10`

      if (topStrengths.length > 0) ctx += `\nPontos Fortes: ${topStrengths.map(([t, c]) => `${t} (${c}x)`).join('; ')}`
      if (topGaps.length > 0) ctx += `\nGaps Criticos: ${topGaps.map(([t, c]) => `${t} (${c}x)`).join('; ')}`

      if (activePDI) {
        ctx += `\nPDI Ativo: ${activePDI.meta_objetivo || 'Sim'}`
        if (activePDI.resumo) ctx += ` | ${activePDI.resumo.substring(0, 100)}`
      }

      // Detailed session history
      if (rpDetails.length > 0) {
        ctx += `\n\nHistorico Roleplay (${rpDetails.length} sessoes):`
        ctx += `\n${rpDetails.join('\n')}`
      }

      if (meetDetails.length > 0) {
        ctx += `\n\nHistorico Reunioes (${meetDetails.length}):`
        ctx += `\n${meetDetails.join('\n')}`
      }

      if (fuDetails.length > 0) {
        ctx += `\n\nHistorico Follow-ups (${fuDetails.length}):`
        ctx += `\n${fuDetails.join('\n')}`
      }

      if (waDetails.length > 0) {
        ctx += `\n\nHistorico WhatsApp (${waDetails.length} avaliacoes):`
        ctx += `\n${waDetails.join('\n')}`
      }

      sellerContexts.push(ctx)
    }

    // Team averages
    const sellersWithData = employees.filter(e => e.role !== 'admin')
    const teamAvg = summaries.length > 0
      ? summaries.reduce((sum: number, s: any) => sum + (s.overall_average || 0), 0) / summaries.length
      : 0

    // Rankings
    const ranked = sellersWithData
      .map(e => {
        const s = summaries.find((s: any) => s.user_id === e.user_id)
        return { name: e.name, avg: s?.overall_average || 0 }
      })
      .filter(r => r.avg > 0)
      .sort((a, b) => b.avg - a.avg)

    // SPIN rankings
    const spinRanking = (dimension: string) => {
      return sellersWithData
        .map(e => {
          const s = summaries.find((s: any) => s.user_id === e.user_id)
          const key = `spin_${dimension.toLowerCase()}_average` as keyof typeof s
          return { name: e.name, score: s ? parseFloat(s[key] as string) || 0 : 0 }
        })
        .filter(r => r.score > 0)
        .sort((a, b) => b.score - a.score)
    }

    // Build full context
    const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

    let teamContext = `================================================================================
DADOS COMPLETOS DA EMPRESA: ${companyName} — ${today}
================================================================================`

    // Company data
    if (companyData) {
      teamContext += `

=== INFORMACOES DA EMPRESA ===
Nome: ${companyData.nome || companyName}
Descricao: ${companyData.descricao || 'N/A'}
Produtos/Servicos: ${companyData.produtos_servicos || 'N/A'}
Funcao dos Produtos: ${companyData.funcao_produtos || 'N/A'}
Diferenciais: ${companyData.diferenciais || 'N/A'}
Concorrentes: ${companyData.concorrentes || 'N/A'}
Dados e Metricas: ${companyData.dados_metricas || 'N/A'}
Erros Comuns: ${companyData.erros_comuns || 'N/A'}
Percepcao Desejada: ${companyData.percepcao_desejada || 'N/A'}`
    }

    // Playbook
    if (playbook) {
      teamContext += `

=== PLAYBOOK DE VENDAS ===
Titulo: ${playbook.title}
${playbook.content}`
    }

    // Team overview
    teamContext += `

=== EQUIPE (${sellersWithData.length} vendedores) ===
Media Geral da Equipe: ${teamAvg.toFixed(1)}/10
Total Roleplays: ${roleplaySessions.length}
Total Reunioes: ${meetEvaluations.length}
Total Follow-ups: ${followupAnalyses.length}
Total Desafios: ${dailyChallenges.length}
Total Avaliacoes WhatsApp: ${whatsappEvals.length}

=== RANKING GERAL ===
${ranked.length > 0 ? ranked.map((r, i) => `${i + 1}. ${r.name}: ${r.avg.toFixed(1)}/10`).join('\n') : 'Sem dados'}

=== RANKING SPIN ===
Situacao (S): ${spinRanking('s').map((r, i) => `${i + 1}.${r.name}:${r.score.toFixed(1)}`).join(' | ') || 'N/A'}
Problema (P): ${spinRanking('p').map((r, i) => `${i + 1}.${r.name}:${r.score.toFixed(1)}`).join(' | ') || 'N/A'}
Implicacao (I): ${spinRanking('i').map((r, i) => `${i + 1}.${r.name}:${r.score.toFixed(1)}`).join(' | ') || 'N/A'}
Necessidade (N): ${spinRanking('n').map((r, i) => `${i + 1}.${r.name}:${r.score.toFixed(1)}`).join(' | ') || 'N/A'}`

    // All sellers detailed data
    teamContext += `

================================================================================
DADOS DETALHADOS POR VENDEDOR
================================================================================${sellerContexts.join('\n')}`

    // System prompt
    const systemPrompt = `Voce e o Assistente de Gestao da ${companyName}. Voce tem acesso a TODOS os dados da empresa e de TODOS os funcionarios. O gestor pode perguntar qualquer coisa sobre qualquer vendedor, a empresa, o playbook, comparacoes, coaching, etc.

REGRAS:
- Responda SEMPRE em portugues brasileiro
- Seja direto, conciso e pratico — o gestor tem pouco tempo
- NAO use markdown (nada de **, *, ###, ---, \`\`\`)
- Quando comparar vendedores, use dados concretos (notas, tendencias, datas)
- Quando sugerir coaching, seja especifico e acionavel
- Se perguntarem sobre um vendedor especifico, foque nele com TODA a profundidade dos dados
- Se perguntarem sobre a equipe, de visao macro com destaques
- NUNCA invente dados — se nao tem informacao, diga claramente
- NUNCA questione a validade dos dados
- Use os scores SPIN para insights especificos sobre metodologia de vendas
- Identifique padroes: quem esta melhorando, quem esta piorando, quem esta estagnado
- Sugira acoes de coaching baseadas nos gaps especificos de cada vendedor
- Voce conhece os dados da empresa (produtos, diferenciais, concorrentes) — use isso nas analises
- Se houver playbook, avalie a aderencia dos vendedores a ele
- Quando perguntarem "quem precisa de atencao", priorize por:
  1. Tendencia declinante (piorando)
  2. Nota geral baixa (<5)
  3. Gaps criticos recorrentes
  4. Baixa taxa de completude de desafios

COMPONENTES VISUAIS — USE QUANDO TIVER DADOS REAIS:
Voce tem acesso a tags especiais que o frontend renderiza como graficos. Use quando tiver dados numericos REAIS dos vendedores. Misture texto normal com as tags. As tags devem estar em uma LINHA SEPARADA (nao inline com texto).

REGRAS CRITICAS PARA TAGS:
- NUNCA use uma tag com valores 0.0 ou zerados — se nao tem dado, NAO use a tag
- NUNCA invente valores para preencher tags — so use dados que estao no contexto
- Use {{SPIN:...}} APENAS quando os 4 scores SPIN existirem nos dados do vendedor
- Se um vendedor so tem dados de roleplay mas nao de reunioes, NAO crie SPIN com zeros para reunioes
- Prefira {{BARRA:...}} para metricas individuais e {{NOTA:...}} para scores pontuais

Tags disponiveis:

1. NOTA — badge colorido com score:
{{NOTA:7.5}}
Use para qualquer nota individual que exista nos dados.

2. BARRA — barra de progresso horizontal:
{{BARRA:Label|valor|maximo}}
Exemplo: {{BARRA:Media Geral|7.5|10}}
Use para mostrar uma metrica com contexto visual.

3. SPIN — 4 barras SPIN lado a lado:
{{SPIN:S=5.8|P=6.2|I=3.5|N=6.0}}
Use SOMENTE quando os 4 valores SPIN existirem nos dados. NUNCA com zeros.

4. RANKING — ranking visual com barras:
{{RANKING:Nome1|7.5,Nome2|6.3,Nome3|5.1}}
Use para rankings e comparacoes entre vendedores.

5. TENDENCIA — indicador de tendencia:
{{TENDENCIA:melhorando}} ou {{TENDENCIA:piorando}} ou {{TENDENCIA:estavel}}
Use quando falar sobre evolucao de um vendedor.

6. COMPARAR — barras de comparacao lado a lado:
{{COMPARAR:Nome1|7.5,Nome2|6.3}}
Use para comparar 2+ vendedores em uma metrica especifica.

EXEMPLO DE RESPOSTA:
"Joao Gattoni esta com media geral de
{{NOTA:7.8}}
com tendencia de
{{TENDENCIA:melhorando}}

Seus scores SPIN nos roleplays:
{{SPIN:S=8.1|P=7.5|I=6.2|N=7.0}}

Comparado com a equipe:
{{RANKING:Joao|7.8,Maria|6.3,Pedro|5.1}}

O principal gap e em Implicacao. Recomendo focar em explorar consequencias dos problemas."

IMPORTANTE: Use tags visuais quando tiver dados reais. O gestor prefere dados visuais a texto puro. Mas NUNCA force uma tag com dados zerados ou inventados — isso confunde mais do que ajuda.

VOCE TEM ACESSO A:
- Informacoes da empresa (produtos, diferenciais, concorrentes, etc.)
- Playbook de vendas completo
- TODAS as sessoes de roleplay de cada vendedor (com notas SPIN, pontos fortes, gaps)
- TODAS as avaliacoes de reunioes reais (Google Meet)
- TODOS os desafios diarios (completados e pendentes)
- TODOS os follow-ups analisados
- TODAS as avaliacoes de conversas WhatsApp
- PDIs ativos e historicos
- Rankings e medias gerais`

    // Build messages array
    const gptMessages: any[] = [
      { role: 'system', content: systemPrompt + '\n\n' + teamContext }
    ]

    // Add conversation history (last 10 messages)
    if (conversationHistory && Array.isArray(conversationHistory)) {
      const recentHistory = conversationHistory.slice(-10)
      for (const msg of recentHistory) {
        gptMessages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content
        })
      }
    }

    gptMessages.push({ role: 'user', content: userMessage })

    // SSE streaming response
    const stream = await openai.chat.completions.create({
      model: 'gpt-4.1',
      messages: gptMessages,
      temperature: 0.7,
      max_tokens: 4000,
      stream: true
    })

    // Consume 0.2 credits (fire-and-forget)
    if (companyCredits) {
      supabaseAdmin
        .from('companies')
        .update({ monthly_credits_used: (companyCredits.monthly_credits_used || 0) + 0.2 })
        .eq('id', companyId)
        .then(() => {})
    }

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content
          if (content) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: content })}\n\n`))
          }
        }
        controller.enqueue(encoder.encode(`data: [DONE]\n\n`))
        controller.close()
      }
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      }
    })

  } catch (error: any) {
    console.error('[ManagerAIChat] Error:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error.message },
      { status: 500 }
    )
  }
}
