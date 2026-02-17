// Shared Recall.ai API helpers for both webhook and background processing

export interface TranscriptSegment {
  speaker: string
  text: string
  timestamp: string
  isPartial?: boolean
}

const getRecallApiUrl = () => {
  return process.env.RECALL_API_REGION
    ? `https://${process.env.RECALL_API_REGION}.recall.ai/api/v1`
    : 'https://us-west-2.recall.ai/api/v1'
}

export async function fetchTranscriptFromRecallApi(botId: string): Promise<TranscriptSegment[]> {
  const RECALL_API_URL = getRecallApiUrl()

  if (!process.env.RECALL_API_KEY) {
    console.warn('[RecallAPI] RECALL_API_KEY not configured')
    return []
  }

  try {
    const botResponse = await fetch(`${RECALL_API_URL}/bot/${botId}/`, {
      headers: {
        'Authorization': `Token ${process.env.RECALL_API_KEY}`,
        'Accept': 'application/json'
      }
    })

    if (!botResponse.ok) {
      console.warn(`[RecallAPI] Failed to fetch bot: ${botResponse.status}`)
      return []
    }

    const botData = await botResponse.json()

    const recordings = botData.recordings || []
    if (recordings.length === 0) {
      console.log('[RecallAPI] No recordings found for bot')
      return []
    }

    const latestRecording = recordings[recordings.length - 1]
    const recordingId = latestRecording.id

    const transcriptResponse = await fetch(`${RECALL_API_URL}/transcript/?recording=${recordingId}`, {
      headers: {
        'Authorization': `Token ${process.env.RECALL_API_KEY}`,
        'Accept': 'application/json'
      }
    })

    if (!transcriptResponse.ok) {
      console.warn(`[RecallAPI] Failed to fetch transcript: ${transcriptResponse.status}`)

      if (latestRecording.media_shortcuts?.transcript?.data?.download_url) {
        console.log('[RecallAPI] Trying download URL fallback...')
        const downloadResponse = await fetch(latestRecording.media_shortcuts.transcript.data.download_url)
        if (downloadResponse.ok) {
          const transcriptData = await downloadResponse.json()
          return parseTranscriptData(transcriptData)
        }
      }
      return []
    }

    const transcriptListData = await transcriptResponse.json()

    const segments: TranscriptSegment[] = []
    const results = transcriptListData.results || []

    for (const transcript of results) {
      if (transcript.data?.download_url) {
        try {
          const dataResponse = await fetch(transcript.data.download_url)
          if (dataResponse.ok) {
            const data = await dataResponse.json()
            segments.push(...parseTranscriptData(data))
          }
        } catch (e) {
          console.warn('[RecallAPI] Failed to fetch transcript data:', e)
        }
      }
    }

    return segments
  } catch (error) {
    console.error('[RecallAPI] Error fetching transcript:', error)
    return []
  }
}

function parseTranscriptData(data: any): TranscriptSegment[] {
  const segments: TranscriptSegment[] = []

  if (Array.isArray(data)) {
    for (const item of data) {
      const words = item.words || []
      const text = words.map((w: any) => w.text).join(' ').trim()

      if (text) {
        segments.push({
          speaker: item.participant?.name || item.speaker || `Participante ${item.participant?.id || ''}`.trim(),
          text,
          timestamp: item.start_time?.toString() || new Date().toISOString(),
          isPartial: false
        })
      }
    }
  }

  return segments
}
