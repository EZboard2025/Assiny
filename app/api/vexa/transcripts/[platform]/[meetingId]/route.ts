import { NextRequest, NextResponse } from 'next/server'

// Vexa Self-Hosted API (running on same server via Docker)
const VEXA_API_URL = 'http://localhost:8056'

// GET /api/vexa/transcripts/[platform]/[meetingId] - Get transcripts
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string; meetingId: string }> }
) {
  try {
    const { platform, meetingId } = await params

    const response = await fetch(
      `${VEXA_API_URL}/transcripts/${platform}/${meetingId}`
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
