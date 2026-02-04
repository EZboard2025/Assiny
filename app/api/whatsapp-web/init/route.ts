import { NextResponse } from 'next/server'
import { initWhatsAppClient, getConnectionStatus } from '@/lib/whatsapp-web'

export async function POST() {
  try {
    const result = await initWhatsAppClient()

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Falha ao inicializar WhatsApp' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      qrCode: result.qrCode,
      status: getConnectionStatus().status
    })

  } catch (error: any) {
    console.error('Erro na API init:', error)
    return NextResponse.json(
      { error: error.message || 'Erro interno' },
      { status: 500 }
    )
  }
}
