import { NextRequest, NextResponse } from 'next/server'

// Vexa Self-Hosted API
// In production (on server): use localhost since Vexa Docker runs on same machine
// In development: use the production server IP directly
const IS_PRODUCTION = process.env.NODE_ENV === 'production'
const VEXA_API_URL = IS_PRODUCTION ? 'http://localhost:8056' : 'http://31.97.84.130:8056'
const VEXA_API_KEY = 'q7ZeKSTwiAhjPH1pMFNmNNgx5bPdyDYBv5Nl8jZ5'

// GET /api/vexa/transcripts/[platform]/[meetingId] - Get transcripts
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string; meetingId: string }> }
) {
  try {
    const { platform, meetingId } = await params

    const response = await fetch(
      `${VEXA_API_URL}/transcripts/${platform}/${meetingId}`,
      {
        headers: {
          'X-API-Key': VEXA_API_KEY
        }
      }
    )

    const text = await response.text()

    let data
    try {
      data = JSON.parse(text)
    } catch {
      data = { segments: [] }
    }

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Vexa API error (transcripts):', error)
    return NextResponse.json(
      { error: 'Failed to get transcripts', segments: [] },
      { status: 500 }
    )
  }
}
