import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { processCompletedBot } from '@/lib/meet/processCompletedBot'
import { fetchTranscriptFromRecallApi, TranscriptSegment } from '@/lib/meet/recallApi'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// In-memory transcript storage (for live polling while user is on the page)
interface BotTranscript {
  segments: TranscriptSegment[]
  lastUpdated: number
}

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

// Track which bots have already been dispatched for background processing
const processedBots = new Set<string>()

// POST - Receive webhook from Recall.ai
export async function POST(request: Request) {
  try {
    const payload = await request.json()

    console.log('📥 Recall.ai webhook received:', JSON.stringify(payload, null, 2))

    const eventType = payload.event || 'unknown'
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

    // Process transcript events (unchanged - keeps live polling working)
    if (eventType === 'transcript.data' || eventType === 'transcript.partial_data') {
      const transcriptData = payload.data?.data

      if (transcriptData) {
        const words = transcriptData.words || []
        const text = words.map((w: any) => w.text).join(' ').trim()

        if (text) {
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

          if (eventType === 'transcript.partial_data') {
            const lastSegment = transcript.segments[transcript.segments.length - 1]
            if (lastSegment?.isPartial && lastSegment.speaker === segment.speaker) {
              transcript.segments[transcript.segments.length - 1] = segment
            } else {
              transcript.segments.push(segment)
            }
          } else {
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

    // Handle bot lifecycle events (Recall sends bot.joining_call, bot.in_call_recording, bot.done, bot.fatal, etc.)
    if (eventType.startsWith('bot.')) {
      const statusCode = payload.data?.data?.code || eventType.replace('bot.', '')
      console.log(`📊 Bot event: ${eventType}, status code: ${statusCode}`)

      // Map Recall event types to our internal statuses
      const statusMap: Record<string, string> = {
        'ready': 'created',
        'joining_call': 'joining',
        'in_waiting_room': 'joining',
        'in_call_not_recording': 'joining',
        'in_call_recording': 'recording',
        'call_ended': 'processing',
        'done': 'processing',
        'analysis_done': 'processing'
      }

      const mappedStatus = statusMap[statusCode]
      if (mappedStatus) {
        await supabaseAdmin
          .from('meet_bot_sessions')
          .update({ recall_status: statusCode, status: mappedStatus, updated_at: new Date().toISOString() })
          .eq('bot_id', botId)

        // Also sync status to calendar_scheduled_bots (if auto-scheduled)
        const calendarStatusMap: Record<string, string> = {
          'joining': 'joining',
          'recording': 'recording',
          'processing': 'recording', // Keep showing "recording" until evaluation completes
        }
        const calBotStatus = calendarStatusMap[mappedStatus]
        if (calBotStatus) {
          try {
            await supabaseAdmin
              .from('calendar_scheduled_bots')
              .update({ bot_status: calBotStatus, updated_at: new Date().toISOString() })
              .eq('bot_id', botId)
          } catch { /* Non-fatal */ }
        }
      }

      // When bot finishes (bot.done), trigger background evaluation (fire-and-forget)
      if (eventType === 'bot.done' && !processedBots.has(botId)) {
        processedBots.add(botId)
        console.log(`🚀 [MeetBG] Dispatching background evaluation for bot ${botId}`)

        // Fire-and-forget - do NOT await
        processCompletedBot(botId).catch(err => {
          console.error(`[MeetBG] Error processing bot ${botId}:`, err)
        }).finally(() => {
          // Clean up after 10 minutes
          setTimeout(() => processedBots.delete(botId), 10 * 60 * 1000)
        })
      }

      if (eventType === 'bot.fatal') {
        console.error(`🏁 Bot ${botId} ended with FATAL status`)
        await supabaseAdmin
          .from('meet_bot_sessions')
          .update({
            status: 'error',
            recall_status: 'fatal',
            error_message: 'Bot encerrou com erro fatal',
            updated_at: new Date().toISOString()
          })
          .eq('bot_id', botId)

        // Also update calendar_scheduled_bots
        try {
          await supabaseAdmin
            .from('calendar_scheduled_bots')
            .update({ bot_status: 'error', error_message: 'Bot fatal error', updated_at: new Date().toISOString() })
            .eq('bot_id', botId)
        } catch { /* Non-fatal */ }
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

// GET - Fetch transcript for a bot (live polling from frontend)
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

    // Only use API fallback when explicitly requested
    if (useFallback && (!transcript || transcript.segments.length === 0)) {
      console.log(`📡 No local transcript for ${botId}, fetching from Recall.ai API...`)
      const apiSegments = await fetchTranscriptFromRecallApi(botId)

      if (apiSegments.length > 0) {
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

    const segments = transcript.segments.map((seg, idx) => {
      const isLast = idx === transcript!.segments.length - 1
      return {
        speaker: seg.speaker,
        text: seg.text,
        timestamp: seg.timestamp,
        isPartial: isLast ? seg.isPartial : false
      }
    }).filter((seg, idx, arr) => {
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
