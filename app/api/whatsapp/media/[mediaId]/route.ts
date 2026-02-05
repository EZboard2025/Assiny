import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getConnectedClient } from '@/lib/whatsapp-client'

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

    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // With whatsapp-web.js, media is downloaded at message time and stored in raw_payload
    // Look up the message by wa_message_id to get the raw media data
    const { data: message } = await supabaseAdmin
      .from('whatsapp_messages')
      .select('raw_payload, media_mime_type')
      .eq('wa_message_id', mediaId)
      .eq('user_id', user.id)
      .single()

    if (!message) {
      return NextResponse.json({ error: 'Media not found' }, { status: 404 })
    }

    // Try to download media via the active client
    const client = getConnectedClient(user.id)
    if (!client) {
      return NextResponse.json({ error: 'WhatsApp not connected' }, { status: 404 })
    }

    // Get message from whatsapp-web.js by serialized ID
    try {
      const waMsg = await client.getMessageById(mediaId)
      if (waMsg && waMsg.hasMedia) {
        const media = await waMsg.downloadMedia()
        if (media) {
          const buffer = Buffer.from(media.data, 'base64')
          return new NextResponse(new Uint8Array(buffer), {
            headers: {
              'Content-Type': media.mimetype,
              'Cache-Control': 'public, max-age=86400'
            }
          })
        }
      }
    } catch (e) {
      console.error('Error downloading media from WA:', e)
    }

    return NextResponse.json({ error: 'Media not available' }, { status: 404 })

  } catch (error: any) {
    console.error('Error fetching media:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch media' },
      { status: 500 }
    )
  }
}
