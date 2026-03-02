import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const requestId = searchParams.get('requestId')

    if (!requestId) {
      return NextResponse.json({ error: 'requestId is required' }, { status: 400 })
    }

    const { data: scrapeRequest, error } = await supabaseAdmin
      .from('scrape_requests')
      .select('status, messages_found, error_message, expires_at')
      .eq('id', requestId)
      .single()

    if (error || !scrapeRequest) {
      return NextResponse.json({ status: 'not_found' }, { status: 404 })
    }

    // Auto-expire if past expiry and still pending
    if (
      scrapeRequest.status === 'pending' &&
      new Date(scrapeRequest.expires_at) < new Date()
    ) {
      await supabaseAdmin
        .from('scrape_requests')
        .update({ status: 'expired', updated_at: new Date().toISOString() })
        .eq('id', requestId)

      return NextResponse.json({ status: 'expired' })
    }

    return NextResponse.json({
      status: scrapeRequest.status,
      messagesFound: scrapeRequest.messages_found,
      error: scrapeRequest.error_message,
    })
  } catch (error: any) {
    console.error('[Scrape Status] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
