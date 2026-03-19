import { NextRequest, NextResponse } from 'next/server'
import OpenAI, { toFile } from 'openai'
import { createClient } from '@supabase/supabase-js'
import { evaluateMeetTranscript } from '@/lib/meet/evaluateMeetTranscript'
import { generateSmartNotes } from '@/lib/meet/generateSmartNotes'
import { classifyMeeting, getCompanyContext } from '@/lib/meet/classifyMeeting'
import { writeFile, unlink, stat } from 'fs/promises'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { tmpdir } from 'os'
import { join } from 'path'
import { createReadStream } from 'fs'

const execFileAsync = promisify(execFile)

export const maxDuration = 300

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const VIDEO_EXTENSIONS = ['.mov', '.mp4', '.avi', '.mkv', '.webm', '.flv', '.wmv', '.m4v', '.mpeg', '.mpg']
const WHISPER_MAX_SIZE = 25 * 1024 * 1024 // 25MB

function log(step: string, msg: string) {
  console.log(`[UploadEvaluate][${step}] ${msg}`)
}

async function cleanTranscript(rawText: string): Promise<string> {
  try {
    log('Clean', 'Limpando transcrição...')
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
    if (cleaned && cleaned.length > rawText.length * 0.3) {
      log('Clean', `OK: ${rawText.length} → ${cleaned.length} chars`)
      return cleaned
    }
    log('Clean', 'Resultado muito curto, usando original')
    return rawText
  } catch (err: any) {
    log('Clean', `Erro (usando original): ${err.message}`)
    return rawText
  }
}

/**
 * Extract audio from video/large file using ffmpeg.
 * Outputs MP3 at 64kbps mono — optimized for Whisper.
 */
async function extractAudio(inputPath: string, outputPath: string): Promise<void> {
  log('FFmpeg', `Extraindo áudio: ${inputPath} → ${outputPath}`)
  try {
    const { stderr } = await execFileAsync('ffmpeg', [
      '-i', inputPath,
      '-vn',                // no video
      '-acodec', 'libmp3lame',
      '-ab', '64k',         // 64kbps — speech quality
      '-ar', '16000',       // 16kHz — Whisper optimal
      '-ac', '1',           // mono
      '-y',                 // overwrite
      outputPath
    ], { timeout: 180000 }) // 3 min timeout

    if (stderr) {
      // ffmpeg outputs info to stderr normally
      const durationMatch = stderr.match(/Duration: (\d+:\d+:\d+)/)
      if (durationMatch) log('FFmpeg', `Duração do áudio: ${durationMatch[1]}`)
    }

    const outputStat = await stat(outputPath)
    log('FFmpeg', `Áudio extraído: ${(outputStat.size / 1024 / 1024).toFixed(1)}MB`)
  } catch (err: any) {
    log('FFmpeg', `ERRO: ${err.message}`)
    if (err.stderr) log('FFmpeg', `stderr: ${err.stderr.slice(0, 500)}`)
    throw new Error(`Falha ao extrair áudio: ${err.message}`)
  }
}

export async function POST(request: NextRequest) {
  const tempFiles: string[] = []

  try {
    // ── Auth ──
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
    log('Auth', 'OK')

    // ── Parse FormData ──
    log('Parse', 'Lendo FormData...')
    let formData: FormData
    try {
      formData = await request.formData()
    } catch (err: any) {
      log('Parse', `ERRO ao ler FormData: ${err.message}`)
      return NextResponse.json({ error: `Erro ao ler arquivo: ${err.message}` }, { status: 400 })
    }

    const uploadedFile = formData.get('file') as File | null
    const fileName = (formData.get('fileName') as string) || 'audio.mp3'
    const companyId = (formData.get('companyId') as string) || ''
    const sellerName = (formData.get('sellerName') as string) || 'Vendedor'
    const userId = (formData.get('userId') as string) || ''

    if (!uploadedFile) {
      return NextResponse.json({ error: 'Arquivo é obrigatório' }, { status: 400 })
    }

    const fileSizeMB = uploadedFile.size / 1024 / 1024
    log('Parse', `Arquivo: ${fileName} (${fileSizeMB.toFixed(1)}MB, type: ${uploadedFile.type})`)

    // ── Save to temp file ──
    log('Disk', 'Salvando em disco...')
    const ext = fileName.toLowerCase().includes('.') ? '.' + fileName.split('.').pop() : '.tmp'
    const tempInput = join(tmpdir(), `meet_upload_${Date.now()}${ext}`)
    tempFiles.push(tempInput)

    const arrayBuffer = await uploadedFile.arrayBuffer()
    await writeFile(tempInput, Buffer.from(arrayBuffer))
    log('Disk', `Salvo: ${tempInput} (${fileSizeMB.toFixed(1)}MB)`)

    // ── Determine if ffmpeg conversion needed ──
    const isVideo = VIDEO_EXTENSIONS.includes(ext.toLowerCase())
    const isTooBig = uploadedFile.size > WHISPER_MAX_SIZE

    let whisperFile: any

    if (isVideo || isTooBig) {
      log('Convert', `Conversão necessária (video=${isVideo}, tooBig=${isTooBig})`)
      const tempOutput = join(tmpdir(), `meet_audio_${Date.now()}.mp3`)
      tempFiles.push(tempOutput)

      await extractAudio(tempInput, tempOutput)

      // Check converted size
      const audioStat = await stat(tempOutput)
      if (audioStat.size > WHISPER_MAX_SIZE) {
        log('Convert', `AVISO: Áudio ainda grande (${(audioStat.size / 1024 / 1024).toFixed(1)}MB), tentando enviar mesmo assim`)
      }

      whisperFile = await toFile(createReadStream(tempOutput), 'audio.mp3')
    } else {
      log('Convert', 'Não precisa conversão — enviando direto ao Whisper')
      whisperFile = await toFile(createReadStream(tempInput), fileName)
    }

    // ── Whisper prompt (company terms) ──
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
        log('Whisper', `Prompt com termos da empresa: ${termos.slice(0, 100)}...`)
      }
    }

    // ── Transcribe ──
    log('Whisper', 'Transcrevendo...')
    const transcriptionOptions: any = {
      file: whisperFile,
      model: 'whisper-1',
      language: 'pt',
    }
    if (whisperPrompt) transcriptionOptions.prompt = whisperPrompt

    let rawTranscript: string
    try {
      const whisperResult = await openai.audio.transcriptions.create(transcriptionOptions)
      rawTranscript = whisperResult.text
      log('Whisper', `Transcrição OK: ${rawTranscript.length} chars`)
    } catch (err: any) {
      log('Whisper', `ERRO: ${err.message}`)
      return NextResponse.json({ error: `Erro na transcrição: ${err.message}` }, { status: 500 })
    }

    if (!rawTranscript || rawTranscript.length < 50) {
      return NextResponse.json({
        error: `Transcrição muito curta (${rawTranscript?.length || 0} chars). O áudio precisa ter pelo menos uma conversa audível.`
      }, { status: 400 })
    }

    // ── Clean transcript ──
    const cleanedTranscript = await cleanTranscript(rawTranscript)

    // ── Classify meeting ──
    log('Classify', 'Classificando tipo de reunião...')
    const companyContext = companyId ? await getCompanyContext(companyId) : undefined
    const classification = await classifyMeeting(cleanedTranscript, companyContext)
    const isSales = classification.meeting_type === 'sales'
    log('Classify', `Tipo: ${classification.meeting_type} (${classification.category})`)

    // ── Evaluate ──
    let evalData: any = null
    let smartNotes: any = null
    let overallScore = 0

    if (isSales) {
      log('Evaluate', 'Avaliando SPIN + Smart Notes...')
      const [evaluation, notesResult] = await Promise.all([
        evaluateMeetTranscript({ transcript: cleanedTranscript, meetingId: `upload-${Date.now()}`, companyId: companyId || undefined, hasSpeakerLabels: false }),
        generateSmartNotes({ transcript: cleanedTranscript, companyId: companyId || undefined }).catch((err) => {
          log('SmartNotes', `Erro (non-fatal): ${err.message}`)
          return null
        })
      ])
      if (!evaluation?.success || !evaluation.evaluation) {
        log('Evaluate', `ERRO: ${evaluation?.error || 'Sem avaliação'}`)
        return NextResponse.json({ error: evaluation?.error || 'Falha na avaliação SPIN' }, { status: 500 })
      }
      evalData = evaluation.evaluation
      smartNotes = notesResult?.success ? notesResult.notes : notesResult
      overallScore = evalData.overall_score
      if (overallScore <= 10) overallScore = overallScore * 10
      log('Evaluate', `Score: ${overallScore}/100`)
    } else {
      log('Evaluate', 'Non-sales — apenas Smart Notes')
      const notesResult = await generateSmartNotes({ transcript: cleanedTranscript, companyId: companyId || undefined }).catch(() => null)
      smartNotes = notesResult?.success ? notesResult.notes : notesResult
    }

    // ── Save to DB ──
    log('Save', 'Salvando no banco...')
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
        spin_s_score: isSales ? (evalData?.spin_evaluation?.S?.final_score ?? null) : null,
        spin_p_score: isSales ? (evalData?.spin_evaluation?.P?.final_score ?? null) : null,
        spin_i_score: isSales ? (evalData?.spin_evaluation?.I?.final_score ?? null) : null,
        spin_n_score: isSales ? (evalData?.spin_evaluation?.N?.final_score ?? null) : null,
      })
      .select('id')
      .single()

    if (saveError) {
      log('Save', `ERRO: ${JSON.stringify(saveError)}`)
    } else {
      log('Save', `OK: id=${saved?.id}`)
    }

    // ── ML patterns (fire-and-forget) ──
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
          log('ML', res.ok ? 'Pattern extraction started' : `Failed: ${res.status}`)
        }).catch(err => {
          log('ML', `Error: ${err.message}`)
        })
      } catch {}
    }

    log('Done', `✅ Concluído: ${classification.meeting_type}/${classification.category} score: ${overallScore}/100`)

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
    log('FATAL', `Erro não tratado: ${error.message}`)
    log('FATAL', `Stack: ${error.stack?.slice(0, 500)}`)
    return NextResponse.json({
      error: error.message || 'Erro interno ao processar arquivo'
    }, { status: 500 })
  } finally {
    // Cleanup temp files
    for (const f of tempFiles) {
      try {
        await unlink(f)
        log('Cleanup', `Removido: ${f}`)
      } catch {}
    }
  }
}
