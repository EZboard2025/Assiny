import { NextRequest, NextResponse } from 'next/server'

// Vexa Cloud API
const VEXA_API_URL = 'https://api.cloud.vexa.ai'
const VEXA_API_KEY = 'q7ZeKSTwiAhjPH1pMFNmNNgx5bPdyDYBv5Nl8jZ5'

// DELETE /api/vexa/bots/[platform]/[meetingId] - Delete/stop a bot
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string; meetingId: string }> }
) {
  try {
    const { platform, meetingId } = await params

    const response = await fetch(
      `${VEXA_API_URL}/bots/${platform}/${meetingId}`,
      {
        method: 'DELETE',
        headers: {
          'X-API-Key': VEXA_API_KEY
        }
      }
    )

    // Handle empty response (204 No Content)
    if (response.status === 204) {
      return new NextResponse(null, { status: 204 })
    }

    const text = await response.text()

    let data
    try {
      data = JSON.parse(text)
    } catch {
      data = { success: response.ok }
    }

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Vexa API error (delete bot):', error)
    return NextResponse.json(
      { error: 'Failed to delete bot' },
      { status: 500 }
    )
  }
}
