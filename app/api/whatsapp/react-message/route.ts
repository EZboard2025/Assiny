import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getConnectedClient } from '@/lib/whatsapp-client'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { waMessageId, emoji } = await request.json()

    if (!waMessageId || !emoji) {
      return NextResponse.json({ error: 'waMessageId and emoji are required' }, { status: 400 })
    }

    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const client = getConnectedClient(user.id)
    if (!client) {
      return NextResponse.json({ error: 'WhatsApp not connected' }, { status: 404 })
    }

    const msg = await Promise.race([
      client.getMessageById(waMessageId),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Timeout ao buscar mensagem')), 10000))
    ])

    if (!msg) {
      return NextResponse.json({ error: 'Mensagem não encontrada no WhatsApp' }, { status: 404 })
    }

    await Promise.race([
      msg.react(emoji),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Timeout ao reagir')), 10000))
    ])

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error('Error reacting to message:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao reagir à mensagem' },
      { status: 500 }
    )
  }
}
