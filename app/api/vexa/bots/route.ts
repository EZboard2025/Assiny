import { NextRequest, NextResponse } from 'next/server'

// Vexa Cloud API
const VEXA_API_URL = 'https://api.cloud.vexa.ai'
const VEXA_API_KEY = 'q7ZeKSTwiAhjPH1pMFNmNNgx5bPdyDYBv5Nl8jZ5'

// POST /api/vexa/bots - Create a new bot
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    console.log('🤖 Vexa Cloud API - Creating bot...')
    console.log('URL:', `${VEXA_API_URL}/bots`)
    console.log('Body:', JSON.stringify(body))

    const response = await fetch(`${VEXA_API_URL}/bots`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': VEXA_API_KEY
      },
      body: JSON.stringify(body)
    })

    console.log('Vexa response status:', response.status)

    const text = await response.text()
    console.log('Vexa response body:', text)

    let data
    try {
      data = JSON.parse(text)
    } catch {
      data = { error: text || 'Empty response from Vexa' }
    }

    if (!response.ok) {
      console.error('Vexa API error:', response.status, data)
      return NextResponse.json(data, { status: response.status })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Vexa API error (create bot):', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create bot' },
      { status: 500 }
    )
  }
}
