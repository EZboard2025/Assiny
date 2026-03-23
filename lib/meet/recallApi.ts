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

  const headers = {
    'Authorization': `Token ${process.env.RECALL_API_KEY}`,
    'Accept': 'application/json'
  }

  try {
    // Step 1: Get bot details to find transcript ID
    const botResponse = await fetch(`${RECALL_API_URL}/bot/${botId}/`, { headers })

    if (!botResponse.ok) {
      console.warn(`[RecallAPI] Failed to fetch bot: ${botResponse.status}`)
      return []
    }

    const botData = await botResponse.json()

    // Step 2: Try new transcript endpoint using transcript ID from bot data
    const transcriptId = botData.transcript?.id
    if (transcriptId) {
      console.log(`[RecallAPI] Fetching transcript via /transcript/${transcriptId}/`)
      const transcriptResponse = await fetch(`${RECALL_API_URL}/transcript/${transcriptId}/`, { headers })

      if (transcriptResponse.ok) {
        const transcriptData = await transcriptResponse.json()
        const items = transcriptData?.results || (Array.isArray(transcriptData) ? transcriptData : [])
        const segments = parseBotTranscriptData({ results: items })

        if (segments.length > 0) {
          console.log(`[RecallAPI] Got ${segments.length} segments from /transcript/${transcriptId}/`)
          return segments
        }
      } else {
        const errorBody = await transcriptResponse.text().catch(() => '')
        console.warn(`[RecallAPI] Transcript endpoint returned ${transcriptResponse.status}: ${errorBody.slice(0, 200)}`)
      }
    }

    // Step 3: Fallback — recording's direct download URL
    const recordings = botData.recordings || []
    if (recordings.length > 0) {
      const latestRecording = recordings[recordings.length - 1]

      if (latestRecording.media_shortcuts?.transcript?.data?.download_url) {
        console.log('[RecallAPI] Using recording download URL fallback...')
        const downloadResponse = await fetch(latestRecording.media_shortcuts.transcript.data.download_url)
        if (downloadResponse.ok) {
          const transcriptData = await downloadResponse.json()
          const segments = parseTranscriptData(transcriptData)
          if (segments.length > 0) {
            console.log(`[RecallAPI] Got ${segments.length} segments from download URL`)
            return segments
          }
        }
      }
    }

    console.warn(`[RecallAPI] No transcript data found for bot ${botId}`)
    return []
  } catch (error) {
    console.error('[RecallAPI] Error fetching transcript:', error)
    return []
  }
}

/**
 * Parse response from GET /bot/{id}/transcript/
 * Returns array of objects with speaker, words, is_final, etc.
 */
function parseBotTranscriptData(data: any): TranscriptSegment[] {
  const segments: TranscriptSegment[] = []

  // Can be an array directly or paginated { results: [...] }
  const items = Array.isArray(data) ? data : (data?.results || [])

  for (const item of items) {
    const words = item.words || []
    const text = words.map((w: any) => w.text).join(' ').trim()

    if (text) {
      const startTime = words[0]?.start_time
      segments.push({
        speaker: item.speaker || item.participant?.name || `Participante ${item.speaker_id ?? ''}`.trim(),
        text,
        timestamp: startTime !== undefined ? `${startTime}s` : new Date().toISOString(),
        isPartial: item.is_final === false
      })
    }
  }

  return segments
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
