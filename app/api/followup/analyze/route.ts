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

    if (!images || images.length === 0) {
      return NextResponse.json(
        { error: 'Pelo menos uma imagem é obrigatória' },
        { status: 400 }
      )
    }

    if (!avaliacao || !avaliacao.contexto) {
      return NextResponse.json(
        { error: 'Contexto é obrigatório' },
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
        images.map(async (image, index) => {
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

      const filteredText = filterResponse.choices[0].message.content || fullExtractedText

      console.log('Follow-up filtrado e organizado com sucesso')

      // Retornar tanto o texto completo quanto o filtrado
      return NextResponse.json({
        extractedText: filteredText, // Agora retorna o texto FILTRADO
        fullText: fullExtractedText, // Texto completo caso precise
        analysis: {
          notas: {
            valor_agregado: { nota: 0, peso: 30, comentario: "Teste - apenas transcrição" },
            personalizacao: { nota: 0, peso: 20, comentario: "Teste - apenas transcrição" },
            tom_consultivo: { nota: 0, peso: 15, comentario: "Teste - apenas transcrição" },
            objetividade: { nota: 0, peso: 15, comentario: "Teste - apenas transcrição" },
            cta: { nota: 0, peso: 20, comentario: "Teste - apenas transcrição" }
          },
          nota_final: 0,
          classificacao: "teste",
          pontos_positivos: ["Transcrição realizada com sucesso"],
          pontos_melhorar: [],
          versao_reescrita: "TESTE: Apenas extração e filtragem",
          dica_principal: `FOLLOW-UP IDENTIFICADO E FILTRADO:\n\n${filteredText}`
        }
      })

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