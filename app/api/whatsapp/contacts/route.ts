import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getConnectedClient } from '@/lib/whatsapp-client'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const client = getConnectedClient(user.id)
    if (!client) {
      return NextResponse.json({ error: 'WhatsApp not connected' }, { status: 404 })
    }

    // Use Store.Contact via pupPage for performance (avoids heavy serialization)
    const contacts = await Promise.race([
      client.pupPage!.evaluate(() => {
        const contacts = (window as any).Store.Contact.getModelsArray()
        return contacts
          .filter((c: any) => {
            // Only real contacts (not groups, not status, not self)
            const id = c.id?._serialized || ''
            return (
              id.endsWith('@c.us') &&
              !c.isMe &&
              (c.isMyContact || c.name || c.pushname)
            )
          })
          .map((c: any) => ({
            id: c.id?._serialized || '',
            phone: c.id?.user || '',
            name: c.name || c.pushname || c.id?.user || '',
            pushname: c.pushname || '',
            isMyContact: c.isMyContact || false,
            profilePicThumbObj: c.profilePicThumb?.__x_imgFull || null
          }))
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout fetching contacts')), 30000))
    ])

    return NextResponse.json({ contacts })
  } catch (error: any) {
    console.error('[WhatsApp Contacts]', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch contacts' },
      { status: 500 }
    )
  }
}
