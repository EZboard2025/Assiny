import { NextRequest, NextResponse } from 'next/server'
import OpenAI, { toFile } from 'openai'
import { createClient } from '@supabase/supabase-js'
import { evaluateMeetTranscript } from '@/lib/meet/evaluateMeetTranscript'
import { generateSmartNotes } from '@/lib/meet/generateSmartNotes'
import { classifyMeeting, getCompanyContext } from '@/lib/meet/classifyMeeting'

export const maxDuration = 300

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function cleanTranscript(rawText: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4.1-nano',
      messages: [
        {
          role: 'system',
          content: `Você é um revisor de transcrições de reuniões em português brasileiro.
Sua tarefa é limpar a transcrição bruta mantendo 100% do conteúdo original.

Regras:
- Corrija acentuação (reuniao → reunião, voce → você, etc.)
- Adicione pontuação natural (vírgulas, pontos, interrogações) onde faz sentido
- Corrija capitalização (início de frases, nomes próprios)
- Remova repetições de gaguejos (ex: "eu eu eu acho" → "eu acho")
- Remova filler words excessivos (hm, eh, ahn) mas mantenha se fazem parte do contexto
- NÃO resuma, NÃO omita conteúdo, NÃO reorganize
- NÃO adicione identificação de falantes
- Retorne APENAS o texto limpo, sem explicações`
        },
        { role: 'user', content: rawText }
      ],
      temperature: 0.1,
    })

    const cleaned = response.choices[0]?.message?.content?.trim()
    if (cleaned && cleaned.length > rawText.length * 0.3) return cleaned
    return rawText
  } catch {
    return rawText
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { storagePath, fileName, companyId, sellerName, userId } = body

    if (!storagePath) {
      return NextResponse.json({ error: 'storagePath é obrigatório' }, { status: 400 })
    }

    console.log(`[UploadEvaluate] Processando: ${fileName} de ${storagePath}`)

    // Step 1: Download file from Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('meet-uploads')
      .download(storagePath)

    if (downloadError || !fileData) {
      console.error('[UploadEvaluate] Erro ao baixar:', downloadError)
      return NextResponse.json({ error: 'Erro ao baixar arquivo do storage' }, { status: 500 })
    }

    const fileSizeMB = fileData.size / 1024 / 1024
    console.log(`[UploadEvaluate] Baixado: ${fileSizeMB.toFixed(1)}MB`)

    // Step 2: Convert Blob to File for Whisper
    // Whisper limit is 25MB — if file is larger, we'll still try (OpenAI may reject)
    const file = await toFile(fileData, fileName || 'audio.mp3')

    // Step 3: Transcribe with Whisper
    let whisperPrompt = ''
    if (companyId) {
      const { data: companyData } = await supabase
        .from('company_data')
        .select('nome, descricao, produtos_servicos, concorrentes')
        .eq('company_id', companyId)
        .single()

      if (companyData) {
        const termos = [
          companyData.nome,
          ...(companyData.produtos_servicos?.split('\n')
            .map((linha: string) => linha.split(':')[0].trim())
            .filter((termo: string) => termo.length > 2) || []),
          ...(companyData.concorrentes?.split(',')
            .map((c: string) => c.trim())
            .filter((c: string) => c.length > 2) || [])
        ].filter(Boolean).join(', ')
        whisperPrompt = termos
      }
    }

    console.log('[UploadEvaluate] Transcrevendo com Whisper...')
    const transcriptionOptions: any = {
      file: file,
      model: 'whisper-1',
      language: 'pt',
    }
    if (whisperPrompt) transcriptionOptions.prompt = whisperPrompt

    const whisperResult = await openai.audio.transcriptions.create(transcriptionOptions)
    const rawTranscript = whisperResult.text

    if (!rawTranscript || rawTranscript.length < 50) {
      await supabase.storage.from('meet-uploads').remove([storagePath])
      return NextResponse.json({
        error: `Transcrição muito curta (${rawTranscript?.length || 0} chars). O áudio precisa ter pelo menos uma conversa audível.`
      }, { status: 400 })
    }

    console.log(`[UploadEvaluate] Transcrição: ${rawTranscript.length} chars`)

    // Step 4: Clean transcript
    const cleanedTranscript = await cleanTranscript(rawTranscript)

    // Step 5: Classify meeting type
    const companyContext = companyId ? await getCompanyContext(companyId) : undefined
    const classification = await classifyMeeting(cleanedTranscript, companyContext)
    const isSales = classification.meeting_type === 'sales'
    console.log(`[UploadEvaluate] Classificação: ${classification.meeting_type} (${classification.category})`)

    // Step 6: Evaluate based on classification
    let evalData: any = null
    let smartNotes: any = null
    let overallScore = 0

    if (isSales) {
      const [evaluation, notesResult] = await Promise.all([
        evaluateMeetTranscript({ transcript: cleanedTranscript, meetingId: `upload-${Date.now()}`, companyId: companyId || undefined }),
        generateSmartNotes({ transcript: cleanedTranscript, companyId: companyId || undefined }).catch(() => null)
      ])
      if (!evaluation?.success || !evaluation.evaluation) {
        await supabase.storage.from('meet-uploads').remove([storagePath])
        return NextResponse.json({ error: evaluation?.error || 'Falha na avaliação SPIN' }, { status: 500 })
      }
      evalData = evaluation.evaluation
      smartNotes = notesResult?.success ? notesResult.notes : notesResult
      overallScore = evalData.overall_score
      if (overallScore <= 10) overallScore = overallScore * 10
    } else {
      console.log(`[UploadEvaluate] Non-sales — skipping SPIN, smart notes only`)
      const notesResult = await generateSmartNotes({ transcript: cleanedTranscript, companyId: companyId || undefined }).catch(() => null)
      smartNotes = notesResult?.success ? notesResult.notes : notesResult
    }

    // Step 7: Save to meet_evaluations
    const meetingId = `upload_${Date.now()}`
    const { data: saved, error: saveError } = await supabase
      .from('meet_evaluations')
      .insert({
        meeting_id: meetingId,
        user_id: userId,
        company_id: companyId,
        seller_name: isSales ? (sellerName || 'Vendedor') : (sellerName || 'N/A'),
        transcript: cleanedTranscript,
        evaluation: evalData,
        smart_notes: smartNotes,
        overall_score: overallScore,
        performance_level: isSales ? (evalData?.performance_level || 'needs_improvement') : null,
        source: 'upload',
        meeting_category: classification.meeting_type,
        meeting_category_detail: classification.category,
      })
      .select('id')
      .single()

    if (saveError) {
      console.error('[UploadEvaluate] Erro ao salvar:', saveError)
    }

    // Extract ML patterns only for sales (fire-and-forget)
    if (isSales && saved?.id && companyId) {
      try {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ramppy.site'
        fetch(`${appUrl}/api/meet/extract-patterns`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            meetEvaluationId: saved.id,
            transcript: cleanedTranscript,
            evaluation: evalData,
            companyId,
          })
        }).then(res => {
          if (res.ok) console.log(`[UploadEvaluate] ML pattern extraction started`)
          else console.error(`[UploadEvaluate] ML pattern extraction failed: ${res.status}`)
        }).catch(err => {
          console.error(`[UploadEvaluate] ML pattern extraction error:`, err.message)
        })
      } catch (mlErr: any) {
        console.error('[UploadEvaluate] ML setup error (non-fatal):', mlErr.message)
      }
    }

    // Cleanup storage
    await supabase.storage.from('meet-uploads').remove([storagePath])

    console.log(`[UploadEvaluate] Concluído: ${classification.meeting_type}/${classification.category} score: ${overallScore}/100`)

    return NextResponse.json({
      success: true,
      evaluation: evalData,
      smartNotes,
      cleanedTranscript,
      overallScore,
      evaluationId: saved?.id || null,
      meetingCategory: classification.meeting_type,
      meetingCategoryDetail: classification.category,
    })

  } catch (error: any) {
    console.error('[UploadEvaluate] Erro:', error)
    return NextResponse.json({
      error: error.message || 'Erro interno ao processar arquivo'
    }, { status: 500 })
  }
}
