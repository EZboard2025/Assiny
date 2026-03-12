import { NextRequest, NextResponse } from 'next/server'
import OpenAI, { toFile } from 'openai'
import { createClient } from '@supabase/supabase-js'
import { evaluateMeetTranscript } from '@/lib/meet/evaluateMeetTranscript'
import { generateSmartNotes } from '@/lib/meet/generateSmartNotes'
import { writeFile, unlink } from 'fs/promises'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { readFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

const execFileAsync = promisify(execFile)

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

// Whisper supported formats
const WHISPER_FORMATS = new Set(['flac', 'm4a', 'mp3', 'mp4', 'mpeg', 'mpga', 'oga', 'ogg', 'wav', 'webm'])

async function convertToMp3(fileBuffer: Buffer, originalName: string): Promise<{ buffer: Buffer; name: string }> {
  const inputPath = join(tmpdir(), `upload_${Date.now()}_${originalName}`)
  const outputPath = inputPath.replace(/\.[^.]+$/, '.mp3')

  try {
    await writeFile(inputPath, fileBuffer)
    await execFileAsync('ffmpeg', ['-i', inputPath, '-vn', '-acodec', 'libmp3lame', '-q:a', '4', '-y', outputPath])
    const mp3Buffer = await readFile(outputPath)
    return { buffer: mp3Buffer, name: originalName.replace(/\.[^.]+$/, '.mp3') }
  } finally {
    await unlink(inputPath).catch(() => {})
    await unlink(outputPath).catch(() => {})
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Accept file directly via FormData
    const formData = await request.formData()
    const file = formData.get('file') as File
    const fileName = formData.get('fileName') as string
    const companyId = formData.get('companyId') as string
    const sellerName = formData.get('sellerName') as string
    const userId = formData.get('userId') as string

    if (!file) {
      return NextResponse.json({ error: 'Arquivo é obrigatório' }, { status: 400 })
    }

    const fileSizeMB = file.size / 1024 / 1024
    console.log(`[UploadEvaluate] Processando: ${fileName} (${fileSizeMB.toFixed(1)}MB)`)

    // Step 1: Build Whisper prompt from company terms
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

    // Step 2: Convert unsupported formats (mov, avi, mkv, etc.) to mp3
    const ext = (fileName?.split('.').pop() || 'mp3').toLowerCase()
    let fileBuffer: Buffer = Buffer.from(await file.arrayBuffer())
    let actualFileName = fileName || 'audio.mp3'

    if (!WHISPER_FORMATS.has(ext)) {
      console.log(`[UploadEvaluate] Formato ${ext} não suportado pelo Whisper, convertendo para mp3...`)
      const converted = await convertToMp3(fileBuffer, actualFileName)
      fileBuffer = converted.buffer
      actualFileName = converted.name
      console.log(`[UploadEvaluate] Convertido: ${(fileBuffer.length / 1024 / 1024).toFixed(1)}MB`)
    }

    // Step 3: Transcribe with Whisper (chunked for files > 24MB)
    const CHUNK_SIZE = 24 * 1024 * 1024 // 24MB (Whisper limit is 25MB)
    let rawTranscript = ''
    const fileBlob = new Blob([new Uint8Array(fileBuffer)])

    const audioExt = actualFileName.split('.').pop() || 'mp3'

    if (fileBuffer.length <= CHUNK_SIZE) {
      // Small file — single Whisper call
      console.log('[UploadEvaluate] Transcrevendo com Whisper (arquivo único)...')
      const whisperFile = await toFile(fileBlob, actualFileName)
      const result = await openai.audio.transcriptions.create({
        file: whisperFile,
        model: 'whisper-1',
        language: 'pt',
        ...(whisperPrompt ? { prompt: whisperPrompt } : {})
      })
      rawTranscript = result.text
    } else {
      // Large file — split into 24MB chunks and transcribe sequentially
      const totalChunks = Math.ceil(fileBuffer.length / CHUNK_SIZE)
      console.log(`[UploadEvaluate] Arquivo grande (${(fileBuffer.length / 1024 / 1024).toFixed(0)}MB) — dividindo em ${totalChunks} chunks...`)
      const transcriptParts: string[] = []

      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE
        const end = Math.min(start + CHUNK_SIZE, fileBuffer.length)
        const chunk = fileBlob.slice(start, end)
        const chunkFile = await toFile(chunk, `chunk_${i}.${audioExt}`)

        console.log(`[UploadEvaluate] Transcrevendo chunk ${i + 1}/${totalChunks}...`)
        const result = await openai.audio.transcriptions.create({
          file: chunkFile,
          model: 'whisper-1',
          language: 'pt',
          ...(whisperPrompt ? { prompt: whisperPrompt } : {})
        })
        transcriptParts.push(result.text)
      }

      rawTranscript = transcriptParts.join(' ')
      console.log(`[UploadEvaluate] Todos os ${totalChunks} chunks transcritos`)
    }

    if (!rawTranscript || rawTranscript.length < 50) {
      return NextResponse.json({
        error: `Transcrição muito curta (${rawTranscript?.length || 0} chars). O áudio precisa ter pelo menos uma conversa audível.`
      }, { status: 400 })
    }

    console.log(`[UploadEvaluate] Transcrição: ${rawTranscript.length} chars`)

    // Step 3: Clean transcript
    const cleanedTranscript = await cleanTranscript(rawTranscript)

    // Step 4: Evaluate (SPIN + Smart Notes in parallel)
    const meetingId = `upload_${Date.now()}`
    const [evalResult, notesResult] = await Promise.all([
      evaluateMeetTranscript({ transcript: cleanedTranscript, meetingId, companyId: companyId || '', sellerName }),
      generateSmartNotes({ transcript: cleanedTranscript, companyId: companyId || '' }).catch(() => null)
    ])

    if (!evalResult?.success || !evalResult.evaluation) {
      return NextResponse.json({ error: evalResult?.error || 'Falha na avaliação SPIN' }, { status: 500 })
    }

    const evaluation = evalResult.evaluation
    const smartNotes = notesResult?.success ? notesResult.notes : null

    // Normalize score to 0-100
    let overallScore = evaluation.overall_score
    if (overallScore <= 10) overallScore = overallScore * 10

    // Step 5: Save to meet_evaluations
    const { data: saved, error: saveError } = await supabase
      .from('meet_evaluations')
      .insert({
        meeting_id: meetingId,
        user_id: userId,
        company_id: companyId,
        seller_name: sellerName || 'Vendedor',
        transcript: cleanedTranscript,
        evaluation: evaluation,
        smart_notes: smartNotes,
        overall_score: overallScore,
        performance_level: evaluation.performance_level,
        spin_s_score: evaluation.spin_evaluation?.S?.final_score,
        spin_p_score: evaluation.spin_evaluation?.P?.final_score,
        spin_i_score: evaluation.spin_evaluation?.I?.final_score,
        spin_n_score: evaluation.spin_evaluation?.N?.final_score,
        source: 'upload'
      })
      .select('id')
      .single()

    if (saveError) {
      console.error('[UploadEvaluate] Erro ao salvar:', saveError)
    }

    console.log(`[UploadEvaluate] Avaliação concluída: ${overallScore}/100`)

    return NextResponse.json({
      success: true,
      evaluation,
      smartNotes,
      cleanedTranscript,
      overallScore,
      evaluationId: saved?.id || null
    })

  } catch (error: any) {
    console.error('[UploadEvaluate] Erro:', error)
    return NextResponse.json({
      error: error.message || 'Erro interno ao processar arquivo'
    }, { status: 500 })
  }
}
