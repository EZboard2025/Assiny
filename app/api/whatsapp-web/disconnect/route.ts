import { NextResponse } from 'next/server'
import { disconnectWhatsApp } from '@/lib/whatsapp-web'

export async function POST() {
  try {
    await disconnectWhatsApp()
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Erro na API disconnect:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao desconectar' },
      { status: 500 }
    )
  }
}
