import { NextResponse } from 'next/server'
import { getConnectionStatus } from '@/lib/whatsapp-web'

export async function GET() {
  try {
    const status = getConnectionStatus()
    return NextResponse.json(status)
  } catch (error: any) {
    console.error('Erro na API status:', error)
    return NextResponse.json(
      { error: error.message || 'Erro interno' },
      { status: 500 }
    )
  }
}
