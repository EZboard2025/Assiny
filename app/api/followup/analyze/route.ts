import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

// N8N webhook para análise de follow-up
const N8N_FOLLOWUP_WEBHOOK = 'https://ezboard.app.n8n.cloud/webhook/followup-analyzer'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ''
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Compatibilidade: aceitar tanto 'image' quanto 'images'
    const images = body.images || (body.image ? [body.image] : null)
    const filenames = body.filenames || (body.filename ? [body.filename] : [])
    const avaliacao = body.avaliacao
    const dadosEmpresa = body.dados_empresa || null
    const funil = body.funil || null  // String formatada: "Fase 1: xxx, Fase 2: xxx"
    const faseDoLead = body.fase_do_lead || null  // String: "Fase X: Nome da Fase"

    if (!images || images.length === 0) {
      return NextResponse.json(
        { error: 'Pelo menos uma imagem é obrigatória' },
        { status: 400 }
      )
    }


    try {
      // TESTE: Extrair o texto de todas as imagens usando GPT-4 Vision
      console.log(`Iniciando extração de texto de ${images.length} imagem(ns) com GPT-4 Vision...`)

      // Verificar se temos API key
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY não configurada')
      }

      // Processar cada imagem
      const extractedTexts = await Promise.all(
        images.map(async (image: string, index: number) => {
          const base64Data = image.replace(/^data:image\/\w+;base64,/, '')

          const visionResponse = await openai.chat.completions.create({
            model: "gpt-4o-mini", // Modelo atualizado que suporta vision
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: `Extraia TODO o texto desta conversa do WhatsApp (imagem ${index + 1} de ${images.length}).

Para cada mensagem, capture:
- O HORÁRIO que aparece (geralmente embaixo da mensagem)
- Quem enviou (vendedor ou cliente, se possível identificar)
- O texto completo da mensagem

Formato desejado:
[HH:MM] Remetente: Texto da mensagem

Exemplo:
[14:32] Cliente: Oi, gostaria de saber mais sobre o produto
[14:35] Vendedor: Olá! Claro, posso te ajudar...

Mantenha a ordem cronológica exata. Não adicione comentários ou análises, apenas transcreva o texto e horários exatamente como aparecem.`
                  },
                  {
                    type: "image_url",
                    image_url: {
                      url: image.startsWith('data:') ? image : `data:image/jpeg;base64,${base64Data}`
                    }
                  }
                ]
              }
            ],
            max_tokens: 4096
          })

          return visionResponse.choices[0].message.content || `[Erro ao extrair texto da imagem ${index + 1}]`
        })
      )

      // Combinar todos os textos extraídos
      const fullExtractedText = extractedTexts.join('\n\n--- CONTINUAÇÃO DA CONVERSA ---\n\n')

      console.log('Texto extraído com sucesso de todas as imagens')

      // SEGUNDA ETAPA: Filtrar e organizar apenas o follow-up relevante
      console.log('Processando e filtrando o follow-up...')

      const filterResponse = await openai.chat.completions.create({
        model: "gpt-4-turbo-preview", // Modelo mais barato que não precisa de vision
        messages: [
          {
            role: "system",
            content: `Você é um especialista em análise de conversas de vendas. Sua tarefa é identificar e extrair a parte de follow-up de uma conversa.

IMPORTANTE: Se não houver um follow-up claro (gap temporal, retomada, etc.), retorne a CONVERSA COMPLETA organizada.

DEFINIÇÃO DE FOLLOW-UP:
- Mensagem de retomada após período de silêncio (horas ou dias)
- Tentativa de reengajar após cliente parar de responder
- Retorno após cliente dizer "vou pensar", "depois eu vejo", "falo com meu sócio"
- Nova abordagem após mudança de dia
- Mensagens como "Oi, tudo bem?", "Conseguiu ver?", "Voltando ao nosso assunto"

SINAIS DE FOLLOW-UP:
1. Gap temporal: [14:30] → [18:45] ou [Ontem] → [Hoje]
2. Cliente sumiu e vendedor retoma
3. Mudança de tom (formal para check-in casual)
4. Referência a conversa anterior ("conforme conversamos", "sobre aquilo que falamos")

SE IDENTIFICAR FOLLOW-UP:
=== CONTEXTO ANTERIOR ===
[últimas 2-3 mensagens antes do gap]

=== INÍCIO DO FOLLOW-UP ===
[todas mensagens do follow-up]

=== RESPOSTA DO CLIENTE (se houver) ===
[resposta ao follow-up]

SE NÃO IDENTIFICAR FOLLOW-UP CLARO:
=== CONVERSA COMPLETA ===
[horário] Remetente: mensagem
[horário] Remetente: mensagem
(organize toda a conversa em ordem cronológica)

OBSERVAÇÃO: É melhor retornar a conversa completa organizada do que forçar uma identificação errada de follow-up.`
          },
          {
            role: "user",
            content: `Analise esta conversa:

${fullExtractedText}

INSTRUÇÕES:
1. Se encontrar um follow-up claro (gap temporal, retomada, etc.), extraia apenas essa parte
2. Se NÃO encontrar follow-up claro, retorne a conversa completa organizada
3. Preserve todos os horários e identifique corretamente quem é vendedor e cliente

Retorne as mensagens organizadas conforme o formato especificado.`
          }
        ],
        max_tokens: 2000,
        temperature: 0.3 // Baixa temperatura para ser mais preciso
      })

      let filteredText = filterResponse.choices[0].message.content || fullExtractedText

      // Limpar headers de formatação
      filteredText = filteredText
        .replace('=== CONVERSA COMPLETA ===', '')
        .replace('=== CONTEXTO ANTERIOR ===', '')
        .replace('=== INÍCIO DO FOLLOW-UP ===', '')
        .replace('=== RESPOSTA DO CLIENTE (se houver) ===', '')
        .trim()

      console.log('Follow-up filtrado e organizado com sucesso')

      // TERCEIRA ETAPA: Buscar company_id do usuário para o N8N filtrar os exemplos
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

      let companyId = null
      const authHeader = req.headers.get('authorization')

      if (authHeader) {
        const token = authHeader.replace('Bearer ', '')
        const { data: { user } } = await supabaseAdmin.auth.getUser(token)

        if (user) {
          const { data: employeeData } = await supabaseAdmin
            .from('employees')
            .select('company_id')
            .eq('user_id', user.id)
            .single()

          companyId = employeeData?.company_id
          console.log('🏢 Company ID para N8N:', companyId)
        }
      }

      // QUARTA ETAPA: Enviar para N8N para análise
      // Nota: Os exemplos de sucesso/falha são buscados pelo N8N via Supabase Vector Store usando company_id
      console.log('Enviando para N8N para análise...')
      if (dadosEmpresa) {
        console.log('Dados da empresa incluídos:', Object.keys(dadosEmpresa))
      }
      if (funil) {
        console.log('Fases do funil:', funil)
      }
      if (faseDoLead) {
        console.log('Fase do lead:', faseDoLead)
      }

      const n8nWebhookUrl = 'https://ezboard.app.n8n.cloud/webhook/c025a4ee-aa92-4a89-82fe-54eb6710a139'

      try {
        const n8nResponse = await fetch(n8nWebhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chatInput: "faça a analise",              // Mensagem padrão para o N8N
            transcricao: filteredText,                // Apenas o texto filtrado (follow-up identificado)
            tipo_venda: avaliacao.tipo_venda,         // B2B ou B2C
            canal: avaliacao.canal,                   // WhatsApp, E-mail, etc
            fase_funil: avaliacao.fase_funil,         // ID da fase selecionada
            dados_empresa: dadosEmpresa ? JSON.stringify(dadosEmpresa) : null,  // Stringify dos dados da empresa
            funil: funil,                             // String formatada: "Fase 1: Prospecção | Descrição: xxx | Objetivo: yyy || Fase 2: ..."
            fase_do_lead: faseDoLead,                 // String: "Fase 2: Qualificação" (fase atual do lead)
            company_id: companyId                     // Para filtrar exemplos no Supabase Vector Store
          })
        })

        let n8nResult = null

        if (n8nResponse.ok) {
          // Tentar ler como texto primeiro para detectar erros HTML
          const responseText = await n8nResponse.text()
          console.log('📥 N8N Raw Response (primeiros 500 chars):', responseText.substring(0, 500))

          // Verificar se é HTML
          if (responseText.trim().startsWith('<')) {
            console.error('❌ N8N retornou HTML ao invés de JSON')
            throw new Error('N8N retornou uma página HTML ao invés de JSON. O webhook pode estar com erro ou inativo.')
          }

          let n8nData
          try {
            n8nData = JSON.parse(responseText)
          } catch (parseError) {
            console.error('❌ Erro ao fazer parse da resposta do N8N:', parseError)
            console.error('Resposta recebida:', responseText)
            throw new Error('N8N retornou dados em formato inválido')
          }

          // N8N pode retornar em diferentes formatos
          if (n8nData && typeof n8nData === 'object') {
            // Caso 1: Resposta direta
            if (n8nData.analysis) {
              n8nResult = n8nData.analysis
            }
            // Caso 2: Array com output
            else if (Array.isArray(n8nData) && n8nData[0]?.output) {
              let outputString = n8nData[0].output

              // Remover markdown code blocks se existirem
              if (typeof outputString === 'string') {
                // Remove ```json do início e ``` do fim
                outputString = outputString.replace(/^```json\n/, '').replace(/\n```$/, '')

                try {
                  n8nResult = JSON.parse(outputString)
                } catch (e) {
                  console.error('Erro ao fazer parse do output:', e)
                  n8nResult = n8nData[0].output
                }
              } else {
                n8nResult = n8nData[0].output
              }
            }
            // Caso 3: Objeto com output
            else if (n8nData.output) {
              if (typeof n8nData.output === 'string') {
                let outputString = n8nData.output
                // Remove ```json do início e ``` do fim se existirem
                outputString = outputString.replace(/^```json\n/, '').replace(/\n```$/, '')

                try {
                  n8nResult = JSON.parse(outputString)
                } catch (e) {
                  console.error('Erro ao fazer parse do output:', e)
                  n8nResult = n8nData.output
                }
              } else {
                n8nResult = n8nData.output
              }
            }
            // Caso 4: É a análise diretamente
            else if (n8nData.notas) {
              n8nResult = n8nData
            }
            // Caso 5: Resposta vem como string JSON
            else if (typeof n8nData === 'string') {
              try {
                n8nResult = JSON.parse(n8nData)
              } catch (e) {
                console.error('Erro ao fazer parse da resposta do N8N:', e)
              }
            }
          }
        }

        // Log do resultado do N8N para debug
        console.log('📦 N8N Result estrutura:', {
          temResultado: !!n8nResult,
          temNotas: !!(n8nResult && n8nResult.notas),
          keys: n8nResult ? Object.keys(n8nResult) : []
        })

        // Se conseguiu análise do N8N, retornar ela
        if (n8nResult && n8nResult.notas) {
          console.log('✅ Análise recebida do N8N com sucesso - ENTRANDO NO BLOCO DE SALVAMENTO')

          // Garantir que timing está presente (adicionar se não estiver)
          if (!n8nResult.notas.timing) {
            n8nResult.notas.timing = {
              nota: 0,
              peso: 10,
              comentario: "Timing não avaliado"
            }
          }

          // Salvar análise no banco de dados
          // Vamos usar uma abordagem mais simples e direta
          // Extrair o token do header Authorization
          const authHeader = req.headers.get('authorization')
          const token = authHeader?.replace('Bearer ', '')

          console.log('🔐 Token presente?', !!token)

          if (token) {
            try {
              // Criar cliente Supabase com o token do usuário
              const supabase = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                {
                  global: {
                    headers: {
                      Authorization: `Bearer ${token}`
                    }
                  }
                }
              )

              // Obter o usuário atual
              const { data: { user }, error: userError } = await supabase.auth.getUser(token)

              console.log('🔍 Usuário:', user?.id)

              if (user && !userError) {
              console.log('✅ Usuário encontrado:', user.id)
              console.log('📊 N8N Result completo:', JSON.stringify(n8nResult, null, 2))
              console.log('📝 Dados da avaliação:', {
                tipo_venda: avaliacao.tipo_venda,
                canal: avaliacao.canal,
                fase_funil: avaliacao.fase_funil
              })
              console.log('🎯 Notas finais:', {
                nota_final: n8nResult.nota_final,
                classificacao: n8nResult.classificacao
              })

              // Buscar company_id do usuário através da tabela employees
              const supabaseAdminClient = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.SUPABASE_SERVICE_ROLE_KEY!
              )
              const { data: employeeData } = await supabaseAdminClient
                .from('employees')
                .select('company_id')
                .eq('user_id', user.id)
                .single()

              const userCompanyId = employeeData?.company_id
              console.log('🏢 Company ID do usuário:', userCompanyId)

              // Buscar o nome da fase do funil ao invés de salvar o ID
              let faseNome = avaliacao.fase_funil // Fallback para o ID caso não encontre
              if (userCompanyId && avaliacao.fase_funil) {
                const { data: faseData } = await supabaseAdminClient
                  .from('funnel_stages')
                  .select('stage_name')
                  .eq('id', avaliacao.fase_funil)
                  .eq('company_id', userCompanyId)
                  .single()

                if (faseData?.stage_name) {
                  faseNome = faseData.stage_name
                  console.log('✅ Nome da fase encontrado:', faseNome)
                }
              }

              // Preparar dados para inserção
              const dataToInsert: any = {
                user_id: user.id,
                tipo_venda: avaliacao.tipo_venda,
                canal: avaliacao.canal,
                fase_funil: faseNome, // Usar nome da fase ao invés do ID
                contexto: `Tipo: ${avaliacao.tipo_venda}, Canal: ${avaliacao.canal}, Fase: ${faseNome}`, // Campo obrigatório!
                transcricao_original: fullExtractedText,
                transcricao_filtrada: filteredText,
                avaliacao: n8nResult,
                nota_final: parseFloat(n8nResult.nota_final.toString()) || 0, // Garantir que é número
                classificacao: n8nResult.classificacao || 'indefinido'
              }

              // Adicionar company_id se encontrado (para RAG funcionar)
              if (userCompanyId) {
                dataToInsert.company_id = userCompanyId
                console.log('✅ company_id incluído na inserção:', userCompanyId)
              } else {
                console.warn('⚠️ company_id não encontrado - RAG pode não funcionar corretamente')
              }

              console.log('💾 Dados preparados para inserção:')
              console.log('- user_id:', dataToInsert.user_id, typeof dataToInsert.user_id)
              console.log('- tipo_venda:', dataToInsert.tipo_venda, typeof dataToInsert.tipo_venda)
              console.log('- nota_final:', dataToInsert.nota_final, typeof dataToInsert.nota_final)
              console.log('- classificacao:', dataToInsert.classificacao, typeof dataToInsert.classificacao)
              console.log('- tamanho transcricao_original:', dataToInsert.transcricao_original.length)
              console.log('- tamanho transcricao_filtrada:', dataToInsert.transcricao_filtrada.length)

              // Salvar análise no banco
              const { data: insertedData, error: insertError } = await supabase
                .from('followup_analyses')
                .insert(dataToInsert)
                .select()
                .single()

              if (insertError) {
                console.error('❌ Erro ao salvar análise no banco:', insertError)
                console.error('❌ Código do erro:', insertError.code)
                console.error('❌ Mensagem do erro:', insertError.message)
                console.error('❌ Detalhes do erro:', insertError.details)
                console.error('❌ Hint:', insertError.hint)
              } else {
                console.log('✅ Análise salva com sucesso no banco de dados!')
                console.log('✅ ID da análise salva:', insertedData?.id)
                console.log('✅ Dados salvos:', insertedData)
              }
              } else {
                console.error('❌ Usuário não encontrado ou erro:', userError)
              }
            } catch (dbError) {
              console.error('❌ Erro ao salvar no banco de dados:', dbError)
            }
          } else {
            console.log('⚠️ Sem token de autenticação - tentando via service role')

            // Fallback: tentar pegar o user_id de outra forma ou usar service role
            // Este é um fallback para garantir que funcione
            try {
              // Criar cliente com service role para testes
              const supabaseAdmin = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
              )

              // Para teste, vamos pegar o primeiro usuário ou você pode passar o ID
              // Em produção, isso deveria vir do frontend
              const { data: users } = await supabaseAdmin.from('employees').select('user_id, company_id').limit(1)
              const testUserId = users?.[0]?.user_id
              const testCompanyId = users?.[0]?.company_id

              if (testUserId) {
                console.log('📝 Salvando com user_id de teste:', testUserId)
                console.log('🏢 Company ID de teste:', testCompanyId)

                // Buscar o nome da fase do funil (fallback também precisa)
                let faseNomeFallback = avaliacao.fase_funil
                if (testCompanyId && avaliacao.fase_funil) {
                  const { data: faseData } = await supabaseAdmin
                    .from('funnel_stages')
                    .select('stage_name')
                    .eq('id', avaliacao.fase_funil)
                    .eq('company_id', testCompanyId)
                    .single()

                  if (faseData?.stage_name) {
                    faseNomeFallback = faseData.stage_name
                  }
                }

                const dataToInsert: any = {
                  user_id: testUserId,
                  tipo_venda: avaliacao.tipo_venda,
                  canal: avaliacao.canal,
                  fase_funil: faseNomeFallback,
                  contexto: `Tipo: ${avaliacao.tipo_venda}, Canal: ${avaliacao.canal}, Fase: ${faseNomeFallback}`, // Campo obrigatório!
                  transcricao_original: fullExtractedText,
                  transcricao_filtrada: filteredText,
                  avaliacao: n8nResult,
                  nota_final: parseFloat(n8nResult.nota_final.toString()) || 0,
                  classificacao: n8nResult.classificacao || 'indefinido'
                }

                // Adicionar company_id se encontrado
                if (testCompanyId) {
                  dataToInsert.company_id = testCompanyId
                }

                const { data: insertedData, error: insertError } = await supabaseAdmin
                  .from('followup_analyses')
                  .insert(dataToInsert)
                  .select()
                  .single()

                if (insertError) {
                  console.error('❌ Erro ao salvar (fallback):', insertError)
                } else {
                  console.log('✅ Análise salva via fallback!')
                  console.log('✅ ID:', insertedData?.id)
                }
              }
            } catch (fallbackError) {
              console.error('❌ Erro no fallback:', fallbackError)
            }
          }

          console.log('🎉 SUCESSO! Retornando resposta com análise salva')
          return NextResponse.json({
            extractedText: filteredText,
            fullText: fullExtractedText,
            analysis: n8nResult
          })
        } else {
          console.error('❌ FALHA: N8N não retornou estrutura com "notas"')
          console.log('Estrutura recebida:', JSON.stringify(n8nResult, null, 2))
        }
      } catch (n8nError) {
        console.error('❌ ERRO ao enviar para N8N:', n8nError)
        // Continuar com resposta de teste se N8N falhar
      }

      // Se N8N não retornar análise válida, retornar erro
      console.error('❌ N8N não retornou análise válida - NÃO SALVOU NO BANCO')

      return NextResponse.json(
        {
          error: 'Erro ao processar análise',
          details: 'O sistema de análise não retornou uma avaliação válida. Por favor, tente novamente.',
          suggestion: 'Verifique se o follow-up está claro na imagem e tente novamente'
        },
        { status: 500 }
      )

    } catch (openaiError: any) {
      console.error('Erro ao chamar GPT-4 Vision:', openaiError)
      console.error('Detalhes do erro:', openaiError?.response?.data || openaiError?.message || 'Erro desconhecido')

      // Retornar erro mais específico
      return NextResponse.json(
        {
          error: 'Erro na transcrição com GPT-4 Vision',
          details: openaiError?.message || 'Erro ao processar imagem',
          suggestion: 'Verifique se a imagem está em formato válido (PNG, JPG) e tente novamente'
        },
        { status: 500 }
      )
    }

    // Código de fallback para N8N comentado por enquanto
    /*
    const response = await fetch(N8N_FOLLOWUP_WEBHOOK, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        images: images,
        filenames: filenames,
        avaliacao: avaliacao,
        instruction: `# Professor de Follow-Up - Instrução Completa

CONTEXTO DA AVALIAÇÃO:
- Tipo de Venda: ${avaliacao.tipo_venda}
- Contexto: ${avaliacao.contexto}
- Canal: ${avaliacao.canal}
- Fase do Funil: ${avaliacao.fase_funil}

Use essas informações para adaptar sua análise:
- Se for B2B, foque em ROI, decisores múltiplos, ciclo longo
- Se for B2C, foque em benefícios pessoais, decisão emocional, ciclo curto
- Se for pós-proposta, espere follow-up mais direto
- Se for cold, espere abordagem mais cuidadosa
- Se for WhatsApp, tom pode ser mais informal
- Se for E-mail, espere formalidade maior

Você é um especialista em follow-up de vendas com mais de 15 anos de experiência em B2B e B2C.

IMPORTANTE: Você receberá um print de conversa do WhatsApp. Precisa:
1. Identificar qual é a mensagem de follow-up do vendedor
2. Analisar APENAS essa mensagem específica de follow-up
3. Ignorar mensagens anteriores do cliente ou outras mensagens que não sejam o follow-up sendo avaliado

Avalie seguindo estes critérios:

## CRITÉRIOS DE AVALIAÇÃO

### 1. AGREGAÇÃO DE VALOR (peso 30%)
- A mensagem contém novo material, dica, case, análise ou solução?
- 0-3: Zero valor, só cobra resposta
- 4-5: Tenta agregar mas é genérico
- 6-7: Agrega valor real mas poderia ser mais específico
- 8-10: Valor concreto, relevante e aplicável

### 2. PERSONALIZAÇÃO (peso 20%)
- Faz referência a informações específicas do lead?
- 0-3: Template genérico, só trocou nome
- 4-5: Menciona empresa mas sem profundidade
- 6-7: Cita algo da conversa anterior
- 8-10: Mostra que estudou o lead profundamente

### 3. TOM CONSULTIVO (peso 15%)
- O tom é de assistência ou pressão?
- 0-3: Desesperado, passivo-agressivo ou robótico
- 4-5: Neutro, não engaja nem incomoda
- 6-7: Adequado pro contexto
- 8-10: Consultivo, confiante, natural

### 4. OBJETIVIDADE (peso 15%)
- O texto é direto ao ponto?
- 0-3: Prolixo, enrolado, difícil de entender
- 4-5: Poderia ser mais direto
- 6-7: Razoavelmente objetivo
- 8-10: Cada frase tem propósito, texto enxuto

### 5. CTA - CALL TO ACTION (peso 20%)
- O próximo passo está claro?
- 0-3: Sem CTA ou "fico no aguardo"
- 4-5: CTA existe mas é vago
- 6-7: CTA claro mas sem prazo
- 8-10: CTA específico, fácil de responder, com prazo

## RESPOSTA OBRIGATÓRIA EM JSON

Responda SEMPRE neste formato JSON exato:

{
  "notas": {
    "valor_agregado": {
      "nota": 0,
      "peso": 30,
      "comentario": "explicação objetiva"
    },
    "personalizacao": {
      "nota": 0,
      "peso": 20,
      "comentario": "explicação objetiva"
    },
    "tom_consultivo": {
      "nota": 0,
      "peso": 15,
      "comentario": "explicação objetiva"
    },
    "objetividade": {
      "nota": 0,
      "peso": 15,
      "comentario": "explicação objetiva"
    },
    "cta": {
      "nota": 0,
      "peso": 20,
      "comentario": "explicação objetiva"
    }
  },
  "nota_final": 0,
  "classificacao": "pessimo/ruim/medio/bom/excelente",
  "pontos_positivos": ["ponto 1", "ponto 2"],
  "pontos_melhorar": [
    {
      "problema": "descrição",
      "como_resolver": "solução prática"
    }
  ],
  "versao_reescrita": "follow-up melhorado completo",
  "dica_principal": "dica mais importante"
}`
      })
    })

    if (!response.ok) {
      console.error('N8N webhook error:', response.status, response.statusText)
      throw new Error('Erro ao processar análise no N8N')
    }

    const result = await response.json()

    // N8N pode retornar em diferentes formatos
    let extractedText = ''
    let analysis = null

    // Caso 1: Resposta direta com texto e análise
    if (result.extractedText && result.analysis) {
      extractedText = result.extractedText
      analysis = result.analysis
    }
    // Caso 2: Array com output
    else if (Array.isArray(result) && result[0]?.output) {
      const output = JSON.parse(result[0].output)
      extractedText = output.extractedText || ''
      analysis = output.analysis
    }
    // Caso 3: Objeto com output
    else if (result.output) {
      const output = typeof result.output === 'string' ? JSON.parse(result.output) : result.output
      extractedText = output.extractedText || ''
      analysis = output.analysis
    }

    if (!analysis) {
      throw new Error('Análise não retornada pelo N8N')
    }

    return NextResponse.json({
      extractedText,
      analysis
    })
    */

  } catch (error) {
    console.error('Error analyzing follow-up:', error)
    return NextResponse.json(
      { error: 'Erro ao analisar follow-up' },
      { status: 500 }
    )
  }
}