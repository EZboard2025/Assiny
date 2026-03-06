import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { userId } = await request.json()
    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 })
    }

    // Get user info
    const { data: employee } = await supabaseAdmin
      .from('employees')
      .select('name, company_id')
      .eq('user_id', userId)
      .single()

    const companyId = employee?.company_id
    const userName = employee?.name || ''

    // Run all queries in parallel
    const [meetings, staleLeads, challenge, streak, performanceSummary] = await Promise.all([
      getTodayMeetings(userId),
      getStaleLeads(userId),
      getTodayChallenge(userId, companyId),
      getTrainingStreak(userId),
      getPerformanceTrend(userId),
    ])

    const hour = new Date().getHours()
    const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'

    // Build Nicole message (simple template, no AI needed)
    let nicoleMsg = ''
    const parts: string[] = []

    if (meetings.length > 0) {
      parts.push(`Voce tem ${meetings.length} reunia${meetings.length > 1 ? 'oes' : 'o'} hoje`)
    }
    if (staleLeads.length > 0) {
      const firstName = staleLeads[0].name?.split(' ')[0] || 'Um lead'
      parts.push(`${firstName}${staleLeads.length > 1 ? ` e mais ${staleLeads.length - 1}` : ''} aguarda${staleLeads.length > 1 ? 'm' : ''} sua resposta`)
    }
    if (challenge) {
      parts.push('Seu desafio do dia esta disponivel')
    }
    if (streak.current > 0) {
      parts.push(`${streak.current} dias de streak de treino`)
    }

    if (parts.length > 0) {
      nicoleMsg = parts.join('. ') + '. Bora!'
    } else {
      nicoleMsg = 'Dia tranquilo ate agora. Que tal aproveitar pra treinar?'
    }

    return NextResponse.json({
      summary: {
        greeting: `${greeting}${userName ? ', ' + userName.split(' ')[0] : ''}!`,
        meetings,
        stale_leads: staleLeads,
        challenge,
        streak,
        trend: performanceSummary?.trend || null,
        nicole_message: nicoleMsg,
      }
    })
  } catch (error: any) {
    console.error('[Morning Summary] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// ─── Today's Calendar Meetings ──────────────────────────────────────────────

async function getTodayMeetings(userId: string) {
  try {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date()
    todayEnd.setHours(23, 59, 59, 999)

    const { data: bots } = await supabaseAdmin
      .from('calendar_scheduled_bots')
      .select('event_title, event_start, event_end, meet_link, attendees')
      .eq('user_id', userId)
      .gte('event_start', todayStart.toISOString())
      .lte('event_start', todayEnd.toISOString())
      .order('event_start', { ascending: true })
      .limit(10)

    if (!bots || bots.length === 0) return []

    return bots.map(b => ({
      title: b.event_title || 'Reuniao',
      start: b.event_start,
      time: new Date(b.event_start).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      meet_link: b.meet_link,
      attendees: b.attendees,
    }))
  } catch {
    return []
  }
}

// ─── Stale Leads (no response >24h) ────────────────────────────────────────

async function getStaleLeads(userId: string) {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

    const { data: conversations } = await supabaseAdmin
      .from('whatsapp_conversations')
      .select('id, contact_phone, contact_name, last_message_at')
      .eq('user_id', userId)
      .gte('last_message_at', fourteenDaysAgo)
      .lte('last_message_at', twentyFourHoursAgo)
      .order('last_message_at', { ascending: false })
      .limit(15)

    if (!conversations || conversations.length === 0) return []

    const stale: { name: string; phone: string; hours_since: number }[] = []

    for (const conv of conversations) {
      const { data: lastMsg } = await supabaseAdmin
        .from('whatsapp_messages')
        .select('direction, message_timestamp')
        .eq('user_id', userId)
        .eq('contact_phone', conv.contact_phone)
        .order('message_timestamp', { ascending: false })
        .limit(1)
        .single()

      if (lastMsg && lastMsg.direction === 'outbound') {
        const hoursSince = Math.round(
          (Date.now() - new Date(lastMsg.message_timestamp).getTime()) / (1000 * 60 * 60)
        )
        stale.push({
          name: conv.contact_name || conv.contact_phone,
          phone: conv.contact_phone,
          hours_since: hoursSince,
        })
      }

      if (stale.length >= 5) break
    }

    return stale
  } catch {
    return []
  }
}

// ─── Today's Daily Challenge ────────────────────────────────────────────────

async function getTodayChallenge(userId: string, companyId: string | undefined) {
  try {
    const today = new Date().toISOString().split('T')[0]

    const { data: challenge } = await supabaseAdmin
      .from('daily_challenges')
      .select('id, status, difficulty_level, challenge_config, ai_reasoning')
      .eq('user_id', userId)
      .eq('challenge_date', today)
      .single()

    if (!challenge) return null

    return {
      title: challenge.challenge_config?.title || challenge.challenge_config?.focus_area || 'Desafio disponivel',
      status: challenge.status,
      difficulty: challenge.difficulty_level,
    }
  } catch {
    return null
  }
}

// ─── Training Streak ────────────────────────────────────────────────────────

async function getTrainingStreak(userId: string) {
  try {
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()

    const { data: sessions } = await supabaseAdmin
      .from('roleplay_sessions')
      .select('created_at')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .gte('created_at', sixtyDaysAgo)
      .order('created_at', { ascending: false })

    if (!sessions || sessions.length === 0) return { current: 0 }

    // Get unique dates
    const dates = new Set<string>()
    sessions.forEach(s => {
      dates.add(new Date(s.created_at).toISOString().split('T')[0])
    })

    // Count consecutive days backwards from today
    let streak = 0
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Check today first, then yesterday, etc.
    let checkDate = new Date(today)
    const todayStr = checkDate.toISOString().split('T')[0]

    if (!dates.has(todayStr)) {
      // Check if yesterday has it (grace period)
      checkDate.setDate(checkDate.getDate() - 1)
      const yesterdayStr = checkDate.toISOString().split('T')[0]
      if (!dates.has(yesterdayStr)) {
        return { current: 0 }
      }
    }

    // Count backwards
    checkDate = dates.has(todayStr) ? new Date(today) : (() => { const d = new Date(today); d.setDate(d.getDate() - 1); return d })()

    while (dates.has(checkDate.toISOString().split('T')[0])) {
      streak++
      checkDate.setDate(checkDate.getDate() - 1)
    }

    return { current: streak }
  } catch {
    return { current: 0 }
  }
}

// ─── Performance Trend ──────────────────────────────────────────────────────

async function getPerformanceTrend(userId: string) {
  try {
    const { data } = await supabaseAdmin
      .from('user_performance_summaries')
      .select('trend, overall_average, score_improvement')
      .eq('user_id', userId)
      .single()

    return data || null
  } catch {
    return null
  }
}
