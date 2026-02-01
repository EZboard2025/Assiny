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

    // Monta prompt para retrato profissional simples (sem UI)
    const prompt = `Professional portrait photograph of a ${body.age} year old brazilian man who works as ${role}.
Head and shoulders portrait, person looking directly at viewer with confident friendly expression.
Wearing professional business attire, navy suit with white shirt.
Simple home office background, slightly blurred, soft natural lighting.
High quality portrait photo, natural skin texture, photorealistic.
Just the person against the background, nothing else in the image.`

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
