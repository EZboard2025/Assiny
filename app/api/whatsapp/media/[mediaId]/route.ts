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
    const { mediaId: rawMediaId } = await params

    if (!rawMediaId) {
      return NextResponse.json({ error: 'mediaId is required' }, { status: 400 })
    }

    // Decode the mediaId in case it was URL-encoded (handles paths with slashes)
    const mediaId = decodeURIComponent(rawMediaId)

    // Get token from query param or header
    const url = new URL(request.url)
    const tokenFromQuery = url.searchParams.get('token')
    const authHeader = request.headers.get('authorization')
    const token = tokenFromQuery || authHeader?.replace('Bearer ', '')

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // The mediaId could be a storage path (userId/timestamp_id.ext) or a wa_message_id
    // Try to detect based on format
    const isStoragePath = mediaId.includes('/') || mediaId.includes('.')

    if (isStoragePath) {
      // Try to get from Supabase Storage first
      const { data, error } = await supabaseAdmin.storage
        .from('whatsapp-media')
        .download(mediaId)

      if (data && !error) {
        const buffer = await data.arrayBuffer()

        // Determine content type from extension
        const ext = mediaId.split('.').pop()?.toLowerCase()
        const contentType = ext === 'ogg' ? 'audio/ogg' :
                           ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
                           ext === 'png' ? 'image/png' :
                           ext === 'mp4' ? 'video/mp4' :
                           ext === 'webp' ? 'image/webp' :
                           'application/octet-stream'

        return new NextResponse(new Uint8Array(buffer), {
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=86400'
          }
        })
      }
    }

    // Fallback: Try to download media on-demand from WhatsApp client
    const client = getConnectedClient(user.id)
    if (!client) {
      return NextResponse.json({ error: 'WhatsApp not connected' }, { status: 404 })
    }

    // Try to get message and download media
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
