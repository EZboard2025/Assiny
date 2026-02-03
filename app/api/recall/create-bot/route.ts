import { NextResponse } from 'next/server'

const RECALL_API_URL = process.env.RECALL_API_REGION
  ? `https://${process.env.RECALL_API_REGION}.recall.ai/api/v1`
  : 'https://us-west-2.recall.ai/api/v1' // Pay-as-you-go region

export async function POST(request: Request) {
  try {
    const { meetingUrl, botName } = await request.json()

    if (!meetingUrl) {
      return NextResponse.json(
        { error: 'meetingUrl is required' },
        { status: 400 }
      )
    }

    if (!process.env.RECALL_API_KEY) {
      return NextResponse.json(
        { error: 'RECALL_API_KEY not configured' },
        { status: 500 }
      )
    }

    // Determine webhook URL for real-time transcription
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ramppy.site'
    const webhookUrl = `${appUrl}/api/recall/webhook`

    console.log('🤖 Creating Recall.ai bot for meeting:', meetingUrl)
    console.log('📡 Webhook URL:', webhookUrl)

    const response = await fetch(`${RECALL_API_URL}/bot/`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${process.env.RECALL_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        meeting_url: meetingUrl,
        bot_name: botName || 'Ramppy',
        recording_config: {
          transcript: {
            provider: {
              // Use Recall.ai native transcription
              recallai_streaming: {
                language_code: 'pt', // Portuguese
                mode: 'prioritize_accuracy' // Better quality over speed
              }
            }
          },
          // Configure real-time webhook endpoints
          realtime_endpoints: [
            {
              type: 'webhook',
              url: webhookUrl,
              events: ['transcript.data', 'transcript.partial_data']
            }
          ]
        },
        // Chat configuration - helps with speaker identification
        chat: {
          on_bot_join: {
            send_to: 'everyone',
            message: '🎙️ Ramppy está gravando e transcrevendo esta reunião.'
          }
        },
        // Auto-leave settings
        automatic_leave: {
          waiting_room_timeout: 300, // 5 minutes in waiting room
          noone_joined_timeout: 120, // 2 minutes if no one joins
          everyone_left_timeout: 30  // 30 seconds after everyone leaves
        }
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('❌ Recall.ai error:', response.status, errorData)
      return NextResponse.json(
        { error: errorData.detail || 'Failed to create bot' },
        { status: response.status }
      )
    }

    const data = await response.json()
    console.log('✅ Bot created:', data.id)

    return NextResponse.json({
      success: true,
      botId: data.id,
      meetingUrl: data.meeting_url,
      status: data.status_changes?.[0]?.code || 'created'
    })

  } catch (error: any) {
    console.error('❌ Error creating Recall bot:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
