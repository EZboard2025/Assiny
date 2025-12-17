import { NextRequest, NextResponse } from 'next/server'
import { stopBot } from '../create/route'

export async function POST(req: NextRequest) {
  try {
    const { sessionId } = await req.json()

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      )
    }

    // Stop the bot (this will also save the final state to file)
    await stopBot(sessionId)

    return NextResponse.json({
      success: true,
      message: 'Analysis stopped successfully. Check transcripts folder for the saved file.'
    })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}