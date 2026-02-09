import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const { companyDataId } = await req.json()

    console.log('🔄 Gerando embeddings para company_data_id:', companyDataId)

    // 1. Buscar dados do formulário
    const { data: companyData, error: fetchError } = await supabase
      .from('company_data')
      .select('*')
      .eq('id', companyDataId)
      .single()

    if (fetchError || !companyData) {
      console.error('❌ Erro ao buscar company_data:', fetchError)
      return NextResponse.json(
        { error: 'Dados da empresa não encontrados' },
        { status: 404 }
      )
    }

    console.log('✅ Dados da empresa encontrados:', companyData.nome)
    console.log('🏢 Company ID:', companyData.company_id)

    // 2. Limpar embeddings antigos
    const { error: deleteError } = await supabase
      .from('documents')
      .delete()
      .eq('company_data_id', companyDataId)

    if (deleteError) {
      console.error('⚠️ Erro ao limpar embeddings antigos:', deleteError)
    } else {
      console.log('🗑️ Embeddings antigos removidos')
    }

    // 3. Quebrar em chunks semânticos (cada campo = 1 chunk)
    const chunks = [
      {
        category: 'identidade',
        question: 'Qual o nome da empresa?',
        content: `Nome da empresa: ${companyData.nome || 'Não informado'}`
      },
      {
        category: 'identidade',
        question: 'O que a empresa faz?',
        content: `Descrição: ${companyData.descricao || 'Não informada'}`
      },
      {
        category: 'produtos',
        question: 'Quais produtos a empresa oferece?',
        content: `Produtos e serviços: ${companyData.produtos_servicos || 'Não informados'}\n\nFunção prática: ${companyData.funcao_produtos || 'Não informada'}`
      },
      {
        category: 'diferenciais',
        question: 'Quais os diferenciais da empresa?',
        content: `Diferenciais: ${companyData.diferenciais || 'Não informados'}`
      },
      {
        category: 'concorrentes',
        question: 'Quem são os concorrentes?',
        content: `Concorrentes diretos: ${companyData.concorrentes || 'Não informados'}`
      },
      {
        category: 'metricas',
        question: 'Quais dados podem ser citados?',
        content: `Métricas verificáveis: ${companyData.dados_metricas || 'Não informadas'}`
      },
      {
        category: 'erros',
        question: 'Que erros vendedores cometem?',
        content: `Erros comuns: ${companyData.erros_comuns || 'Não informados'}`
      },
      {
        category: 'posicionamento',
        question: 'Como a empresa quer ser vista?',
        content: `Percepção desejada: ${companyData.percepcao_desejada || 'Não informada'}`
      },
      {
        category: 'solucoes',
        question: 'Quais dores a empresa resolve?',
        content: `Dores resolvidas: ${companyData.dores_resolvidas || 'Não informadas'}`
      }
    ]

    console.log('📦 Gerando embeddings para', chunks.length, 'chunks...')

    // 4. Gerar embeddings com OpenAI e inserir no Supabase
    let successCount = 0
    let errorCount = 0

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]

      try {
        console.log(`⏳ [${i + 1}/${chunks.length}] Gerando embedding para categoria: ${chunk.category}`)

        // Gerar embedding com OpenAI
        const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: 'text-embedding-3-small',
            input: chunk.content
          })
        })

        if (!embeddingResponse.ok) {
          const errorText = await embeddingResponse.text()
          console.error(`❌ [${i + 1}/${chunks.length}] Erro OpenAI:`, errorText)
          errorCount++
          continue
        }

        const embeddingData = await embeddingResponse.json()
        const embedding = embeddingData.data[0].embedding

        // Inserir embedding no Supabase
        const { error: insertError } = await supabase
          .from('documents')
          .insert({
            company_data_id: companyDataId,
            company_id: companyData.company_id, // Multi-tenant support
            category: chunk.category,
            question: chunk.question,
            content: chunk.content,
            embedding: embedding,
            metadata: {
              category: chunk.category,
              question: chunk.question,
              company_data_id: companyDataId,
              company_id: companyData.company_id
            }
          })

        if (insertError) {
          console.error(`❌ [${i + 1}/${chunks.length}] Erro ao inserir:`, insertError)
          errorCount++
        } else {
          console.log(`✅ [${i + 1}/${chunks.length}] Embedding salvo com sucesso`)
          successCount++
        }

      } catch (error) {
        console.error(`💥 [${i + 1}/${chunks.length}] Erro inesperado:`, error)
        errorCount++
      }
    }

    console.log(`🎉 Processo concluído! Sucesso: ${successCount}, Erros: ${errorCount}`)

    return NextResponse.json({
      success: true,
      embeddings_created: successCount,
      embeddings_failed: errorCount,
      total: chunks.length
    })

  } catch (error) {
    console.error('💥 Erro geral na geração de embeddings:', error)
    return NextResponse.json(
      { error: 'Erro ao gerar embeddings', details: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    )
  }
}
