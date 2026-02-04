import { NextResponse } from 'next/server'
import { getChatMessages, formatChatForAnalysis } from '@/lib/whatsapp-web'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const chatId = searchParams.get('chatId')
    const format = searchParams.get('format') // 'raw' ou 'analysis'
    const sellerName = searchParams.get('sellerName') || 'Vendedor'

    if (!chatId) {
      return NextResponse.json(
        { error: 'chatId é obrigatório' },
        { status: 400 }
      )
    }

    if (format === 'analysis') {
      const formatted = await formatChatForAnalysis(chatId, sellerName)
      return NextResponse.json({ formatted })
    }

    const messages = await getChatMessages(chatId, 100)
    return NextResponse.json({ messages })

  } catch (error: any) {
    console.error('Erro na API messages:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar mensagens' },
      { status: 500 }
    )
  }
}
