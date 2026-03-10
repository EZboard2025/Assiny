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

    // Filtra aparências por faixa etária para coerência visual
    const youngAppearances = [
      'mixed-race Brazilian man with medium brown skin and short curly black hair',
      'Black Brazilian man with dark skin and a short fade haircut',
      'Brazilian man with olive skin and short wavy brown hair',
      'Brazilian man of Japanese descent with short black hair',
      'Brazilian man with light skin and short brown hair',
      'Black Brazilian man with a buzzcut and dark brown skin',
      'Brazilian man of Italian descent with wavy dark hair and olive skin',
      'indigenous Brazilian man with straight black hair and bronze skin',
    ]

    const matureAppearances = [
      'mixed-race Brazilian man with medium brown skin and short graying curly hair',
      'Black Brazilian man with dark skin and short salt-and-pepper hair',
      'Brazilian man with olive skin, short brown hair with gray at the temples',
      'Brazilian man of Japanese descent with short black hair and glasses',
      'Brazilian man with tan skin and receding brown hair',
      'Brazilian man of Italian descent with graying wavy hair and olive skin',
      'Brazilian man with light skin, short gray hair and a trimmed beard',
      'indigenous Brazilian man with straight black hair with some gray and bronze skin',
    ]

    // Seleciona pool baseado na idade
    const pool = body.age <= 34 ? youngAppearances : matureAppearances
    const appearance = pool[Math.floor(Math.random() * pool.length)]

    // Descrição visual da idade para reforçar no prompt
    const ageVisual = body.age <= 24 ? 'young man in his early twenties, youthful smooth face, no wrinkles'
      : body.age <= 34 ? 'young adult man in his late twenties or early thirties'
      : body.age <= 44 ? 'man in his late thirties or early forties, some light expression lines'
      : 'mature man in his late forties or fifties, visible wrinkles and expression lines'

    // Prompt para DALL-E 3 — direto, natural, profissional
    const prompt = `Photo of a ${ageVisual}, specifically ${body.age} years old. ${appearance}. Works as ${role}.
Head and shoulders, looking at camera, natural smile.
Wearing a navy suit with white shirt.
Blurred home office background, soft natural window light.
Real photograph, natural skin, shot on Canon 50mm lens.
The age must be visually accurate — this person is exactly ${body.age} years old.`

    console.log('Generating avatar with DALL-E 3, age:', body.age, 'role:', role)

    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: prompt,
      n: 1,
      size: '1792x1024',
      quality: 'standard',
      response_format: 'url',
    })

    const imageUrl = response.data?.[0]?.url

    if (!imageUrl) {
      throw new Error('No image URL returned from DALL-E')
    }

    console.log('Avatar generated successfully')

    return NextResponse.json({
      success: true,
      imageUrl,
    })

  } catch (error) {
    console.error('Error generating avatar:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to generate avatar' },
      { status: 500 }
    )
  }
}
