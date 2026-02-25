// ============================================================
// Ramppy Meet — Desktop App
// Auth + System Audio Capture + Deepgram + SPIN Evaluation
// ============================================================

// --- Config ---
const SUPABASE_URL = 'https://rnqqbgcqvjtmvflhuwdk.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJucXFiZ2Nxdmp0bXZmbGh1d2RrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyMzQ5MjIsImV4cCI6MjA3NjgxMDkyMn0.97z_8OqAsQH7YKKJqjHiZKnW876jizvQ3aCAqxJF7pA'
const BASE_URL = 'https://ramppy.site'
const DEEPGRAM_API_KEY = '5df013c634eb0a37ed3c2276cf7118418721f245'
const DEEPGRAM_WS_URL = 'wss://api.deepgram.com/v1/listen'
const DEEPGRAM_PARAMS = {
  model: 'nova-3',
  language: 'pt-BR',
  smart_format: 'true',
  punctuate: 'true',
  diarize: 'true',
  encoding: 'linear16',
  sample_rate: '16000',
  channels: '1',
  interim_results: 'true',
  utterance_end_ms: '1000',
  vad_events: 'true',
}

// --- DOM ---
const $ = (id) => document.getElementById(id)

const allScreens = ['screen-login', 'screen-idle', 'screen-recording', 'screen-evaluating', 'screen-results', 'screen-error']

const els = {
  userName: $('user-name'),
  btnLogout: $('btn-logout'),
  loginForm: $('login-form'),
  loginEmail: $('login-email'),
  loginPassword: $('login-password'),
  loginError: $('login-error'),
  btnLogin: $('btn-login'),
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
  btnNewRecording: $('btn-new-recording'),
  errorMessage: $('error-message'),
  btnRetry: $('btn-retry'),
}

// --- State ---
let sbClient = null
let accessToken = null
let userInfo = null
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

// ============================================================
// SUPABASE AUTH
// ============================================================

function initSupabase() {
  // Supabase UMD exposes as window.supabase
  const sb = window.supabase
  if (!sb || !sb.createClient) {
    console.error('Supabase library not loaded! window.supabase:', typeof sb)
    throw new Error('Biblioteca Supabase não carregou. Verifique supabase.min.js')
  }
  console.log('[Ramppy] Supabase loaded, creating client...')
  sbClient = sb.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  console.log('[Ramppy] Supabase client ready')
}

async function login(email, password) {
  const { data, error } = await sbClient.auth.signInWithPassword({ email, password })
  if (error) throw new Error(error.message)
  if (!data.user) throw new Error('Login falhou')

  accessToken = data.session.access_token

  // Get employee info
  const { data: employee, error: empErr } = await sbClient
    .from('employees')
    .select('company_id, name')
    .eq('user_id', data.user.id)
    .single()

  if (empErr || !employee) throw new Error('Usuário não vinculado a uma empresa')

  userInfo = {
    id: data.user.id,
    email: data.user.email || email,
    name: employee.name || email.split('@')[0],
    companyId: employee.company_id,
  }

  // Listen for token refresh
  sbClient.auth.onAuthStateChange((event, session) => {
    if (session?.access_token) {
      accessToken = session.access_token
    }
  })

  return userInfo
}

async function logout() {
  await sbClient.auth.signOut()
  accessToken = null
  userInfo = null
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
// AUDIO CAPTURE
// ============================================================

async function startAudioCapture(deepgramKey) {
  // 1. Get desktop sources for system audio
  const sources = await window.electronAPI.getSources()
  if (!sources || sources.length === 0) {
    throw new Error('Nenhuma fonte de áudio encontrada')
  }

  const screenSource = sources[0]

  // 2. Capture system audio (desktop audio loopback)
  systemStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: screenSource.id,
      },
    },
    video: {
      mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: screenSource.id,
      },
    },
  })

  // Discard video tracks (we only need audio)
  systemStream.getVideoTracks().forEach(t => t.stop())

  // 3. Capture microphone
  micStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      sampleRate: 16000,
    },
  })

  // 4. Mix both via Web Audio API
  audioContext = new AudioContext({ sampleRate: 16000 })

  const systemSource = audioContext.createMediaStreamSource(systemStream)
  const micSource = audioContext.createMediaStreamSource(micStream)
  const destination = audioContext.createMediaStreamDestination()

  systemSource.connect(destination)
  micSource.connect(destination)

  // 5. Connect to Deepgram
  const params = new URLSearchParams(DEEPGRAM_PARAMS)
  deepgramWs = new WebSocket(`${DEEPGRAM_WS_URL}?${params}`, ['token', deepgramKey])

  deepgramWs.onopen = () => {
    console.log('[Ramppy] Deepgram connected')
    startStreamingAudio(destination.stream)
  }

  deepgramWs.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      if (data.type === 'Results') {
        handleDeepgramResult(data)
      }
    } catch (err) {
      console.error('[Ramppy] Parse error:', err)
    }
  }

  deepgramWs.onerror = (err) => {
    console.error('[Ramppy] Deepgram error:', err)
  }

  deepgramWs.onclose = () => {
    console.log('[Ramppy] Deepgram disconnected')
  }
}

function startStreamingAudio(mixedStream) {
  if (!audioContext || !deepgramWs) return

  const source = audioContext.createMediaStreamSource(mixedStream)

  // ScriptProcessorNode to extract raw PCM
  processorNode = audioContext.createScriptProcessor(4096, 1, 1)

  processorNode.onaudioprocess = (event) => {
    if (!deepgramWs || deepgramWs.readyState !== WebSocket.OPEN) return

    const inputData = event.inputBuffer.getChannelData(0)

    // Float32 → Int16 PCM
    const pcmData = new Int16Array(inputData.length)
    for (let i = 0; i < inputData.length; i++) {
      const s = Math.max(-1, Math.min(1, inputData[i]))
      pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7fff
    }

    deepgramWs.send(pcmData.buffer)
  }

  source.connect(processorNode)
  processorNode.connect(audioContext.destination)
}

function handleDeepgramResult(data) {
  const alt = data.channel?.alternatives?.[0]
  if (!alt?.transcript) return

  const speakerNum = alt.words?.[0]?.speaker ?? 0
  const speaker = `Speaker ${speakerNum}`

  const segment = {
    speaker,
    text: alt.transcript,
    timestamp: data.start || 0,
    is_final: data.is_final,
  }

  if (data.is_final) {
    segments.push(segment)
  }

  addSegmentToUI(segment, data.is_final)
}

function stopAudioCapture() {
  // Close Deepgram
  if (deepgramWs) {
    if (deepgramWs.readyState === WebSocket.OPEN) deepgramWs.close()
    deepgramWs = null
  }

  // Stop processor
  if (processorNode) {
    processorNode.disconnect()
    processorNode = null
  }

  // Close audio context
  if (audioContext) {
    audioContext.close()
    audioContext = null
  }

  // Stop streams
  systemStream?.getTracks().forEach(t => t.stop())
  micStream?.getTracks().forEach(t => t.stop())
  systemStream = null
  micStream = null
}

// ============================================================
// UI: TRANSCRIPT
// ============================================================

function addSegmentToUI(segment, isFinal) {
  // Remove placeholder
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

  // Auto-scroll
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
// EVALUATION
// ============================================================

async function evaluateTranscript() {
  const transcriptText = segments
    .map(s => `${s.speaker}: ${s.text}`)
    .join('\n')

  if (transcriptText.length < 100) {
    throw new Error('Transcrição muito curta para avaliar (mínimo 100 caracteres)')
  }

  const res = await fetch(`${BASE_URL}/api/meet/evaluate`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      transcript: transcriptText,
      meetingId: `desktop_${Date.now()}`,
      companyId: userInfo.companyId,
      sellerName: userInfo.name,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Erro na avaliação' }))
    throw new Error(err.error || 'Erro na avaliação')
  }

  const data = await res.json()
  return data.evaluation
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
    legendary: 'Lendário',
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
}

// ============================================================
// EVENT HANDLERS
// ============================================================

// Global error handlers (show on screen for debugging)
window.onerror = function(msg, src, line, col, err) {
  console.error('Global error:', msg, src, line, col, err)
  const el = $('login-error')
  if (el) {
    el.textContent = `Erro: ${msg} (${src}:${line})`
    el.style.display = ''
  }
}
window.addEventListener('unhandledrejection', function(event) {
  console.error('Unhandled rejection:', event.reason)
  const el = $('login-error')
  if (el) {
    el.textContent = `Erro: ${event.reason?.message || event.reason || 'Erro desconhecido'}`
    el.style.display = ''
  }
})

// Login
els.loginForm.addEventListener('submit', async (e) => {
  e.preventDefault()
  e.stopPropagation()
  els.loginError.style.display = 'none'

  const email = els.loginEmail.value.trim()
  const password = els.loginPassword.value
  if (!email || !password) {
    els.loginError.textContent = 'Preencha e-mail e senha'
    els.loginError.style.display = ''
    return
  }

  console.log('[Ramppy] Login attempt:', email)
  els.btnLogin.disabled = true
  els.btnLogin.querySelector('.btn-text').style.display = 'none'
  els.btnLogin.querySelector('.btn-loading').style.display = ''

  try {
    if (!sbClient) {
      throw new Error('Supabase não inicializado. Reinicie o app.')
    }

    console.log('[Ramppy] Calling signInWithPassword...')
    const { data, error } = await sbClient.auth.signInWithPassword({ email, password })
    console.log('[Ramppy] Auth response:', { data: !!data, error: error?.message })

    if (error) {
      throw new Error(error.message === 'Invalid login credentials'
        ? 'E-mail ou senha incorretos'
        : error.message)
    }
    if (!data?.user) throw new Error('Login falhou — nenhum usuário retornado')
    if (!data?.session) throw new Error('Login falhou — nenhuma sessão retornada')

    accessToken = data.session.access_token
    console.log('[Ramppy] Auth OK, fetching employee...')

    const { data: employee, error: empErr } = await sbClient
      .from('employees')
      .select('company_id, name')
      .eq('user_id', data.user.id)
      .single()

    console.log('[Ramppy] Employee response:', { employee: !!employee, error: empErr?.message })

    if (empErr || !employee) {
      throw new Error('Usuário não vinculado a uma empresa')
    }

    userInfo = {
      id: data.user.id,
      email: data.user.email || email,
      name: employee.name || email.split('@')[0],
      companyId: employee.company_id,
    }

    sbClient.auth.onAuthStateChange((event, session) => {
      if (session?.access_token) accessToken = session.access_token
    })

    console.log('[Ramppy] Login success:', userInfo.name)
    els.userName.textContent = userInfo.name
    els.btnLogout.style.display = ''
    els.loginForm.reset()
    showScreen('screen-idle')
  } catch (err) {
    console.error('[Ramppy] Login error:', err)
    els.loginError.textContent = err.message || 'Erro desconhecido no login'
    els.loginError.style.display = ''
  } finally {
    els.btnLogin.disabled = false
    els.btnLogin.querySelector('.btn-text').style.display = ''
    els.btnLogin.querySelector('.btn-loading').style.display = 'none'
  }
})

// Logout
els.btnLogout.addEventListener('click', async () => {
  stopAudioCapture()
  stopTimer()
  await logout()
  els.btnLogout.style.display = 'none'
  els.userName.textContent = ''
  showScreen('screen-login')
})

// Start Recording
els.btnStart.addEventListener('click', async () => {
  els.btnStart.disabled = true
  els.btnStart.querySelector('span').textContent = 'Iniciando...'

  try {
    // Reset state
    segments = []
    segmentCount = 0
    wordCount = 0
    interimElement = null

    // Start capture with embedded key
    await startAudioCapture(DEEPGRAM_API_KEY)

    // Switch to recording screen
    els.transcriptList.innerHTML = '<p class="transcript-placeholder">Aguardando transcrição...</p>'
    els.statSegments.textContent = '0'
    els.statWords.textContent = '0'
    showScreen('screen-recording')
    startTimer()
  } catch (err) {
    console.error('Start error:', err)
    showError(err.message)
  } finally {
    els.btnStart.disabled = false
    els.btnStart.querySelector('span').textContent = 'Iniciar Gravação'
  }
})

// Stop Recording
els.btnStop.addEventListener('click', async () => {
  els.btnStop.disabled = true
  els.btnStop.querySelector('span').textContent = 'Parando...'

  stopTimer()
  stopAudioCapture()

  // Show evaluating
  els.evalDuration.textContent = els.recTimer.textContent || ''
  els.evalWords.textContent = `${wordCount} palavras`
  showScreen('screen-evaluating')

  try {
    const evaluation = await evaluateTranscript()
    showResults(evaluation)
  } catch (err) {
    console.error('Evaluation error:', err)
    showError(err.message)
  } finally {
    els.btnStop.disabled = false
    els.btnStop.querySelector('span').textContent = 'Parar e Avaliar'
  }
})

// New Recording
els.btnNewRecording.addEventListener('click', () => {
  showScreen('screen-idle')
})

// Retry
els.btnRetry.addEventListener('click', () => {
  if (userInfo) {
    showScreen('screen-idle')
  } else {
    showScreen('screen-login')
  }
})

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

async function init() {
  try {
    initSupabase()
  } catch (err) {
    console.error('Init failed:', err)
    showError(err.message)
    return
  }

  // Check for existing session
  const { data: { session } } = await sbClient.auth.getSession()

  if (session?.access_token) {
    accessToken = session.access_token

    try {
      const { data: { user } } = await sbClient.auth.getUser()
      if (user) {
        const { data: employee } = await sbClient
          .from('employees')
          .select('company_id, name')
          .eq('user_id', user.id)
          .single()

        if (employee) {
          userInfo = {
            id: user.id,
            email: user.email,
            name: employee.name || user.email.split('@')[0],
            companyId: employee.company_id,
          }

          els.userName.textContent = userInfo.name
          els.btnLogout.style.display = ''

          sbClient.auth.onAuthStateChange((event, sess) => {
            if (sess?.access_token) accessToken = sess.access_token
          })

          showScreen('screen-idle')
          return
        }
      }
    } catch (err) {
      console.error('Session restore failed:', err)
    }
  }

  showScreen('screen-login')
}

init()
