import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const { question } = await req.json()

    console.log('🔍 Pergunta:', question)

    // 1. Gerar embedding da pergunta
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'text-embedding-ada-002',
        input: question
      })
    })

    const embeddingData = await embeddingResponse.json()
    const queryEmbedding = embeddingData.data[0].embedding

    // 2. Buscar por similaridade
    const { data, error } = await supabase.rpc('match_company_knowledge', {
      query_embedding: queryEmbedding,
      match_threshold: 0.5,
      match_count: 5
    })

    if (error) {
      console.error('Erro na busca:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('✅ Resultados encontrados:', data?.length || 0)

    return NextResponse.json({
      question,
      results: data || [],
      count: data?.length || 0
    })

  } catch (error) {
    console.error('Erro:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    )
  }
}
