import { NextResponse } from 'next/server'

// Vexa Self-Hosted API (running on same server via Docker)
const VEXA_API_URL = 'http://localhost:8056'
const VEXA_API_KEY = 'VexaRamppy2025SecureToken'

// GET /api/vexa/bots/status - Get bot status
export async function GET() {
  try {
    const response = await fetch(`${VEXA_API_URL}/bots/status`, {
      headers: {
        'X-API-Key': VEXA_API_KEY
      }
    })

    const text = await response.text()

    let data
    try {
      data = JSON.parse(text)
    } catch {
      data = { running_bots: [] }
    }

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Vexa API error (status):', error)
    return NextResponse.json(
      { error: 'Failed to get bot status', running_bots: [] },
      { status: 500 }
    )
  }
}
