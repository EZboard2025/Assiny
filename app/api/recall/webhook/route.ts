import { NextResponse } from 'next/server'

// In-memory transcript storage
// Note: In production, consider using Redis for persistence across instances
interface TranscriptSegment {
  speaker: string
  text: string
  timestamp: string
  isPartial?: boolean
}

interface BotTranscript {
  segments: TranscriptSegment[]
  lastUpdated: number
}

// Global store for active transcripts
const activeTranscripts = new Map<string, BotTranscript>()

// Cleanup old transcripts (older than 2 hours)
const CLEANUP_INTERVAL = 60 * 60 * 1000 // 1 hour
const MAX_AGE = 2 * 60 * 60 * 1000 // 2 hours

setInterval(() => {
  const now = Date.now()
  for (const [botId, transcript] of activeTranscripts.entries()) {
    if (now - transcript.lastUpdated > MAX_AGE) {
      activeTranscripts.delete(botId)
      console.log(`🗑️ Cleaned up transcript for bot: ${botId}`)
    }
  }
}, CLEANUP_INTERVAL)

// POST - Receive webhook from Recall.ai
export async function POST(request: Request) {
  try {
    const payload = await request.json()

    // Log full payload for debugging
    console.log('📥 Recall.ai webhook received:', JSON.stringify(payload, null, 2))

    // Recall.ai sends different event types
    // transcript.data - final transcript segment
    // transcript.partial_data - partial/interim transcript
    const eventType = payload.event || 'unknown'

    // Bot ID is at payload.data.bot.id according to Recall.ai docs
    const botId = payload.data?.bot?.id || payload.data?.bot_id || payload.bot_id

    if (!botId) {
      console.warn('⚠️ Webhook received without bot_id:', payload)
      return NextResponse.json({ success: true })
    }

    console.log(`📝 Webhook received: ${eventType} for bot ${botId}`)

    // Initialize transcript storage if not exists
    if (!activeTranscripts.has(botId)) {
      activeTranscripts.set(botId, {
        segments: [],
        lastUpdated: Date.now()
      })
    }

    const transcript = activeTranscripts.get(botId)!

    // Process transcript events
    // Payload structure according to Recall.ai docs:
    // {
    //   "event": "transcript.data",
    //   "data": {
    //     "data": {
    //       "words": [{ "text": "...", "start_timestamp": { "relative": 0.0 } }],
    //       "participant": { "id": 1, "name": "..." }
    //     },
    //     "bot": { "id": "..." }
    //   }
    // }
    if (eventType === 'transcript.data' || eventType === 'transcript.partial_data') {
      // The actual transcript data is nested under data.data
      const transcriptData = payload.data?.data

      if (transcriptData) {
        // Extract words from the transcript
        const words = transcriptData.words || []
        const text = words.map((w: any) => w.text).join(' ').trim()

        if (text) {
          // Get timestamp from first word if available
          const firstWord = words[0]
          const timestamp = firstWord?.start_timestamp?.relative !== undefined
            ? `${firstWord.start_timestamp.relative}s`
            : new Date().toISOString()

          const segment: TranscriptSegment = {
            speaker: transcriptData.participant?.name ||
              `Participante ${transcriptData.participant?.id || ''}`.trim(),
            text: text,
            timestamp: timestamp,
            isPartial: eventType === 'transcript.partial_data'
          }

          // For partial data, update the last segment if from same speaker
          if (eventType === 'transcript.partial_data') {
            const lastSegment = transcript.segments[transcript.segments.length - 1]
            if (lastSegment?.isPartial && lastSegment.speaker === segment.speaker) {
              // Update existing partial segment
              transcript.segments[transcript.segments.length - 1] = segment
            } else {
              // Add new partial segment
              transcript.segments.push(segment)
            }
          } else {
            // Final data - replace any partial segment from same speaker or add new
            const lastSegment = transcript.segments[transcript.segments.length - 1]
            if (lastSegment?.isPartial && lastSegment.speaker === segment.speaker) {
              transcript.segments[transcript.segments.length - 1] = segment
            } else {
              transcript.segments.push(segment)
            }
          }

          transcript.lastUpdated = Date.now()
          console.log(`📝 Transcript updated: ${segment.speaker}: "${text.substring(0, 50)}..."`)
        }
      } else {
        console.warn('⚠️ No transcript data in payload:', payload)
      }
    }

    // Handle status change events
    if (eventType === 'bot.status_change') {
      const status = payload.data?.status?.code || payload.data?.status || payload.status
      console.log(`📊 Bot status changed: ${status}`)

      // Clean up transcript when bot ends
      if (status === 'done' || status === 'fatal' || status === 'call_ended') {
        // Don't delete immediately - let frontend fetch final transcript first
        console.log(`🏁 Bot ${botId} ended with status: ${status}`)
      }
    }

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error('❌ Webhook error:', error)
    return NextResponse.json(
      { error: error.message || 'Webhook processing failed' },
      { status: 500 }
    )
  }
}

// Helper function to fetch transcript from Recall.ai API
async function fetchTranscriptFromRecallApi(botId: string): Promise<TranscriptSegment[]> {
  const RECALL_API_URL = process.env.RECALL_API_REGION
    ? `https://${process.env.RECALL_API_REGION}.recall.ai/api/v1`
    : 'https://us-west-2.recall.ai/api/v1'

  if (!process.env.RECALL_API_KEY) {
    console.warn('⚠️ RECALL_API_KEY not configured, cannot fetch from API')
    return []
  }

  try {
    // First, get the bot details to find the recording ID
    const botResponse = await fetch(`${RECALL_API_URL}/bot/${botId}/`, {
      headers: {
        'Authorization': `Token ${process.env.RECALL_API_KEY}`,
        'Accept': 'application/json'
      }
    })

    if (!botResponse.ok) {
      console.warn(`⚠️ Failed to fetch bot from Recall.ai: ${botResponse.status}`)
      return []
    }

    const botData = await botResponse.json()
    console.log('📥 Bot data from Recall.ai:', JSON.stringify(botData).substring(0, 500))

    // Check if there's a recording with transcript
    const recordings = botData.recordings || []
    if (recordings.length === 0) {
      console.log('📝 No recordings found for bot yet')
      return []
    }

    // Get the latest recording
    const latestRecording = recordings[recordings.length - 1]
    const recordingId = latestRecording.id

    // Fetch transcripts filtered by recording
    const transcriptResponse = await fetch(`${RECALL_API_URL}/transcript/?recording=${recordingId}`, {
      headers: {
        'Authorization': `Token ${process.env.RECALL_API_KEY}`,
        'Accept': 'application/json'
      }
    })

    if (!transcriptResponse.ok) {
      console.warn(`⚠️ Failed to fetch transcript from Recall.ai: ${transcriptResponse.status}`)

      // Try alternative: check if transcript is in media_shortcuts
      if (latestRecording.media_shortcuts?.transcript?.data?.download_url) {
        console.log('📥 Trying to fetch transcript from download URL...')
        const downloadResponse = await fetch(latestRecording.media_shortcuts.transcript.data.download_url)
        if (downloadResponse.ok) {
          const transcriptData = await downloadResponse.json()
          return parseTranscriptData(transcriptData)
        }
      }
      return []
    }

    const transcriptListData = await transcriptResponse.json()
    console.log('📥 Transcript list from Recall.ai:', JSON.stringify(transcriptListData).substring(0, 500))

    // Parse the results
    const segments: TranscriptSegment[] = []
    const results = transcriptListData.results || []

    for (const transcript of results) {
      // If transcript has download URL, fetch the actual data
      if (transcript.data?.download_url) {
        try {
          const dataResponse = await fetch(transcript.data.download_url)
          if (dataResponse.ok) {
            const data = await dataResponse.json()
            segments.push(...parseTranscriptData(data))
          }
        } catch (e) {
          console.warn('⚠️ Failed to fetch transcript data:', e)
        }
      }
    }

    return segments
  } catch (error) {
    console.error('❌ Error fetching transcript from Recall.ai:', error)
    return []
  }
}

// Helper to parse transcript data into segments
function parseTranscriptData(data: any): TranscriptSegment[] {
  const segments: TranscriptSegment[] = []

  if (Array.isArray(data)) {
    for (const item of data) {
      const words = item.words || []
      const text = words.map((w: any) => w.text).join(' ').trim()

      if (text) {
        segments.push({
          speaker: item.participant?.name || item.speaker || `Participante ${item.participant?.id || ''}`.trim(),
          text: text,
          timestamp: item.start_time?.toString() || new Date().toISOString(),
          isPartial: false
        })
      }
    }
  }

  return segments
}

// GET - Fetch transcript for a bot
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const botId = searchParams.get('botId')
    const useFallback = searchParams.get('fallback') === 'true'

    if (!botId) {
      return NextResponse.json(
        { error: 'botId is required' },
        { status: 400 }
      )
    }

    let transcript = activeTranscripts.get(botId)

    // Only use API fallback when explicitly requested (e.g., when ending session)
    // This prevents fetching old transcripts from previous bots during active polling
    if (useFallback && (!transcript || transcript.segments.length === 0)) {
      console.log(`📡 No local transcript for ${botId}, fetching from Recall.ai API...`)
      const apiSegments = await fetchTranscriptFromRecallApi(botId)

      if (apiSegments.length > 0) {
        // Cache the fetched transcript
        activeTranscripts.set(botId, {
          segments: apiSegments,
          lastUpdated: Date.now()
        })
        transcript = activeTranscripts.get(botId)
      }
    }

    if (!transcript || transcript.segments.length === 0) {
      return NextResponse.json({
        botId,
        transcript: [],
        message: 'No transcript found for this bot'
      })
    }

    // Filter out partial segments for cleaner output
    // But keep them if they're the last segment (still being spoken)
    const segments = transcript.segments.map((seg, idx) => {
      const isLast = idx === transcript!.segments.length - 1
      return {
        speaker: seg.speaker,
        text: seg.text,
        timestamp: seg.timestamp,
        isPartial: isLast ? seg.isPartial : false
      }
    }).filter((seg, idx, arr) => {
      // Keep all final segments, only keep partial if it's the last one
      return !seg.isPartial || idx === arr.length - 1
    })

    return NextResponse.json({
      botId,
      transcript: segments,
      lastUpdated: transcript.lastUpdated,
      totalSegments: transcript.segments.length
    })

  } catch (error: any) {
    console.error('❌ Error fetching transcript:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch transcript' },
      { status: 500 }
    )
  }
}

// DELETE - Clean up transcript for a bot
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const botId = searchParams.get('botId')

    if (!botId) {
      return NextResponse.json(
        { error: 'botId is required' },
        { status: 400 }
      )
    }

    const existed = activeTranscripts.has(botId)
    activeTranscripts.delete(botId)

    return NextResponse.json({
      success: true,
      deleted: existed,
      botId
    })

  } catch (error: any) {
    console.error('❌ Error deleting transcript:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete transcript' },
      { status: 500 }
    )
  }
}
