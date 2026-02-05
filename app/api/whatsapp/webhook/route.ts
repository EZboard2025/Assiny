import { NextRequest, NextResponse } from 'next/server'

// With whatsapp-web.js, messages are received via client events (not webhooks).
// This endpoint is kept as a no-op placeholder.

export async function GET() {
  return NextResponse.json({ status: 'ok', mode: 'whatsapp-web.js' })
}

export async function POST(request: NextRequest) {
  return NextResponse.json({ status: 'ok' }, { status: 200 })
}
