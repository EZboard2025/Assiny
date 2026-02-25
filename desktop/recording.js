// ============================================================
// Ramppy Recorder — Meeting Audio Capture
// Auth via IPC bridge (no separate login)
// System Audio + Mic → Deepgram → SPIN Evaluation
// ============================================================

// --- Config ---
// Detect dev vs prod: file:// means running via `npm start` (dev), http means packaged app
const BASE_URL = (window.location.protocol === 'file:') ? 'http://localhost:3000' : 'https://ramppy.site'
const DEEPGRAM_WS_URL = 'wss://api.deepgram.com/v1/listen'

// --- DOM ---
const $ = (id) => document.getElementById(id)

const allScreens = ['screen-waiting', 'screen-idle', 'screen-recording', 'screen-evaluating', 'screen-results', 'screen-error']

const els = {
  btnMinimize: $('btn-minimize'),
  btnClose: $('btn-close'),
  btnStart: $('btn-start'),
  recTimer: $('rec-timer'),
  transcriptList: $('transcript-list'),
  transcriptContainer: $('transcript-container'),
  statSegments: $('stat-segments'),
  statWords: $('stat-words'),
  btnStop: $('btn-stop'),
  evalDuration: $('eval-duration'),
  evalWords: $('eval-words'),
  resultScore: $('result-score'),
  resultLevel: $('result-level'),
  spinS: $('spin-s'),
  spinP: $('spin-p'),
  spinI: $('spin-i'),
  spinN: $('spin-n'),
  resultSummary: $('result-summary'),
  btnViewFull: $('btn-view-full'),
  btnNewRecording: $('btn-new-recording'),
  errorMessage: $('error-message'),
  btnRetry: $('btn-retry'),
}

// --- State ---
let accessToken = null
let userId = null
let companyId = null
let userName = null
let audioContext = null
let deepgramWs = null
let processorNode = null
let systemStream = null
let micStream = null
let segments = []
let timerInterval = null
let startTime = null
let interimElement = null
let segmentCount = 0
let wordCount = 0
let lastEvaluationId = null
let lastSmartNotes = null
let pendingAutoStart = false
let isAutoMode = false
let liveSessionId = null
let liveUpdateTimer = null
let liveUpdateDirty = false
let isRecording = false
let lastTranscriptTime = null
let silenceCheckInterval = null
const SILENCE_TIMEOUT_MS = 30 * 1000 // 30s no transcription = meeting likely ended

// ============================================================
// AUTH (received from main process via IPC bridge)
// ============================================================

function onAuthReceived(data) {
  if (!data || !data.accessToken || !data.userId) return

  const wasAuthenticated = !!accessToken
  accessToken = data.accessToken
  userId = data.userId

  // First time auth — fetch employee info and show idle screen
  if (!wasAuthenticated) {
    fetchEmployeeInfo().then(() => {
      // If auto-start was requested before auth arrived, trigger it now
      if (pendingAutoStart) {
        pendingAutoStart = false
        triggerAutoStart()
      }
    })
  }
}

async function fetchEmployeeInfo() {
  try {
    // Use the platform API to get employee info
    const res = await fetch(`${BASE_URL}/api/agent/employee-info`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    if (res.ok) {
      const data = await res.json()
      if (data) {
        companyId = data.company_id || null
        userName = data.name || 'Usuario'
        console.log('[Recorder] Employee info loaded:', userName, companyId)
      }
    } else {
      console.warn('[Recorder] Employee info fetch returned:', res.status)
    }

    // Even if employee fetch fails, we have auth — show idle
    showScreen('screen-idle')
  } catch (err) {
    console.error('[Recorder] Employee fetch failed:', err)
    showScreen('screen-idle')
  }
}

function getAuthHeaders() {
  return {
    'Content-Type': 'application/json',
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  }
}

// ============================================================
// SCREENS
// ============================================================

function showScreen(id) {
  allScreens.forEach(s => $(s).style.display = 'none')
  $(id).style.display = ''
}

function showError(message) {
  els.errorMessage.textContent = message
  showScreen('screen-error')
}

// ============================================================
// DEEPGRAM TOKEN (fetched from backend)
// ============================================================

async function fetchDeepgramKey() {
  const res = await fetch(`${BASE_URL}/api/meet/deepgram-token`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Erro ao buscar chave Deepgram' }))
    throw new Error(err.error || 'Erro ao buscar chave Deepgram')
  }

  const data = await res.json()
  return data.key
}

// ============================================================
// AUDIO CAPTURE — System audio loopback via electron-audio-loopback
// Uses getDisplayMedia with Chromium loopback flags (macOS 13+)
// ============================================================

async function startAudioCapture(deepgramKey) {
  // 1. Capture system audio via loopback (handled by main process setDisplayMediaRequestHandler)
  // Main process auto-selects primary screen + system audio loopback (macOS ScreenCaptureKit)
  console.log('[Recorder] Step 1: Capturing system audio loopback...')
  try {
    const loopbackStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true,
    })
    // Remove video tracks (we only need audio)
    loopbackStream.getVideoTracks().forEach(t => {
      t.stop()
      loopbackStream.removeTrack(t)
    })
    systemStream = loopbackStream
    console.log('[Recorder] System audio loopback captured! Tracks:', systemStream.getAudioTracks().length)
  } catch (err) {
    console.error('[Recorder] System audio loopback FAILED:', err.name, err.message)
    throw new Error('Falha ao capturar audio do sistema. Verifique as permissoes de gravacao de tela.')
  }

  // 2. Capture microphone (user's voice)
  console.log('[Recorder] Step 2: Capturing microphone...')
  try {
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
      },
    })
    console.log('[Recorder] Microphone captured! Tracks:', micStream.getAudioTracks().length)
  } catch (micErr) {
    console.warn('[Recorder] Microphone not available:', micErr.message)
    micStream = null
  }

  // 3. Create STEREO stream: left=system (participants), right=mic (you)
  // Raw PCM sent to Deepgram for proper multichannel speaker identification
  console.log('[Recorder] Step 3: Creating stereo audio (L=system, R=mic)...')
  audioContext = new AudioContext()
  if (audioContext.state === 'suspended') await audioContext.resume()

  const sysSource = audioContext.createMediaStreamSource(systemStream)

  // ChannelMerger: 2 mono inputs → 1 stereo output
  const hasMic = !!micStream
  const numChannels = hasMic ? 2 : 1
  const sampleRate = audioContext.sampleRate

  const merger = audioContext.createChannelMerger(2)

  // System audio → left channel (channel 0 = other participants)
  sysSource.connect(merger, 0, 0)

  if (micStream) {
    // Mic → right channel (channel 1 = the user)
    const micSource = audioContext.createMediaStreamSource(micStream)
    micSource.connect(merger, 0, 1)
    console.log('[Recorder] Stereo: L=system audio, R=microphone')
  } else {
    // No mic — duplicate system audio to both channels
    sysSource.connect(merger, 0, 1)
    console.log('[Recorder] Stereo: system audio only (both channels)')
  }

  // ScriptProcessor extracts raw interleaved PCM (linear16) for Deepgram
  // This avoids WebM/Opus encoding which downmixes stereo to mono
  const scriptProcessor = audioContext.createScriptProcessor(4096, numChannels, 1)
  const silentGain = audioContext.createGain()
  silentGain.gain.value = 0

  merger.connect(scriptProcessor)
  scriptProcessor.connect(silentGain)
  silentGain.connect(audioContext.destination) // Must connect to destination for onaudioprocess to fire

  console.log('[Recorder] PCM processor ready. Channels:', numChannels, 'Sample rate:', sampleRate)

  // 4. Connect to Deepgram via WebSocket (raw PCM, multichannel)
  console.log('[Recorder] Step 4: Connecting to Deepgram...')
  const deepgramParams = new URLSearchParams({
    model: 'nova-3',
    language: 'pt-BR',
    encoding: 'linear16',
    sample_rate: sampleRate.toString(),
    channels: numChannels.toString(),
    smart_format: 'true',
    punctuate: 'true',
    interim_results: 'true',
    utterance_end_ms: '1000',
    vad_events: 'true',
    ...(hasMic ? { multichannel: 'true' } : { diarize: 'true' }),
  })

  deepgramWs = new WebSocket(`${DEEPGRAM_WS_URL}?${deepgramParams}`, ['token', deepgramKey])

  let chunkCount = 0
  let diagCount = 0
  const DIAG_EVERY = Math.floor(10 * sampleRate / 4096) // Log audio levels every ~10s

  deepgramWs.onopen = () => {
    console.log(`[Recorder] Deepgram connected! Streaming raw PCM: linear16, ${sampleRate}Hz, ${numChannels}ch${hasMic ? ', multichannel' : ', diarize'}`)

    // Wire ScriptProcessor output to Deepgram WebSocket
    scriptProcessor.onaudioprocess = (event) => {
      if (!deepgramWs || deepgramWs.readyState !== WebSocket.OPEN) return

      const inputBuffer = event.inputBuffer
      const numSamples = inputBuffer.length
      const numCh = inputBuffer.numberOfChannels
      const pcm = new Int16Array(numSamples * numCh)

      for (let i = 0; i < numSamples; i++) {
        for (let ch = 0; ch < numCh; ch++) {
          const s = Math.max(-1, Math.min(1, inputBuffer.getChannelData(ch)[i]))
          pcm[i * numCh + ch] = s < 0 ? s * 0x8000 : s * 0x7FFF
        }
      }

      deepgramWs.send(pcm.buffer)
      chunkCount++
      if (chunkCount <= 3 || chunkCount % 500 === 0) {
        console.log(`[Recorder] Audio chunk #${chunkCount}, size: ${pcm.buffer.byteLength} bytes`)
      }

      // Diagnostic: log audio levels per channel every ~10s
      diagCount++
      if (diagCount % DIAG_EVERY === 0) {
        const levels = []
        for (let ch = 0; ch < numCh; ch++) {
          const data = inputBuffer.getChannelData(ch)
          let sum = 0
          for (let i = 0; i < data.length; i++) sum += data[i] * data[i]
          levels.push(Math.sqrt(sum / data.length).toFixed(4))
        }
        console.log(`[Recorder] Audio levels — ${numCh > 1 ? `System(L): ${levels[0]}, Mic(R): ${levels[1]}` : `Mono: ${levels[0]}`}`)
      }
    }

    processorNode = scriptProcessor
  }

  deepgramWs.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      if (data.type === 'Results') {
        handleDeepgramResult(data)
      }
    } catch (err) {
      console.error('[Recorder] Parse error:', err)
    }
  }

  deepgramWs.onerror = (err) => {
    console.error('[Recorder] Deepgram error:', err)
  }

  deepgramWs.onclose = (event) => {
    console.log('[Recorder] Deepgram disconnected. Code:', event.code, 'Reason:', event.reason || '(none)')
    // Unexpected close during auto-recording (e.g. no audio timeout) = meeting ended
    if (isRecording && isAutoMode && event.code !== 1000) {
      console.log('[Recorder] Deepgram unexpected close during auto-recording — stopping')
      triggerAutoStop()
    }
  }

  console.log('[Recorder] Audio capture started successfully!')
}

function handleDeepgramResult(data) {
  const alt = data.channel?.alternatives?.[0]
  if (!alt?.transcript) return

  // Track last speech time for silence detection
  lastTranscriptTime = Date.now()

  // Multichannel: channel 0 = system audio (participants), channel 1 = mic (you)
  // Fallback to diarization speaker number if not multichannel
  let speaker
  const channelIndex = data.channel_index?.[0]
  if (channelIndex !== undefined) {
    speaker = channelIndex === 0 ? 'Participante' : (userName || 'Voce')
  } else {
    const speakerNum = alt.words?.[0]?.speaker ?? 0
    speaker = `Speaker ${speakerNum}`
  }

  const segment = {
    speaker,
    text: alt.transcript,
    timestamp: data.start || 0,
    is_final: data.is_final,
    channel: channelIndex ?? null,
  }

  if (data.is_final) {
    segments.push(segment)
    markLiveDirty()
  }

  addSegmentToUI(segment, data.is_final)
}

function stopAudioCapture() {
  if (processorNode) {
    try {
      processorNode.onaudioprocess = null
      processorNode.disconnect()
    } catch (_) {}
    processorNode = null
  }

  if (deepgramWs) {
    if (deepgramWs.readyState === WebSocket.OPEN) deepgramWs.close()
    deepgramWs = null
  }

  if (audioContext) {
    audioContext.close()
    audioContext = null
  }

  systemStream?.getTracks().forEach(t => t.stop())
  micStream?.getTracks().forEach(t => t.stop())
  systemStream = null
  micStream = null
}

// ============================================================
// SILENCE DETECTION (auto-stop when meeting ends)
// ============================================================

function startSilenceChecker() {
  lastTranscriptTime = Date.now()
  if (silenceCheckInterval) clearInterval(silenceCheckInterval)
  silenceCheckInterval = setInterval(() => {
    if (!isRecording || !lastTranscriptTime) return
    const silenceMs = Date.now() - lastTranscriptTime
    if (silenceMs > SILENCE_TIMEOUT_MS) {
      console.log(`[Recorder] ${Math.round(silenceMs / 1000)}s of silence — meeting likely ended`)
      stopSilenceChecker()
      if (isAutoMode) {
        triggerAutoStop()
      }
    }
  }, 30_000) // Check every 30s
}

function stopSilenceChecker() {
  if (silenceCheckInterval) {
    clearInterval(silenceCheckInterval)
    silenceCheckInterval = null
  }
  lastTranscriptTime = null
}

// ============================================================
// UI: TRANSCRIPT
// ============================================================

function addSegmentToUI(segment, isFinal) {
  const placeholder = els.transcriptList.querySelector('.transcript-placeholder')
  if (placeholder) placeholder.remove()

  if (isFinal) {
    if (interimElement) {
      interimElement.remove()
      interimElement = null
    }

    const div = document.createElement('div')
    div.className = 'transcript-segment'
    const spNum = parseInt(segment.speaker.replace('Speaker ', '')) || 0
    div.innerHTML = `
      <div class="segment-speaker ${spNum > 0 ? 'speaker-1' : ''}">${escapeHtml(segment.speaker)}</div>
      <div class="segment-text">${escapeHtml(segment.text)}</div>
    `
    els.transcriptList.appendChild(div)

    segmentCount++
    wordCount += segment.text.split(/\s+/).length
    els.statSegments.textContent = segmentCount
    els.statWords.textContent = wordCount
  } else {
    if (!interimElement) {
      interimElement = document.createElement('div')
      interimElement.className = 'transcript-segment'
      els.transcriptList.appendChild(interimElement)
    }
    const spNum = parseInt(segment.speaker.replace('Speaker ', '')) || 0
    interimElement.innerHTML = `
      <div class="segment-speaker ${spNum > 0 ? 'speaker-1' : ''}">${escapeHtml(segment.speaker)}</div>
      <div class="segment-text interim">${escapeHtml(segment.text)}</div>
    `
  }

  els.transcriptContainer.scrollTop = els.transcriptContainer.scrollHeight
}

// ============================================================
// UI: TIMER
// ============================================================

function startTimer() {
  startTime = Date.now()
  if (timerInterval) clearInterval(timerInterval)

  const update = () => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000)
    const min = String(Math.floor(elapsed / 60)).padStart(2, '0')
    const sec = String(elapsed % 60).padStart(2, '0')
    els.recTimer.textContent = `${min}:${sec}`
  }

  update()
  timerInterval = setInterval(update, 1000)
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }
}

// ============================================================
// LIVE SESSION (push transcript to server in real-time)
// ============================================================

async function startLiveSession() {
  try {
    const res = await fetch(`${BASE_URL}/api/meet/live-session`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        action: 'start',
        companyId,
        sellerName: userName,
      }),
    })
    if (res.ok) {
      const data = await res.json()
      liveSessionId = data.sessionId
      console.log('[Recorder] Live session started:', liveSessionId)
      // Start periodic updates every 3 seconds
      liveUpdateDirty = false
      liveUpdateTimer = setInterval(flushLiveUpdate, 3000)
    }
  } catch (err) {
    console.error('[Recorder] Failed to start live session:', err)
  }
}

function markLiveDirty() {
  liveUpdateDirty = true
}

async function flushLiveUpdate() {
  if (!liveSessionId || !liveUpdateDirty) return
  liveUpdateDirty = false

  try {
    await fetch(`${BASE_URL}/api/meet/live-session`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        action: 'update',
        sessionId: liveSessionId,
        transcript: segments,
        segmentCount,
        wordCount,
      }),
    })
  } catch (err) {
    console.error('[Recorder] Live update failed:', err)
  }
}

async function stopLiveSession(status = 'evaluating') {
  if (liveUpdateTimer) {
    clearInterval(liveUpdateTimer)
    liveUpdateTimer = null
  }

  // Final flush
  if (liveSessionId) {
    try {
      // Send final transcript update
      await fetch(`${BASE_URL}/api/meet/live-session`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          action: 'update',
          sessionId: liveSessionId,
          transcript: segments,
          segmentCount,
          wordCount,
        }),
      })
      // Update status
      await fetch(`${BASE_URL}/api/meet/live-session`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          action: 'stop',
          sessionId: liveSessionId,
          status,
        }),
      })
      console.log('[Recorder] Live session stopped:', status)
    } catch (err) {
      console.error('[Recorder] Failed to stop live session:', err)
    }
  }
}

async function cleanupLiveSession() {
  if (!liveSessionId) return
  try {
    await fetch(`${BASE_URL}/api/meet/live-session`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ action: 'cleanup' }),
    })
  } catch (_) {}
  liveSessionId = null
}

// ============================================================
// EVALUATION + SAVE
// ============================================================

async function evaluateAndSave() {
  const transcriptText = segments
    .map(s => `${s.speaker}: ${s.text}`)
    .join('\n')

  if (transcriptText.length < 100) {
    throw new Error('Transcricao muito curta para avaliar (minimo 100 caracteres)')
  }

  const meetingId = `desktop_${Date.now()}`

  // 1. Call evaluate API
  const evalRes = await fetch(`${BASE_URL}/api/meet/evaluate`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      transcript: transcriptText,
      meetingId,
      companyId,
      sellerName: userName,
    }),
  })

  if (!evalRes.ok) {
    const err = await evalRes.json().catch(() => ({ error: 'Erro na avaliacao' }))
    throw new Error(err.error || 'Erro na avaliacao')
  }

  const evalData = await evalRes.json()
  lastSmartNotes = evalData.smartNotes || null

  // 2. Save to database
  try {
    const saveRes = await fetch(`${BASE_URL}/api/meet/save-desktop-recording`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        transcript: segments,
        evaluation: evalData.evaluation,
        smartNotes: lastSmartNotes,
        meetingId,
        companyId,
        sellerName: userName,
      }),
    })

    if (saveRes.ok) {
      const saveData = await saveRes.json()
      lastEvaluationId = saveData.evaluationId
      console.log('[Recorder] Saved to DB:', lastEvaluationId)
    } else {
      console.error('[Recorder] Save failed:', await saveRes.text())
    }
  } catch (err) {
    console.error('[Recorder] Save error:', err)
    // Non-fatal — show results even if save fails
  }

  return evalData.evaluation
}

// ============================================================
// RESULTS
// ============================================================

function showResults(evaluation) {
  showScreen('screen-results')

  const score = evaluation.overall_score ?? 0
  els.resultScore.textContent = score.toFixed(1)

  if (score >= 7) els.resultScore.style.color = '#10b981'
  else if (score >= 5) els.resultScore.style.color = '#f59e0b'
  else els.resultScore.style.color = '#ef4444'

  const levelMap = {
    legendary: 'Lendario',
    excellent: 'Excelente',
    very_good: 'Muito Bom',
    good: 'Bom',
    needs_improvement: 'Precisa Melhorar',
    poor: 'Fraco',
  }
  els.resultLevel.textContent = levelMap[evaluation.performance_level] || evaluation.performance_level || ''

  const spin = evaluation.spin_evaluation
  if (spin) {
    els.spinS.textContent = spin.S?.final_score !== undefined ? spin.S.final_score.toFixed(1) : '-'
    els.spinP.textContent = spin.P?.final_score !== undefined ? spin.P.final_score.toFixed(1) : '-'
    els.spinI.textContent = spin.I?.final_score !== undefined ? spin.I.final_score.toFixed(1) : '-'
    els.spinN.textContent = spin.N?.final_score !== undefined ? spin.N.final_score.toFixed(1) : '-'
  }

  els.resultSummary.textContent = evaluation.executive_summary || ''

  // Show saved badge if saved
  if (lastEvaluationId) {
    const badge = document.createElement('div')
    badge.className = 'saved-badge'
    badge.innerHTML = '&#10003; Salvo no historico'
    els.resultLevel.parentElement.appendChild(badge)
  }
}

// ============================================================
// EVENT HANDLERS
// ============================================================

// Titlebar buttons
els.btnMinimize.addEventListener('click', () => {
  const win = require ? null : null // Can't minimize from renderer directly
  // Use a simple approach: just blur
  window.blur()
})

els.btnClose.addEventListener('click', () => {
  stopAudioCapture()
  stopTimer()
  window.close()
})

// Start Recording
els.btnStart.addEventListener('click', async () => {
  els.btnStart.disabled = true
  els.btnStart.querySelector('.btn-text').style.display = 'none'
  els.btnStart.querySelector('.btn-loading').style.display = ''

  try {
    // Reset state
    segments = []
    segmentCount = 0
    wordCount = 0
    interimElement = null
    lastEvaluationId = null
    lastSmartNotes = null

    // Fetch Deepgram key from backend
    const deepgramKey = await fetchDeepgramKey()

    // Start audio capture
    await startAudioCapture(deepgramKey)
    isRecording = true

    // Switch to recording screen
    els.transcriptList.innerHTML = '<p class="transcript-placeholder">Aguardando transcricao...</p>'
    els.statSegments.textContent = '0'
    els.statWords.textContent = '0'
    showScreen('screen-recording')
    startTimer()
    startSilenceChecker()

    // Start live session for real-time viewing on web
    startLiveSession()
  } catch (err) {
    console.error('[Recorder] Start error:', err)
    showError(err.message)
  } finally {
    els.btnStart.disabled = false
    els.btnStart.querySelector('.btn-text').style.display = ''
    els.btnStart.querySelector('.btn-loading').style.display = 'none'
  }
})

// Stop Recording
els.btnStop.addEventListener('click', async () => {
  els.btnStop.disabled = true
  els.btnStop.querySelector('.btn-text').style.display = 'none'
  els.btnStop.querySelector('.btn-loading').style.display = ''

  isRecording = false
  stopSilenceChecker()
  stopTimer()
  stopAudioCapture()
  await stopLiveSession('evaluating')

  // Show evaluating
  els.evalDuration.textContent = els.recTimer.textContent || ''
  els.evalWords.textContent = `${wordCount} palavras`
  showScreen('screen-evaluating')

  try {
    const evaluation = await evaluateAndSave()
    await stopLiveSession('completed')
    cleanupLiveSession()
    showResults(evaluation)
  } catch (err) {
    console.error('[Recorder] Evaluation error:', err)
    await stopLiveSession('error')
    cleanupLiveSession()
    showError(err.message)
  } finally {
    els.btnStop.disabled = false
    els.btnStop.querySelector('.btn-text').style.display = ''
    els.btnStop.querySelector('.btn-loading').style.display = 'none'
  }
})

// View Full Analysis (opens in system browser)
els.btnViewFull.addEventListener('click', () => {
  // Open the meet analysis page in the user's default browser
  const url = `${BASE_URL}/meet-analysis`
  window.open(url, '_blank')
})

// New Recording
els.btnNewRecording.addEventListener('click', () => {
  // Clean up saved badge if exists
  const badge = document.querySelector('.saved-badge')
  if (badge) badge.remove()

  showScreen('screen-idle')
})

// Retry
els.btnRetry.addEventListener('click', () => {
  if (accessToken) {
    showScreen('screen-idle')
  } else {
    showScreen('screen-waiting')
  }
})

// ============================================================
// AUTO-START / AUTO-STOP (Meet auto-detection)
// ============================================================

async function triggerAutoStart() {
  if (!accessToken) {
    pendingAutoStart = true
    return
  }

  isAutoMode = true
  console.log('[Recorder] Auto-starting recording (Meet detected)')

  try {
    if (!companyId) await fetchEmployeeInfo()

    // Reset state
    segments = []
    segmentCount = 0
    wordCount = 0
    interimElement = null
    lastEvaluationId = null
    lastSmartNotes = null

    const deepgramKey = await fetchDeepgramKey()
    await startAudioCapture(deepgramKey)
    isRecording = true
    console.log('[Recorder] Audio capture started successfully!')

    els.transcriptList.innerHTML = '<p class="transcript-placeholder">Aguardando transcricao...</p>'
    els.statSegments.textContent = '0'
    els.statWords.textContent = '0'
    showScreen('screen-recording')
    startTimer()
    startSilenceChecker()

    // Start live session for real-time viewing on web
    startLiveSession()
  } catch (err) {
    console.error('[Recorder] Auto-start error:', err)
    isAutoMode = false
    isRecording = false
    showError(err.message)
  }
}

async function triggerAutoStop() {
  if (!isRecording) return // Guard against double-trigger
  isRecording = false
  console.log('[Recorder] Auto-stopping recording (Meet closed)')

  stopSilenceChecker()
  stopTimer()
  stopAudioCapture()
  await stopLiveSession('evaluating')

  els.evalDuration.textContent = els.recTimer.textContent || ''
  els.evalWords.textContent = `${wordCount} palavras`
  showScreen('screen-evaluating')

  try {
    const evaluation = await evaluateAndSave()
    await stopLiveSession('completed')
    cleanupLiveSession()
    showResults(evaluation)

    // Notify main process that recording is done
    if (window.electronAPI.notifyRecordingFinished) {
      window.electronAPI.notifyRecordingFinished()
    }

    // In auto mode, close window after showing results briefly
    if (isAutoMode) {
      isAutoMode = false
      setTimeout(() => {
        window.close()
      }, 5000) // Show results for 5 seconds then close
    }
  } catch (err) {
    console.error('[Recorder] Auto-stop evaluation error:', err)
    isAutoMode = false
    await stopLiveSession('error')
    cleanupLiveSession()

    // Notify main process even on error
    if (window.electronAPI.notifyRecordingFinished) {
      window.electronAPI.notifyRecordingFinished()
    }

    showError(err.message)
  }
}

// Listen for auto-start signal from main process
if (window.electronAPI.onAutoStart) {
  window.electronAPI.onAutoStart(() => {
    if (accessToken) {
      triggerAutoStart()
    } else {
      pendingAutoStart = true
    }
  })
}

// Listen for auto-stop signal from main process
if (window.electronAPI.onAutoStop) {
  window.electronAPI.onAutoStop(() => {
    triggerAutoStop()
  })
}

// ============================================================
// UTILS
// ============================================================

function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

// ============================================================
// INIT
// ============================================================

// Listen for auth token from main process
window.electronAPI.onAuthToken(onAuthReceived)

// Start on waiting screen
showScreen('screen-waiting')
