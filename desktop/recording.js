// ============================================================
// Ramppy Recorder — Meeting Audio Capture
// Auth via IPC bridge (no separate login)
// System Audio + Mic → OpenAI gpt-4o-transcribe → SPIN Evaluation
// ============================================================

// --- Config ---
// Detect dev vs prod: file:// means running via `npm start` (dev), http means packaged app
const BASE_URL = (window.location.protocol === 'file:') ? 'http://localhost:3000' : 'https://ramppy.site'
const OPENAI_REALTIME_URL = 'wss://api.openai.com/v1/realtime?intent=transcription'

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
let realtimeWs = null
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
let selectedMeetingType = null // 'sales' | 'non_sales' — set by user before recording
let pendingMeetingType = null // stored when auto-start arrives before auth
let usingBlackHole = false // Track if BlackHole path is active (for cleanup)

// --- Meeting-end detection (multi-signal approach) ---
let lastTranscriptTime = null
let lastMeaningfulTranscriptTime = null
let systemEnergyReadings = []
let systemAudioSilentSince = null
let meetingEndCheckInterval = null
const SYSTEM_AUDIO_SILENT_THRESHOLD = 0.003 // RMS below this = no meeting audio on system channel
const SYSTEM_AUDIO_SILENT_TIMEOUT = 12_000  // 12s of quiet system audio → likely left meeting
const NO_MEANINGFUL_TRANSCRIPT_TIMEOUT = 30_000 // 30s no meaningful transcript (user confirms)
const ABSOLUTE_SILENCE_TIMEOUT = 45_000 // 45s no transcript at all (user confirms)
const MEANINGFUL_WORD_MIN = 3 // Minimum words to count as meaningful speech
const ENERGY_WINDOW_SIZE = 30 // ~30 buffers ≈ 5s at 8192/48kHz

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
        triggerAutoStart(pendingMeetingType)
        pendingMeetingType = null
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
// OPENAI REALTIME TOKEN (fetched from backend)
// ============================================================

async function fetchOpenAIKey() {
  const res = await fetch(`${BASE_URL}/api/meet/openai-realtime-token`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Erro ao buscar chave OpenAI' }))
    throw new Error(err.error || 'Erro ao buscar chave OpenAI')
  }

  const data = await res.json()
  return data.key
}

// ============================================================
// AUDIO CAPTURE — Dual path:
// 1. BlackHole (seamless, no picker) — if driver is installed
// 2. ScreenCaptureKit fallback (shows picker) — if no BlackHole
// ============================================================

async function startAudioCapture(openaiKey) {
  usingBlackHole = false

  // Check if BlackHole is available for seamless capture
  let blackHoleOk = false
  if (window.electronAPI?.checkBlackHole) {
    try {
      const hasBlackHole = await window.electronAPI.checkBlackHole()
      if (hasBlackHole) {
        blackHoleOk = await startAudioCaptureViaBlackHole()
      }
    } catch (err) {
      console.warn('[Recorder] BlackHole check failed:', err.message)
    }
  }

  // Fallback to ScreenCaptureKit if BlackHole not available or failed
  if (!blackHoleOk) {
    await startAudioCaptureViaScreenCapture()
  }

  // If no system audio AND no mic, we can't record anything
  if (!systemStream && !micStream) {
    throw new Error('Nenhuma fonte de audio disponivel. Verifique permissoes de microfone e gravacao de tela.')
  }

  // Build the audio pipeline and connect to OpenAI Realtime
  const numChannels = await buildAudioPipeline()
  await connectToOpenAI(openaiKey, numChannels)

  console.log('[Recorder] Audio capture started successfully!')
}

// --- Path 1: BlackHole (seamless, no picker) ---
async function startAudioCaptureViaBlackHole() {
  console.log('[Recorder] Attempting BlackHole audio capture (no screen picker)...')

  // 1. Set up Multi-Output device (speakers + BlackHole)
  const routingResult = await window.electronAPI.setupAudioRouting()
  if (!routingResult.success) {
    console.warn('[Recorder] Multi-Output setup failed:', routingResult.error, '— falling back to ScreenCaptureKit')
    return false
  }

  // 2. Wait for CoreAudio to register the new device
  await new Promise(r => setTimeout(r, 500))

  // 3. Find BlackHole in available audio input devices
  const devices = await navigator.mediaDevices.enumerateDevices()
  const blackholeDevice = devices.find(d =>
    d.kind === 'audioinput' && d.label.toLowerCase().includes('blackhole')
  )

  if (!blackholeDevice) {
    console.warn('[Recorder] BlackHole not found in enumerateDevices — falling back')
    await window.electronAPI.teardownAudioRouting()
    return false
  }

  console.log('[Recorder] BlackHole device found:', blackholeDevice.label, blackholeDevice.deviceId)

  // 4. Capture system audio via BlackHole (no picker!)
  try {
    systemStream = await navigator.mediaDevices.getUserMedia({
      audio: { deviceId: { exact: blackholeDevice.deviceId } }
    })
    console.log('[Recorder] System audio via BlackHole captured!')
  } catch (err) {
    console.error('[Recorder] BlackHole getUserMedia failed:', err.message)
    await window.electronAPI.teardownAudioRouting()
    return false
  }

  // 5. Capture microphone separately
  // With BlackHole, system audio is on a separate channel — disable echo cancellation
  // and noise suppression to avoid WebRTC stripping words from the mic signal
  console.log('[Recorder] Capturing microphone (raw, no echo cancellation)...')
  try {
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: true,
      }
    })
    console.log('[Recorder] Microphone captured! Tracks:', micStream.getAudioTracks().length)
  } catch (micErr) {
    console.warn('[Recorder] Microphone not available:', micErr.message)
    micStream = null
  }

  usingBlackHole = true
  return true
}

// --- Path 2: ScreenCaptureKit fallback (shows picker) ---
async function startAudioCaptureViaScreenCapture() {
  console.log('[Recorder] Using ScreenCaptureKit audio capture (may show picker)...')

  let loopbackOk = false
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const loopbackStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      })
      // IMPORTANT: Do NOT stop video tracks — on macOS ScreenCaptureKit, stopping video
      // kills the entire capture session (including audio). Just ignore video tracks.
      systemStream = loopbackStream
      const audioTracks = systemStream.getAudioTracks()
      const videoTracks = systemStream.getVideoTracks()
      console.log(`[Recorder] Attempt ${attempt}: Audio tracks: ${audioTracks.length}, Video tracks: ${videoTracks.length}`)

      if (audioTracks.length > 0) {
        const t = audioTracks[0]
        console.log(`[Recorder] Audio track: label="${t.label}", enabled=${t.enabled}, muted=${t.muted}, readyState=${t.readyState}`)
        console.log(`[Recorder] Audio track settings:`, JSON.stringify(t.getSettings()))

        if (t.readyState === 'live') {
          loopbackOk = true
          break
        } else {
          console.warn(`[Recorder] Audio track readyState="${t.readyState}" — track is dead. ${attempt < 2 ? 'Retrying...' : 'Proceeding with mic-only.'}`)
          loopbackStream.getTracks().forEach(tr => tr.stop())
          systemStream = null
          if (attempt < 2) {
            await new Promise(r => setTimeout(r, 1000))
          }
        }
      }
    } catch (err) {
      console.error(`[Recorder] Loopback attempt ${attempt} FAILED:`, err.name, err.message)
      if (attempt < 2) {
        await new Promise(r => setTimeout(r, 1000))
      }
    }
  }

  if (!loopbackOk) {
    console.warn('[Recorder] System audio loopback unavailable — will use mic-only mode')
  }

  // Capture microphone
  console.log('[Recorder] Capturing microphone...')
  try {
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true }
    })
    console.log('[Recorder] Microphone captured! Tracks:', micStream.getAudioTracks().length)
  } catch (micErr) {
    console.warn('[Recorder] Microphone not available:', micErr.message)
    micStream = null
  }
}

// --- Shared: Build audio pipeline (ScriptProcessor for PCM) ---
async function buildAudioPipeline() {
  console.log('[Recorder] Creating audio pipeline...')
  // Force 24kHz — OpenAI Realtime API requires 24000Hz PCM16 mono
  audioContext = new AudioContext({ sampleRate: 24000 })
  if (audioContext.state === 'suspended') await audioContext.resume()

  const hasSys = !!systemStream && systemStream.getAudioTracks().some(t => t.readyState === 'live')
  const hasMic = !!micStream

  // Always use MONO — mix all sources into a single channel for best transcription quality.
  // Multichannel/stereo caused speaker confusion and degraded audio per-channel.
  const numChannels = 1

  if (hasSys && hasMic) {
    // Mix system audio + mic into one mono stream for transcription
    const sysAudioOnly = new MediaStream(systemStream.getAudioTracks())
    const sysSource = audioContext.createMediaStreamSource(sysAudioOnly)
    const micSource = audioContext.createMediaStreamSource(micStream)
    const merger = audioContext.createChannelMerger(2)
    sysSource.connect(merger, 0, 0)
    micSource.connect(merger, 0, 1)
    // Merge stereo to mono via a single-channel processor
    console.log(`[Recorder] Mono mix: system audio${usingBlackHole ? ' (BlackHole)' : ' (ScreenCaptureKit)'} + microphone → single channel`)

    const scriptProcessor = audioContext.createScriptProcessor(8192, 2, 1)
    const silentGain = audioContext.createGain()
    silentGain.gain.value = 0
    merger.connect(scriptProcessor)
    scriptProcessor.connect(silentGain)
    silentGain.connect(audioContext.destination)
    processorNode = scriptProcessor
  } else if (hasMic) {
    const micSource = audioContext.createMediaStreamSource(micStream)
    console.log('[Recorder] Mic-only mode (system audio unavailable)')

    const scriptProcessor = audioContext.createScriptProcessor(8192, 1, 1)
    const silentGain = audioContext.createGain()
    silentGain.gain.value = 0
    micSource.connect(scriptProcessor)
    scriptProcessor.connect(silentGain)
    silentGain.connect(audioContext.destination)
    processorNode = scriptProcessor
  } else {
    const sysAudioOnly = new MediaStream(systemStream.getAudioTracks())
    const sysSource = audioContext.createMediaStreamSource(sysAudioOnly)
    console.log('[Recorder] System audio only (no microphone)')

    const scriptProcessor = audioContext.createScriptProcessor(8192, 1, 1)
    const silentGain = audioContext.createGain()
    silentGain.gain.value = 0
    sysSource.connect(scriptProcessor)
    scriptProcessor.connect(silentGain)
    silentGain.connect(audioContext.destination)
    processorNode = scriptProcessor
  }

  const sampleRate = audioContext.sampleRate
  console.log('[Recorder] PCM processor ready. Channels:', numChannels, 'Sample rate:', sampleRate)
  return numChannels
}

// --- Shared: Connect to OpenAI Realtime API and wire audio ---
function connectToOpenAI(openaiKey, numChannels) {
  console.log('[Recorder] Connecting to OpenAI Realtime (gpt-4o-transcribe)...')
  const sampleRate = audioContext.sampleRate

  // Connect with subprotocol auth (browser WebSocket can't set custom headers)
  realtimeWs = new WebSocket(OPENAI_REALTIME_URL, [
    'realtime',
    `openai-insecure-api-key.${openaiKey}`,
    'openai-beta.realtime-v1'
  ])

  let chunkCount = 0
  let diagCount = 0
  let sessionConfigured = false
  const DIAG_EVERY = Math.floor(10 * sampleRate / 8192) // Log audio levels every ~10s

  realtimeWs.onopen = () => {
    console.log(`[Recorder] OpenAI Realtime connected! Configuring transcription session...`)

    // Configure transcription-only session
    const sessionConfig = {
      type: 'transcription_session.update',
      session: {
        input_audio_format: 'pcm16',
        input_audio_transcription: {
          model: 'gpt-4o-transcribe',
          language: 'pt',
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.4,           // Slightly more sensitive for meeting audio
          prefix_padding_ms: 500,   // Keep 500ms before detected speech
          silence_duration_ms: 600, // 600ms silence = end of turn (natural PT-BR pauses)
        },
        input_audio_noise_reduction: {
          type: 'near_field',
        },
      }
    }
    realtimeWs.send(JSON.stringify(sessionConfig))
    console.log('[Recorder] Transcription session config sent')
  }

  realtimeWs.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      const msgType = data.type || ''

      if (msgType === 'transcription_session.created' || msgType === 'transcription_session.updated') {
        sessionConfigured = true
        console.log(`[Recorder] OpenAI session ready! Streaming mono PCM16 at ${sampleRate}Hz${usingBlackHole ? ' (BlackHole)' : ''}`)
        wireAudioProcessor()
      }
      else if (msgType === 'conversation.item.input_audio_transcription.delta') {
        // Real-time incremental transcription
        const delta = data.delta || ''
        if (delta) {
          handleTranscriptionDelta(delta)
        }
      }
      else if (msgType === 'conversation.item.input_audio_transcription.completed') {
        // Final transcription for a turn
        const transcript = data.transcript || ''
        if (transcript) {
          handleTranscriptionCompleted(transcript)
        }
      }
      else if (msgType === 'input_audio_buffer.speech_started') {
        // VAD detected speech start
        lastTranscriptTime = Date.now()
      }
      else if (msgType === 'error') {
        console.error('[Recorder] OpenAI Realtime error:', JSON.stringify(data.error || data))
      }
      else if (msgType !== 'input_audio_buffer.speech_stopped' &&
               msgType !== 'input_audio_buffer.committed' &&
               msgType !== 'input_audio_buffer.cleared') {
        // Log other events for debugging (skip noisy ones)
        if (chunkCount < 5) {
          console.log(`[Recorder] OpenAI event: ${msgType}`)
        }
      }
    } catch (err) {
      console.error('[Recorder] Parse error:', err)
    }
  }

  realtimeWs.onerror = (err) => {
    console.error('[Recorder] OpenAI Realtime error:', err)
  }

  realtimeWs.onclose = (event) => {
    console.log('[Recorder] OpenAI Realtime disconnected. Code:', event.code, 'Reason:', event.reason || '(none)')
    if (isRecording && isAutoMode && event.code !== 1000) {
      console.log('[Recorder] OpenAI unexpected close during auto-recording — stopping')
      triggerAutoStop()
    }
  }

  // --- Wire audio processor (called after session is configured) ---
  function wireAudioProcessor() {
    // Adaptive mix: detect which channels are active in the first ~2s
    let ch0Active = true  // system audio (BlackHole)
    let ch1Active = true  // microphone
    let calibrationDone = false
    let calibrationSamples = 0
    let ch0Energy = 0
    let ch1Energy = 0
    const CALIBRATION_CHUNKS = Math.ceil(2 * sampleRate / 8192) // ~2 seconds

    processorNode.onaudioprocess = (event) => {
      if (!realtimeWs || realtimeWs.readyState !== WebSocket.OPEN) return

      const inputBuffer = event.inputBuffer
      const numSamples = inputBuffer.length
      const numInputCh = inputBuffer.numberOfChannels
      const pcm = new Int16Array(numSamples) // Always mono output

      if (numInputCh >= 2) {
        const ch0 = inputBuffer.getChannelData(0)
        const ch1 = inputBuffer.getChannelData(1)

        // Calibration: measure energy on each channel for first ~2s
        if (!calibrationDone) {
          calibrationSamples++
          for (let i = 0; i < numSamples; i++) {
            ch0Energy += ch0[i] * ch0[i]
            ch1Energy += ch1[i] * ch1[i]
          }
          if (calibrationSamples >= CALIBRATION_CHUNKS) {
            const ch0Rms = Math.sqrt(ch0Energy / (calibrationSamples * numSamples))
            const ch1Rms = Math.sqrt(ch1Energy / (calibrationSamples * numSamples))
            ch0Active = ch0Rms > 0.001
            ch1Active = ch1Rms > 0.001
            calibrationDone = true
            console.log(`[Recorder] Audio calibration: ch0(system)=${ch0Rms.toFixed(4)} ${ch0Active ? 'ACTIVE' : 'SILENT'}, ch1(mic)=${ch1Rms.toFixed(4)} ${ch1Active ? 'ACTIVE' : 'SILENT'}`)
            if (!ch0Active && ch1Active) {
              console.log('[Recorder] System audio silent — using mic at FULL volume (no 0.5x mix)')
            } else if (ch0Active && !ch1Active) {
              console.log('[Recorder] Mic silent — using system audio at FULL volume')
            }
          }
        }

        // Adaptive mixing: use full volume for the active channel(s)
        if (!ch0Active && ch1Active) {
          for (let i = 0; i < numSamples; i++) {
            const s = Math.max(-1, Math.min(1, ch1[i]))
            pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
          }
        } else if (ch0Active && !ch1Active) {
          for (let i = 0; i < numSamples; i++) {
            const s = Math.max(-1, Math.min(1, ch0[i]))
            pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
          }
        } else {
          for (let i = 0; i < numSamples; i++) {
            const mixed = (ch0[i] + ch1[i]) * 0.5
            const s = Math.max(-1, Math.min(1, mixed))
            pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
          }
        }
      } else {
        const ch0 = inputBuffer.getChannelData(0)
        for (let i = 0; i < numSamples; i++) {
          const s = Math.max(-1, Math.min(1, ch0[i]))
          pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
        }
      }

      // OpenAI Realtime expects base64-encoded PCM16
      const base64Audio = arrayBufferToBase64(pcm.buffer)
      realtimeWs.send(JSON.stringify({
        type: 'input_audio_buffer.append',
        audio: base64Audio
      }))

      chunkCount++
      if (chunkCount <= 3 || chunkCount % 500 === 0) {
        console.log(`[Recorder] Audio chunk #${chunkCount}, size: ${pcm.buffer.byteLength} bytes → base64 (mono, ${sampleRate}Hz)`)
      }

      // Track system audio energy for meeting-end detection (every buffer)
      if (isAutoMode && numInputCh >= 2) {
        const sysCh = inputBuffer.getChannelData(0)
        let sysSum = 0
        for (let i = 0; i < sysCh.length; i++) sysSum += sysCh[i] * sysCh[i]
        trackSystemAudioEnergy(Math.sqrt(sysSum / sysCh.length))
      }

      // Diagnostic: log audio levels every ~10s
      diagCount++
      if (diagCount % DIAG_EVERY === 0) {
        if (numInputCh >= 2) {
          const d0 = inputBuffer.getChannelData(0)
          const d1 = inputBuffer.getChannelData(1)
          let sum0 = 0, sum1 = 0
          for (let i = 0; i < d0.length; i++) {
            sum0 += d0[i] * d0[i]
            sum1 += d1[i] * d1[i]
          }
          console.log(`[Recorder] Audio levels — system: ${Math.sqrt(sum0 / d0.length).toFixed(4)}, mic: ${Math.sqrt(sum1 / d1.length).toFixed(4)}`)
        } else {
          const d0 = inputBuffer.getChannelData(0)
          let sum0 = 0
          for (let i = 0; i < d0.length; i++) sum0 += d0[i] * d0[i]
          console.log(`[Recorder] Audio level: ${Math.sqrt(sum0 / d0.length).toFixed(4)}`)
        }
      }
    }
  }
}

// --- Base64 encoding for ArrayBuffer ---
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

// --- Current interim text accumulator ---
let currentInterimText = ''

function handleTranscriptionDelta(delta) {
  // Accumulate interim text for real-time display
  currentInterimText += delta
  lastTranscriptTime = Date.now()

  // Show as interim segment
  const segment = {
    text: currentInterimText,
    timestamp: (Date.now() - (startTime || Date.now())) / 1000,
    is_final: false,
  }
  addSegmentToUI(segment, false)
}

function handleTranscriptionCompleted(transcript) {
  // Reset interim accumulator
  currentInterimText = ''
  lastTranscriptTime = Date.now()

  if (!transcript.trim()) return

  // Track meaningful transcripts
  const wc = transcript.trim().split(/\s+/).length
  if (wc >= MEANINGFUL_WORD_MIN) {
    lastMeaningfulTranscriptTime = Date.now()
  }

  const segment = {
    text: transcript.trim(),
    timestamp: (Date.now() - (startTime || Date.now())) / 1000,
    is_final: true,
  }

  segments.push(segment)
  markLiveDirty()
  addSegmentToUI(segment, true)
}

function stopAudioCapture() {
  if (processorNode) {
    try {
      processorNode.onaudioprocess = null
      processorNode.disconnect()
    } catch (_) {}
    processorNode = null
  }

  if (realtimeWs) {
    if (realtimeWs.readyState === WebSocket.OPEN) realtimeWs.close()
    realtimeWs = null
  }

  if (audioContext) {
    audioContext.close()
    audioContext = null
  }

  systemStream?.getTracks().forEach(t => t.stop())
  micStream?.getTracks().forEach(t => t.stop())
  systemStream = null
  micStream = null

  // Teardown BlackHole Multi-Output device (restores original audio output)
  if (usingBlackHole && window.electronAPI?.teardownAudioRouting) {
    window.electronAPI.teardownAudioRouting().catch(err => {
      console.warn('[Recorder] BlackHole teardown failed:', err)
    })
    usingBlackHole = false
  }
}

// ============================================================
// MEETING END DETECTION (multi-signal approach)
// Replaces simple silence timeout — works reliably in noisy offices
//
// Signal 1: System audio channel (ch0/BlackHole) drops to near-zero
//           → WebRTC voices stopped → meeting ended
// Signal 2: No meaningful transcript (>= 3 words) for 90s
//           → ambient noise may trigger short fragments, but not real speech
// Signal 3: No transcript at all for 2 min (ultimate fallback)
// ============================================================

function startMeetingEndDetector() {
  // Audio-based fallback: detects when system audio (BlackHole/WebRTC) goes silent
  // Primary detection is AppleScript in main.js; this covers the case where
  // Chrome JS is not enabled (no "Allow JavaScript from Apple Events")
  // All signals show confirmation card — false positives just get dismissed by user
  console.log('[MeetEnd] Detector started (audio-based fallback, checks every 5s)')
  systemEnergyReadings = []
  systemAudioSilentSince = null
  lastTranscriptTime = Date.now()
  lastMeaningfulTranscriptTime = Date.now()
  meetEndPromptPending = false
  if (meetingEndCheckInterval) clearInterval(meetingEndCheckInterval)
  meetingEndCheckInterval = setInterval(checkMeetingEnd, 5000)
}

function stopMeetingEndDetector() {
  // Cleanup (kept for compatibility even though heuristic is disabled)
  if (meetingEndCheckInterval) {
    clearInterval(meetingEndCheckInterval)
    meetingEndCheckInterval = null
  }
  meetEndPromptPending = false
}

/**
 * Called from onaudioprocess with the RMS energy of system audio channel (ch0).
 * Tracks a rolling window and updates silence state every ~5s of audio.
 */
function trackSystemAudioEnergy(rms) {
  systemEnergyReadings.push(rms)
  if (systemEnergyReadings.length > 600) systemEnergyReadings.shift() // Keep ~100s

  // Every ~5s of buffers, compute average and update silence tracking
  if (systemEnergyReadings.length % ENERGY_WINDOW_SIZE === 0) {
    const recent = systemEnergyReadings.slice(-ENERGY_WINDOW_SIZE)
    const avgRms = recent.reduce((a, b) => a + b, 0) / recent.length

    if (avgRms < SYSTEM_AUDIO_SILENT_THRESHOLD) {
      if (!systemAudioSilentSince) {
        systemAudioSilentSince = Date.now()
        console.log(`[MeetEnd] System audio dropped below threshold (avg RMS: ${avgRms.toFixed(5)})`)
      }
    } else {
      if (systemAudioSilentSince) {
        console.log(`[MeetEnd] System audio active again (avg RMS: ${avgRms.toFixed(5)})`)
      }
      systemAudioSilentSince = null
    }
  }
}

let meetEndPromptPending = false // Prevent spamming the prompt
let meetEndCooldownUntil = 0 // Cooldown after user dismisses (prevents repeated prompts)

function checkMeetingEnd() {
  if (!isRecording || !isAutoMode || meetEndPromptPending) return
  // Respect cooldown after user dismissed the prompt
  if (Date.now() < meetEndCooldownUntil) return
  const now = Date.now()

  let shouldAsk = false
  let reason = ''

  // Signal 1: System audio silent (no WebRTC voices) + no meaningful transcript
  if (systemAudioSilentSince) {
    const silentMs = now - systemAudioSilentSince
    const noTranscriptMs = lastMeaningfulTranscriptTime ? (now - lastMeaningfulTranscriptTime) : Infinity
    if (silentMs > SYSTEM_AUDIO_SILENT_TIMEOUT && noTranscriptMs > 10_000) {
      reason = `sysAudioSilent=${Math.round(silentMs / 1000)}s + noTx=${Math.round(noTranscriptMs / 1000)}s`
      shouldAsk = true
    }
  }

  // Signal 2: No meaningful transcription for extended period
  if (!shouldAsk && lastMeaningfulTranscriptTime) {
    const gapMs = now - lastMeaningfulTranscriptTime
    if (gapMs > NO_MEANINGFUL_TRANSCRIPT_TIMEOUT) {
      reason = `noMeaningfulTx=${Math.round(gapMs / 1000)}s`
      shouldAsk = true
    }
  }

  // Signal 3: Absolute silence — no transcript at all
  if (!shouldAsk && lastTranscriptTime) {
    const absMs = now - lastTranscriptTime
    if (absMs > ABSOLUTE_SILENCE_TIMEOUT) {
      reason = `absoluteSilence=${Math.round(absMs / 1000)}s`
      shouldAsk = true
    }
  }

  if (shouldAsk) {
    console.log(`[MeetEnd] Heuristic triggered (${reason}) → asking user via bubble`)
    meetEndPromptPending = true
    // Pause detector while prompt is showing
    if (meetingEndCheckInterval) {
      clearInterval(meetingEndCheckInterval)
      meetingEndCheckInterval = null
    }
    // Ask user via bubble (IPC: recorder → main → bubble)
    if (window.electronAPI?.notifyMeetingMaybeEnded) {
      window.electronAPI.notifyMeetingMaybeEnded()
    }
    return
  }

  // Debug: log current state every check
  const sysMs = systemAudioSilentSince ? Math.round((now - systemAudioSilentSince) / 1000) : 0
  const txMs = lastMeaningfulTranscriptTime ? Math.round((now - lastMeaningfulTranscriptTime) / 1000) : 0
  const absMs = lastTranscriptTime ? Math.round((now - lastTranscriptTime) / 1000) : 0
  console.log(`[MeetEnd] Check: sysAudioSilent=${sysMs}s, noMeaningfulTx=${txMs}s, noAnyTx=${absMs}s`)
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
    div.innerHTML = `<div class="segment-text">${escapeHtml(segment.text)}</div>`
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
    interimElement.innerHTML = `<div class="segment-text interim">${escapeHtml(segment.text)}</div>`
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
        meetingType: selectedMeetingType,
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
// DEDUPLICATION (stereo echo removal)
// ============================================================

/**
 * When recording stereo (system audio L + mic R), the seller's voice
 * gets captured on BOTH channels — once direct from mic and once as
 * WebRTC echo on system audio. This creates duplicate segments with
 * different speaker labels but similar text and close timestamps.
 *
 * This function detects and removes those duplicates:
 * - Compares segments within 2s of each other on different channels
 * - Uses word overlap (Jaccard similarity) to detect duplicates
 * - Keeps the mic version (channel 1) for seller speech
 */
function deduplicateSegments(segs) {
  if (!segs.length) return segs

  // Only deduplicate if we have multichannel data
  const hasChannels = segs.some(s => s.channel !== null && s.channel !== undefined)
  if (!hasChannels) return segs

  const normalizeText = (t) => (t || '').toLowerCase().replace(/[.,!?;:]/g, '').trim()
  const getWords = (t) => normalizeText(t).split(/\s+/).filter(w => w.length > 0)

  function jaccardSimilarity(textA, textB) {
    const wordsA = getWords(textA)
    const wordsB = getWords(textB)
    if (!wordsA.length || !wordsB.length) return 0
    const setA = new Set(wordsA)
    const setB = new Set(wordsB)
    let intersection = 0
    for (const w of setA) { if (setB.has(w)) intersection++ }
    const union = new Set([...wordsA, ...wordsB]).size
    return union > 0 ? intersection / union : 0
  }

  const skipIndices = new Set()

  for (let i = 0; i < segs.length; i++) {
    if (skipIndices.has(i)) continue
    const a = segs[i]

    // Look ahead for potential duplicates (within ~3s window, different channel)
    for (let j = i + 1; j < segs.length; j++) {
      if (skipIndices.has(j)) continue
      const b = segs[j]

      // Stop looking if too far ahead in time
      if (Math.abs(b.timestamp - a.timestamp) > 3) break

      // Must be different channels to be a cross-channel duplicate
      if (a.channel === b.channel) continue

      const sim = jaccardSimilarity(a.text, b.text)
      if (sim >= 0.5) {
        // Duplicate found — keep mic channel (1) for seller, system (0) for others
        // If both are same priority, keep the longer text
        const keepI = a.channel === 1 ? i : j
        const dropI = a.channel === 1 ? j : i
        skipIndices.add(dropI)
        console.log(`[Dedup] Removed duplicate (sim=${sim.toFixed(2)}): "${segs[dropI].text.substring(0, 50)}..." (ch${segs[dropI].channel})`)
      }
    }
  }

  const result = segs.filter((_, idx) => !skipIndices.has(idx))
  if (skipIndices.size > 0) {
    console.log(`[Dedup] Removed ${skipIndices.size} duplicate segments (${segs.length} → ${result.length})`)
  }
  return result
}

// ============================================================
// EVALUATION + SAVE
// ============================================================

async function evaluateAndSave() {
  // Build plain text transcript for validation
  const transcriptText = segments.map(s => s.text).join('\n')

  if (transcriptText.length < 50) {
    throw new Error(`Transcricao muito curta para avaliar (${transcriptText.length} chars, minimo 50)`)
  }

  console.log(`[Recorder] Submitting for background evaluation: ${transcriptText.length} chars, ${segments.length} segments, ${wordCount} words`)

  // Submit to server for background processing (returns immediately)
  const res = await fetch(`${BASE_URL}/api/meet/submit-desktop-recording`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      liveSessionId,
      transcript: segments,
      meetingType: selectedMeetingType,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Erro ao enviar gravacao' }))
    throw new Error(err.error || `Erro ao enviar (status ${res.status})`)
  }

  console.log('[Recorder] Submitted for background processing')
  return null // Evaluation happens server-side
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

// Start Recording — show meeting type choice
els.btnStart.addEventListener('click', (e) => {
  e.preventDefault()
  e.stopPropagation()
  console.log('[Recorder] START BUTTON CLICKED — showing type choice')
  document.getElementById('start-step').style.display = 'none'
  document.getElementById('meeting-type-step').style.display = ''
})

document.getElementById('btn-type-sales').addEventListener('click', () => beginRecording('sales'))
document.getElementById('btn-type-other').addEventListener('click', () => beginRecording('non_sales'))

// Step 2: User picks meeting type → start recording
async function beginRecording(meetingType) {
  selectedMeetingType = meetingType
  document.getElementById('meeting-type-step').style.display = 'none'
  document.getElementById('start-step').style.display = ''

  console.log(`[Recorder] Meeting type: ${meetingType}`)

  try {
    // Reset state
    segments = []
    segmentCount = 0
    wordCount = 0
    interimElement = null
    lastEvaluationId = null
    lastSmartNotes = null

    // Fetch OpenAI key from backend
    const openaiKey = await fetchOpenAIKey()

    // Start audio capture
    await startAudioCapture(openaiKey)
    isRecording = true

    // Switch to recording screen
    els.transcriptList.innerHTML = '<p class="transcript-placeholder">Aguardando transcricao...</p>'
    els.statSegments.textContent = '0'
    els.statWords.textContent = '0'
    showScreen('screen-recording')
    startTimer()
    startMeetingEndDetector()

    // Start live session for real-time viewing on web
    startLiveSession()
  } catch (err) {
    console.error('[Recorder] Start error:', err)
    showError(err.message)
  }
}

// Additional type button handlers registered above with btnStart

// Stop Recording
els.btnStop.addEventListener('click', async () => {
  els.btnStop.disabled = true
  els.btnStop.querySelector('.btn-text').style.display = 'none'
  els.btnStop.querySelector('.btn-loading').style.display = ''

  isRecording = false
  stopMeetingEndDetector()
  stopTimer()
  stopAudioCapture()
  await stopLiveSession('evaluating')

  // Show evaluating
  els.evalDuration.textContent = els.recTimer.textContent || ''
  els.evalWords.textContent = `${wordCount} palavras`
  showScreen('screen-evaluating')

  try {
    await evaluateAndSave()
    // Show submitted screen — evaluation runs server-side
    showScreen('screen-evaluating')
    els.evalDuration.textContent = els.recTimer.textContent || ''
    els.evalWords.textContent = `${wordCount} palavras`
    // Replace spinner with success message
    const evalScreen = document.getElementById('screen-evaluating')
    if (evalScreen) {
      const spinner = evalScreen.querySelector('.eval-spinner')
      if (spinner) spinner.style.display = 'none'
      const evalTitle = evalScreen.querySelector('.eval-title')
      if (evalTitle) evalTitle.textContent = 'Gravação enviada!'
      const evalSubtitle = evalScreen.querySelector('.eval-subtitle')
      if (evalSubtitle) evalSubtitle.textContent = 'A avaliação está sendo processada. Você receberá uma notificação quando estiver pronta. Pode fechar esta janela.'
    }
    cleanupLiveSession()

    // Notify main process and auto-close after 5s
    if (window.electronAPI.notifyRecordingFinished) {
      setTimeout(() => window.electronAPI.notifyRecordingFinished(), 5000)
    }
  } catch (err) {
    console.error('[Recorder] Submit error:', err)
    await stopLiveSession('error')
    cleanupLiveSession()
    showError(err.message)

    if (window.electronAPI.notifyRecordingError) {
      window.electronAPI.notifyRecordingError(err.message || 'Erro desconhecido')
    }
    if (window.electronAPI.notifyRecordingFinished) {
      window.electronAPI.notifyRecordingFinished()
    }
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

async function triggerAutoStart(meetingType) {
  if (!accessToken) {
    pendingAutoStart = true
    pendingMeetingType = meetingType || 'sales'
    return
  }

  isAutoMode = true
  selectedMeetingType = meetingType || 'sales'
  console.log(`[Recorder] Auto-start recording (type: ${selectedMeetingType})`)

  try {
    if (!companyId) await fetchEmployeeInfo()

    segments = []
    segmentCount = 0
    wordCount = 0
    interimElement = null
    lastEvaluationId = null
    lastSmartNotes = null

    const openaiKey = await fetchOpenAIKey()
    await startAudioCapture(openaiKey)
    isRecording = true

    els.transcriptList.innerHTML = '<p class="transcript-placeholder">Aguardando transcricao...</p>'
    els.statSegments.textContent = '0'
    els.statWords.textContent = '0'
    showScreen('screen-recording')
    startTimer()
    startMeetingEndDetector()
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

  stopMeetingEndDetector()
  stopTimer()
  stopAudioCapture()
  await stopLiveSession('evaluating')

  els.evalDuration.textContent = els.recTimer.textContent || ''
  els.evalWords.textContent = `${wordCount} palavras`
  showScreen('screen-evaluating')

  try {
    await evaluateAndSave()
    cleanupLiveSession()
    isAutoMode = false

    // Notify main process — evaluation is running server-side
    if (window.electronAPI.notifyRecordingFinished) {
      window.electronAPI.notifyRecordingFinished()
    }
  } catch (err) {
    console.error('[Recorder] Auto-stop submit error:', err)
    isAutoMode = false
    await stopLiveSession('error')
    cleanupLiveSession()

    if (window.electronAPI.notifyRecordingError) {
      window.electronAPI.notifyRecordingError(err.message || 'Erro desconhecido')
    }
    if (window.electronAPI.notifyRecordingFinished) {
      window.electronAPI.notifyRecordingFinished()
    }
  }
}

// Listen for meeting detection reset (user said "Nao, continua")
if (window.electronAPI.onResetMeetingDetection) {
  window.electronAPI.onResetMeetingDetection(() => {
    console.log('[MeetEnd] User dismissed prompt — cooldown 3 min before next check')
    meetEndPromptPending = false
    meetEndCooldownUntil = Date.now() + 3 * 60 * 1000 // 3 min cooldown
    // Reset silence trackers so they start fresh after cooldown
    systemAudioSilentSince = null
    lastMeaningfulTranscriptTime = Date.now()
    lastTranscriptTime = Date.now()
    // Restart detector (will skip checks until cooldown expires)
    if (isRecording && isAutoMode) {
      startMeetingEndDetector()
    }
  })
}

// Listen for auto-start signal from main process
if (window.electronAPI.onAutoStart) {
  window.electronAPI.onAutoStart((meetingType) => {
    if (accessToken) {
      triggerAutoStart(meetingType)
    } else {
      pendingAutoStart = true
      pendingMeetingType = meetingType || 'sales'
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
