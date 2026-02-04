import { NextResponse } from 'next/server'
import { sendMessage } from '@/lib/whatsapp-web'

export async function POST(request: Request) {
  try {
    const { chatId, message } = await request.json()

    if (!chatId || !message) {
      return NextResponse.json(
        { error: 'chatId e message são obrigatórios' },
        { status: 400 }
      )
    }

    const sentMsg = await sendMessage(chatId, message)
    return NextResponse.json({ success: true, message: sentMsg })
  } catch (error: any) {
    console.error('Erro na API send:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao enviar mensagem' },
      { status: 500 }
    )
  }
}
