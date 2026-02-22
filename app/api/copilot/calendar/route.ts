import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createCalendarEvent } from '@/lib/google-calendar'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user } } = await supabaseAdmin.auth.getUser(token)
    if (!user) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 401 })
    }

    const body = await req.json()
    const { title, startDateTime, endDateTime, attendeeEmail, addMeetLink = true } = body

    if (!title || !startDateTime || !endDateTime) {
      return NextResponse.json(
        { error: 'title, startDateTime e endDateTime são obrigatórios' },
        { status: 400 }
      )
    }

    const attendees = attendeeEmail && attendeeEmail !== '_' ? [attendeeEmail] : []

    const event = await createCalendarEvent(user.id, {
      title,
      startDateTime,
      endDateTime,
      attendees,
      addMeetLink,
    })

    if (!event) {
      return NextResponse.json(
        { error: 'Falha ao criar evento. Verifique se o Google Calendar está conectado.' },
        { status: 500 }
      )
    }

    console.log(`[Copilot Calendar] Event created: "${title}" at ${startDateTime} for user ${user.id}`)

    return NextResponse.json({
      success: true,
      event: {
        id: event.id,
        title: event.title,
        start: event.start,
        end: event.end,
        meetLink: event.meetLink,
        attendees: event.attendees,
      },
    })
  } catch (error: any) {
    console.error('[Copilot Calendar] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao criar evento' },
      { status: 500 }
    )
  }
}
