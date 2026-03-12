import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST: Create bucket if needed + return signed upload URL
export async function POST(request: NextRequest) {
  try {
    const { fileName, userId } = await request.json()

    if (!fileName || !userId) {
      return NextResponse.json({ error: 'fileName and userId required' }, { status: 400 })
    }

    // Ensure bucket exists
    const { error: bucketError } = await supabase.storage.createBucket('meet-uploads', {
      public: false,
      fileSizeLimit: 524288000, // 500MB
    })

    if (bucketError && !bucketError.message?.includes('already exists')) {
      console.error('[EnsureBucket] Bucket creation error:', bucketError)
      // Try to list buckets to check if it exists
      const { data: buckets } = await supabase.storage.listBuckets()
      const exists = buckets?.some(b => b.name === 'meet-uploads')
      if (!exists) {
        return NextResponse.json({ error: 'Não foi possível criar o bucket: ' + bucketError.message }, { status: 500 })
      }
    }

    console.log('[EnsureBucket] Bucket OK')

    // Generate a unique storage path
    const ext = fileName.split('.').pop() || 'mp3'
    const storagePath = `${userId}/${Date.now()}.${ext}`

    // Create signed upload URL (valid for 10 minutes)
    const { data, error } = await supabase.storage
      .from('meet-uploads')
      .createSignedUploadUrl(storagePath)

    if (error) {
      console.error('[EnsureBucket] Signed URL error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('[EnsureBucket] Signed URL created for:', storagePath)

    return NextResponse.json({
      signedUrl: data.signedUrl,
      token: data.token,
      storagePath
    })
  } catch (err: any) {
    console.error('[EnsureBucket] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
