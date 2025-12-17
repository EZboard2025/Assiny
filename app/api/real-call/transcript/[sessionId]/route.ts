import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      )
    }

    // Read transcript from file
    const TRANSCRIPTS_DIR = path.join(process.cwd(), 'transcripts')
    const filePath = path.join(TRANSCRIPTS_DIR, `${sessionId}.json`)

    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    const sessionData = JSON.parse(fs.readFileSync(filePath, 'utf-8'))

    return NextResponse.json({
      success: true,
      sessionId: sessionData.sessionId,
      status: sessionData.status,
      transcript: sessionData.transcript || [],
      transcriptCount: sessionData.transcript?.length || 0
    })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}