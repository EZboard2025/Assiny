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
    const { analysisId, funcionou } = body

    if (!analysisId || funcionou === undefined) {
      return NextResponse.json(
        { error: 'analysisId e funcionou são obrigatórios' },
        { status: 400 }
      )
    }

    console.log('📝 Salvando exemplo de follow-up...')
    console.log('- analysisId:', analysisId)
    console.log('- funcionou:', funcionou)

    // 1. Buscar a análise do follow-up
    const { data: analysis, error: fetchError } = await supabaseAdmin
      .from('followup_analyses')
      .select('*')
      .eq('id', analysisId)
      .single()

    if (fetchError || !analysis) {
      console.error('❌ Erro ao buscar análise:', fetchError)
      return NextResponse.json(
        { error: 'Análise não encontrada' },
        { status: 404 }
      )
    }

    console.log('✅ Análise encontrada:', analysis.id)

    // 2. Buscar company_id do usuário
    const { data: employeeData } = await supabaseAdmin
      .from('employees')
      .select('company_id')
      .eq('user_id', analysis.user_id)
      .single()

    const companyId = employeeData?.company_id

    if (!companyId) {
      console.error('❌ Company ID não encontrado para o usuário')
      return NextResponse.json(
        { error: 'Company ID não encontrado' },
        { status: 400 }
      )
    }

    console.log('🏢 Company ID:', companyId)

    // 3. Gerar embedding do texto
    const textForEmbedding = `
CONTEXTO:
- Tipo de Venda: ${analysis.tipo_venda}
- Canal: ${analysis.canal}
- Fase do Funil: ${analysis.fase_funil}

FOLLOW-UP:
${analysis.transcricao_filtrada}
    `.trim()

    console.log('🔄 Gerando embedding...')

    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: textForEmbedding
    })

    const embedding = embeddingResponse.data[0].embedding
    console.log('✅ Embedding gerado:', embedding.length, 'dimensões')

    // 4. Salvar na tabela correta baseado no resultado
    const tableName = funcionou ? 'followup_examples_success' : 'followup_examples_failure'

    // Estrutura compatível com N8N Supabase Vector Store
    const exampleData = {
      company_id: companyId,
      user_id: analysis.user_id,
      tipo_venda: analysis.tipo_venda,
      canal: analysis.canal,
      fase_funil: analysis.fase_funil,
      content: analysis.transcricao_filtrada,  // N8N usa 'content' como padrão
      nota_original: analysis.nota_final,
      embedding: embedding,
      // Metadata JSONB para filtros do N8N
      metadata: {
        company_id: companyId,
        tipo_venda: analysis.tipo_venda,
        canal: analysis.canal,
        fase_funil: analysis.fase_funil,
        nota_original: analysis.nota_final
      },
      followup_analysis_id: analysisId
    }

    console.log(`💾 Salvando em ${tableName}...`)

    const { data: insertedData, error: insertError } = await supabaseAdmin
      .from(tableName)
      .insert(exampleData)
      .select()
      .single()

    if (insertError) {
      console.error('❌ Erro ao salvar exemplo:', insertError)
      return NextResponse.json(
        { error: 'Erro ao salvar exemplo', details: insertError.message },
        { status: 500 }
      )
    }

    console.log('✅ Exemplo salvo com sucesso!')
    console.log('- ID:', insertedData?.id)
    console.log('- Tabela:', tableName)

    return NextResponse.json({
      success: true,
      message: `Exemplo salvo em ${tableName}`,
      id: insertedData?.id,
      tableName
    })

  } catch (error: any) {
    console.error('❌ Erro ao salvar exemplo:', error)
    return NextResponse.json(
      { error: 'Erro ao salvar exemplo', details: error.message },
      { status: 500 }
    )
  }
}
