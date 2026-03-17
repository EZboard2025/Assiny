import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { processDesktopRecording } from '@/lib/meet/processDesktopRecording'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    // 1. Auth
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // 2. Parse body
    const { liveSessionId, transcript } = await request.json()

    if (!liveSessionId) {
      return NextResponse.json({ error: 'Missing liveSessionId' }, { status: 400 })
    }

    // 3. Validate transcript
    const transcriptText = Array.isArray(transcript)
      ? transcript.map((s: any) => s.text).join('\n')
      : ''

    if (transcriptText.length < 50) {
      return NextResponse.json({
        error: `Transcrição muito curta (${transcriptText.length} chars, mínimo 50)`
      }, { status: 400 })
    }

    // 4. Save final transcript to live session and mark as queued
    const { error: updateError } = await supabaseAdmin
      .from('meet_live_sessions')
      .update({
        transcript: transcript,
        status: 'evaluating',
        updated_at: new Date().toISOString(),
      })
      .eq('id', liveSessionId)
      .eq('user_id', user.id)

    if (updateError) {
      console.error('[SubmitDesktop] Update error:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    console.log(`[SubmitDesktop] Session ${liveSessionId} submitted for processing (${transcriptText.length} chars)`)

    // 5. Fire-and-forget background processing
    processDesktopRecording(liveSessionId).catch(err => {
      console.error(`[SubmitDesktop] Background processing failed for ${liveSessionId}:`, err)
    })

    // 6. Return immediately
    return NextResponse.json({
      success: true,
      message: 'Avaliação em andamento. Você receberá uma notificação quando estiver pronta.',
    })

  } catch (error: any) {
    console.error('[SubmitDesktop] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
