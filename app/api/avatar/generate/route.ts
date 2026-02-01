import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

interface AvatarRequest {
  personaId: string
  cargo?: string
  job_title?: string
  profession?: string
  profissao?: string
  age: number
  temperament: string
  business_type: 'B2B' | 'B2C'
}

export async function POST(request: NextRequest) {
  try {
    const body: AvatarRequest = await request.json()

    // Determina o cargo/profissão baseado no tipo de negócio
    const role = body.business_type === 'B2B'
      ? (body.job_title || body.cargo || 'business professional')
      : (body.profession || body.profissao || 'professional')

    // Monta prompt para webcam view (sem UI elements)
    const prompt = `Webcam photograph of a ${body.age} year old brazilian man who works as ${role}.
Person centered in frame, head and upper body visible, looking directly at camera with friendly expression.
Wearing navy blue business suit, white shirt, dark tie.
Home office background with bookshelf or neutral blurred background, natural indoor lighting from window.
Real photograph captured by webcam, natural skin texture, authentic appearance.
NO icons, NO buttons, NO UI elements, NO text overlays, NO video call interface - just the person.
Clean image, 16:9 aspect ratio, photorealistic.`

    console.log('Generating avatar with prompt:', prompt)

    // Chama DALL-E 3 para gerar imagem 16:9 (landscape)
    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: prompt,
      n: 1,
      size: '1792x1024', // 16:9 landscape para video call style
      quality: 'standard',
      response_format: 'url',
    })

    const imageUrl = response.data?.[0]?.url

    if (!imageUrl) {
      throw new Error('No image URL returned from DALL-E')
    }

    console.log('Avatar generated successfully:', imageUrl)

    return NextResponse.json({
      success: true,
      imageUrl,
      // URL do DALL-E expira em ~1 hora, então retornamos para uso imediato
      // Para persistência, seria necessário salvar no Supabase Storage
    })

  } catch (error) {
    console.error('Error generating avatar:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to generate avatar' },
      { status: 500 }
    )
  }
}
