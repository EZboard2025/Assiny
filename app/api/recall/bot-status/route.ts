import { NextResponse } from 'next/server'

const RECALL_API_URL = process.env.RECALL_API_REGION
  ? `https://${process.env.RECALL_API_REGION}.recall.ai/api/v1`
  : 'https://us-west-2.recall.ai/api/v1'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const botId = searchParams.get('botId')

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

    const response = await fetch(`${RECALL_API_URL}/bot/${botId}/`, {
      headers: {
        'Authorization': `Token ${process.env.RECALL_API_KEY}`,
        'Accept': 'application/json'
      }
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('❌ Recall.ai status error:', response.status, errorData)
      return NextResponse.json(
        { error: errorData.detail || 'Failed to get bot status' },
        { status: response.status }
      )
    }

    const data = await response.json()

    // Map Recall.ai status to our internal status
    // Recall statuses: ready, joining_call, in_waiting_room, in_call_not_recording,
    // in_call_recording, call_ended, done, fatal, analysis_done, media_expired
    const statusChanges = data.status_changes || []
    const latestStatus = statusChanges[statusChanges.length - 1]?.code || 'unknown'

    const latestSubCode = statusChanges[statusChanges.length - 1]?.sub_code || null

    let mappedStatus = 'unknown'
    switch (latestStatus) {
      case 'ready':
        mappedStatus = 'ready'
        break
      case 'joining_call':
        mappedStatus = 'joining'
        break
      case 'in_waiting_room':
        mappedStatus = 'waiting_room'
        break
      case 'in_call_not_recording':
        mappedStatus = 'in_meeting'
        break
      case 'in_call_recording':
        mappedStatus = 'transcribing'
        break
      case 'call_ended':
      case 'done':
      case 'analysis_done':
        mappedStatus = 'ended'
        break
      case 'fatal':
        mappedStatus = 'error'
        break
      default:
        mappedStatus = latestStatus
    }

    return NextResponse.json({
      botId: data.id,
      status: mappedStatus,
      recallStatus: latestStatus,
      subCode: latestSubCode,
      statusChanges: statusChanges,
      meetingUrl: data.meeting_url,
      botName: data.bot_name
    })

  } catch (error: any) {
    console.error('❌ Error getting bot status:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
