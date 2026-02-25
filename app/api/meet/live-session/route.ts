import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST: Create or update a live session
export async function POST(request: Request) {
  try {
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

    let body: any
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid or empty JSON body' }, { status: 400 })
    }
    const { action } = body

    if (action === 'start') {
      // Clean up any stale sessions from this user
      await supabaseAdmin
        .from('meet_live_sessions')
        .delete()
        .eq('user_id', user.id)
        .in('status', ['recording', 'evaluating'])

      // Create new live session
      const { data, error } = await supabaseAdmin
        .from('meet_live_sessions')
        .insert({
          user_id: user.id,
          company_id: body.companyId || null,
          seller_name: body.sellerName || null,
          status: 'recording',
          transcript: [],
          segment_count: 0,
          word_count: 0,
        })
        .select('id')
        .single()

      if (error) {
        console.error('Error creating live session:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ sessionId: data.id })
    }

    if (action === 'update') {
      const { sessionId, transcript, segmentCount, wordCount } = body

      if (!sessionId) {
        return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 })
      }

      const { error } = await supabaseAdmin
        .from('meet_live_sessions')
        .update({
          transcript: transcript || [],
          segment_count: segmentCount || 0,
          word_count: wordCount || 0,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId)
        .eq('user_id', user.id)

      if (error) {
        console.error('Error updating live session:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ success: true })
    }

    if (action === 'stop') {
      const { sessionId, status: newStatus } = body

      if (!sessionId) {
        return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 })
      }

      const { error } = await supabaseAdmin
        .from('meet_live_sessions')
        .update({
          status: newStatus || 'completed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId)
        .eq('user_id', user.id)

      if (error) {
        console.error('Error stopping live session:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ success: true })
    }

    if (action === 'cleanup') {
      // Delete completed/error sessions older than 1 hour
      await supabaseAdmin
        .from('meet_live_sessions')
        .delete()
        .eq('user_id', user.id)
        .in('status', ['completed', 'error'])

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  } catch (error: any) {
    console.error('Live session error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
