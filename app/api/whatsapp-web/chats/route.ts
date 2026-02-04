import { NextResponse } from 'next/server'
import { getChats } from '@/lib/whatsapp-web'

export async function GET() {
  try {
    const chats = await getChats()
    return NextResponse.json({ chats })
  } catch (error: any) {
    console.error('Erro na API chats:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar conversas' },
      { status: 500 }
    )
  }
}
