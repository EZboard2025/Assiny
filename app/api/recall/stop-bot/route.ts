import { NextResponse } from 'next/server'

const RECALL_API_URL = process.env.RECALL_API_REGION
  ? `https://${process.env.RECALL_API_REGION}.recall.ai/api/v1`
  : 'https://us-west-2.recall.ai/api/v1'

export async function POST(request: Request) {
  try {
    const { botId } = await request.json()

    if (!botId) {
      return NextResponse.json(
        { error: 'botId is required' },
        { status: 400 }
      )
    }

    if (!process.env.RECALL_API_KEY) {
      return NextResponse.json(
        { error: 'RECALL_API_KEY not configured' },
        { status: 500 }
      )
    }

    console.log('🛑 Stopping Recall.ai bot:', botId)

    // Use the leave_call endpoint to gracefully stop the bot
    const response = await fetch(`${RECALL_API_URL}/bot/${botId}/leave_call/`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${process.env.RECALL_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    })

    // 200 = success, 400 = bot already left/ended (still ok)
    if (!response.ok && response.status !== 400) {
      const errorData = await response.json().catch(() => ({}))
      console.error('❌ Recall.ai stop error:', response.status, errorData)
      return NextResponse.json(
        { error: errorData.detail || 'Failed to stop bot' },
        { status: response.status }
      )
    }

    console.log('✅ Bot stopped successfully')

    return NextResponse.json({
      success: true,
      botId: botId,
      message: 'Bot stopped successfully'
    })

  } catch (error: any) {
    console.error('❌ Error stopping bot:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
