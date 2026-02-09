import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { analysisId } = body

    if (!analysisId) {
      return NextResponse.json(
        { error: 'analysisId é obrigatório' },
        { status: 400 }
      )
    }

    console.log('🔄 Gerando embedding para analysis:', analysisId)

    // 1. Buscar a análise do follow-up
    const { data: analysis, error: fetchError } = await supabaseAdmin
      .from('followup_analyses')
      .select('transcricao_filtrada, tipo_venda, canal, fase_funil')
      .eq('id', analysisId)
      .single()

    if (fetchError || !analysis) {
      console.error('❌ Erro ao buscar análise:', fetchError)
      return NextResponse.json(
        { error: 'Análise não encontrada' },
        { status: 404 }
      )
    }

    // 2. Criar texto para embedding (transcrição + contexto)
    // Incluir contexto ajuda a encontrar exemplos mais relevantes
    const textForEmbedding = `
CONTEXTO:
- Tipo de Venda: ${analysis.tipo_venda}
- Canal: ${analysis.canal}
- Fase do Funil: ${analysis.fase_funil}

FOLLOW-UP:
${analysis.transcricao_filtrada}
    `.trim()

    console.log('📝 Texto preparado para embedding (primeiros 200 chars):', textForEmbedding.substring(0, 200))

    // 3. Gerar embedding usando OpenAI
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: textForEmbedding
    })

    const embedding = embeddingResponse.data[0].embedding

    console.log('✅ Embedding gerado:', embedding.length, 'dimensões')

    // 4. Salvar embedding no banco
    const { error: updateError } = await supabaseAdmin
      .from('followup_analyses')
      .update({ embedding })
      .eq('id', analysisId)

    if (updateError) {
      console.error('❌ Erro ao salvar embedding:', updateError)
      return NextResponse.json(
        { error: 'Erro ao salvar embedding', details: updateError.message },
        { status: 500 }
      )
    }

    console.log('💾 Embedding salvo com sucesso!')

    return NextResponse.json({
      success: true,
      message: 'Embedding gerado com sucesso',
      dimensions: embedding.length
    })

  } catch (error: any) {
    console.error('❌ Erro ao gerar embedding:', error)
    return NextResponse.json(
      { error: 'Erro ao gerar embedding', details: error.message },
      { status: 500 }
    )
  }
}
