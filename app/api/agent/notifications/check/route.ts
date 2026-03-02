import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface NotificationResult {
  type: 'meeting_soon' | 'training_gap' | 'stale_leads'
  data: any
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { userId, force_test } = await request.json()
    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 })
    }

    // Force test mode — return a fake notification immediately
    if (force_test) {
      const testNotifications: NotificationResult[] = [{
        type: 'training_gap',
        data: { days_since_last: 3, has_any_session: true }
      }]
      return NextResponse.json({ notifications: testNotifications })
    }

    // Get user's company
    const { data: employee } = await supabaseAdmin
      .from('employees')
      .select('company_id')
      .eq('user_id', userId)
      .single()

    const companyId = employee?.company_id

    // Run all checks in parallel
    const [meetingSoon, trainingGap, staleLeads] = await Promise.all([
      checkMeetingSoon(userId),
      checkTrainingGap(userId),
      checkStaleLeads(userId),
    ])

    const notifications: NotificationResult[] = []

    if (meetingSoon) notifications.push(meetingSoon)
    if (trainingGap) notifications.push(trainingGap)
    if (staleLeads) notifications.push(staleLeads)

    // Insert notifications into user_notifications for Realtime delivery
    if (notifications.length > 0 && companyId) {
      const notifRows = notifications.map(n => ({
        user_id: userId,
        type: `nicole_${n.type}`,
        title: getNotificationTitle(n),
        message: getNotificationMessage(n),
        data: n.data,
        is_read: false,
      }))

      // Check for recent duplicates (don't re-insert same type within cooldown)
      for (const row of notifRows) {
        const cooldownMinutes = getCooldownMinutes(row.type)
        const { data: existing } = await supabaseAdmin
          .from('user_notifications')
          .select('id')
          .eq('user_id', userId)
          .eq('type', row.type)
          .gte('created_at', new Date(Date.now() - cooldownMinutes * 60 * 1000).toISOString())
          .limit(1)

        if (!existing || existing.length === 0) {
          await supabaseAdmin.from('user_notifications').insert(row)
        }
      }
    }

    return NextResponse.json({ notifications })
  } catch (error: any) {
    console.error('[Notification Check] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// ─── Check: Meeting starting in 25-35 minutes ────────────────────────────────
async function checkMeetingSoon(userId: string): Promise<NotificationResult | null> {
  try {
    const now = new Date()
    const from = new Date(now.getTime() + 25 * 60 * 1000)
    const to = new Date(now.getTime() + 35 * 60 * 1000)

    // Check calendar_scheduled_bots for upcoming meetings
    const { data: bots } = await supabaseAdmin
      .from('calendar_scheduled_bots')
      .select('id, event_title, event_start, meet_link, attendees')
      .eq('user_id', userId)
      .gte('event_start', from.toISOString())
      .lte('event_start', to.toISOString())
      .limit(1)

    if (bots && bots.length > 0) {
      const meeting = bots[0]
      const minutesUntil = Math.round((new Date(meeting.event_start).getTime() - now.getTime()) / 60000)
      return {
        type: 'meeting_soon',
        data: {
          title: meeting.event_title,
          start: meeting.event_start,
          meet_link: meeting.meet_link,
          attendees: meeting.attendees,
          minutes_until: minutesUntil,
        }
      }
    }

    return null
  } catch (err) {
    console.error('[Notification Check] Meeting check failed:', err)
    return null
  }
}

// ─── Check: No roleplay training in 3+ days ──────────────────────────────────
async function checkTrainingGap(userId: string): Promise<NotificationResult | null> {
  try {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()

    const { data: recentSessions } = await supabaseAdmin
      .from('roleplay_sessions')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .gte('created_at', threeDaysAgo)
      .limit(1)

    if (!recentSessions || recentSessions.length === 0) {
      // Get the last session date to calculate exact gap
      const { data: lastSession } = await supabaseAdmin
        .from('roleplay_sessions')
        .select('created_at')
        .eq('user_id', userId)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      const daysSince = lastSession
        ? Math.floor((Date.now() - new Date(lastSession.created_at).getTime()) / (1000 * 60 * 60 * 24))
        : null

      return {
        type: 'training_gap',
        data: {
          days_since_last: daysSince,
          has_any_session: !!lastSession,
        }
      }
    }

    return null
  } catch (err) {
    console.error('[Notification Check] Training gap check failed:', err)
    return null
  }
}

// ─── Check: WhatsApp leads not responding for 48h+ ───────────────────────────
async function checkStaleLeads(userId: string): Promise<NotificationResult | null> {
  try {
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

    // Find conversations where:
    // 1. Had activity in last 14 days (active lead)
    // 2. The most recent message is outbound
    // 3. That outbound message was sent 48h+ ago
    const { data: conversations } = await supabaseAdmin
      .from('whatsapp_conversations')
      .select('id, contact_phone, contact_name, last_message_at')
      .eq('user_id', userId)
      .gte('last_message_at', fourteenDaysAgo)
      .lte('last_message_at', fortyEightHoursAgo)
      .order('last_message_at', { ascending: false })
      .limit(20)

    if (!conversations || conversations.length === 0) return null

    // For each conversation, check if last message was outbound (seller sent, no reply)
    const staleContacts: { name: string; phone: string; hours_since: number }[] = []

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
        staleContacts.push({
          name: conv.contact_name || conv.contact_phone,
          phone: conv.contact_phone,
          hours_since: hoursSince,
        })
      }

      // Limit to 5 stale contacts
      if (staleContacts.length >= 5) break
    }

    if (staleContacts.length === 0) return null

    return {
      type: 'stale_leads',
      data: {
        count: staleContacts.length,
        contacts: staleContacts,
      }
    }
  } catch (err) {
    console.error('[Notification Check] Stale leads check failed:', err)
    return null
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getNotificationTitle(n: NotificationResult): string {
  switch (n.type) {
    case 'meeting_soon':
      return `Reuniao em ${n.data.minutes_until} minutos`
    case 'training_gap':
      return n.data.days_since_last
        ? `${n.data.days_since_last} dias sem treinar`
        : 'Hora de treinar!'
    case 'stale_leads':
      return `${n.data.count} lead${n.data.count > 1 ? 's' : ''} sem resposta`
    default:
      return 'Nicole'
  }
}

function getNotificationMessage(n: NotificationResult): string {
  switch (n.type) {
    case 'meeting_soon':
      return `"${n.data.title}" comeca em ${n.data.minutes_until} minutos`
    case 'training_gap':
      return n.data.days_since_last
        ? `Ja faz ${n.data.days_since_last} dias desde seu ultimo treino. Que tal uma sessao rapida?`
        : 'Voce ainda nao fez nenhum roleplay. Comece agora!'
    case 'stale_leads':
      const names = n.data.contacts.slice(0, 2).map((c: any) => c.name).join(', ')
      return `${names}${n.data.count > 2 ? ` e mais ${n.data.count - 2}` : ''} aguardando resposta ha 48h+`
    default:
      return ''
  }
}

function getCooldownMinutes(type: string): number {
  switch (type) {
    case 'nicole_meeting_soon': return 10
    case 'nicole_training_gap': return 24 * 60 // 24 hours
    case 'nicole_stale_leads': return 8 * 60   // 8 hours
    default: return 60
  }
}
