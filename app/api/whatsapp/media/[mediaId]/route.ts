import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getMediaUrl, downloadMedia } from '@/lib/whatsapp-api'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ mediaId: string }> }
) {
  try {
    const { mediaId } = await params

    if (!mediaId) {
      return NextResponse.json({ error: 'mediaId is required' }, { status: 400 })
    }

    // Get authenticated user
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's active connection for the access token
    const { data: connection } = await supabaseAdmin
      .from('whatsapp_connections')
      .select('access_token')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()

    if (!connection) {
      return NextResponse.json({ error: 'No active WhatsApp connection' }, { status: 404 })
    }

    // Get media URL from Meta
    const mediaInfo = await getMediaUrl(mediaId, connection.access_token)

    // Download media binary
    const { buffer, contentType } = await downloadMedia(mediaInfo.url, connection.access_token)

    // Return media with appropriate content type
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400' // Cache for 24 hours
      }
    })

  } catch (error: any) {
    console.error('Error fetching media:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch media' },
      { status: 500 }
    )
  }
}
