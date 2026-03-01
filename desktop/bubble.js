// ============================================================
// Ramppy Floating Assistant — Bubble Chat
// Design: matches SellerAgentChat.tsx from website
// ============================================================

const API_URL = 'http://localhost:3000/api/agent/chat'
const SUGGESTIONS_URL = 'http://localhost:3000/api/agent/suggestions'
const TRANSCRIBE_URL = 'http://localhost:3000/api/roleplay/transcribe'
const TTS_URL = 'http://localhost:3000/api/agent/tts'

// --- State ---
let accessToken = null
let userId = null
let userName = null
let conversationHistory = []
let isExpanded = false
let isSending = false
let hasMessages = false

// --- Voice State ---
let isRecording = false
let mediaRecorder = null
let audioChunks = []
let currentAudio = null  // currently playing TTS audio

// --- Call Mode State ---
let isInCall = false
let callAudioContext = null
let callAnalyser = null
let callStream = null
let speechDetected = false

// --- DOM ---
const bubble = document.getElementById('bubble')
const chatPanel = document.getElementById('chat-panel')
const chatMessages = document.getElementById('chat-messages')
const welcomeState = document.getElementById('welcome-state')
const welcomeTitle = document.getElementById('welcome-title')
const welcomeInput = document.getElementById('welcome-input')
const btnSendWelcome = document.getElementById('btn-send-welcome')
const chatInput = document.getElementById('chat-input')
const welcomeSuggestions = document.getElementById('welcome-suggestions')
const btnSend = document.getElementById('btn-send')
const btnClose = document.getElementById('btn-close')
const chatPills = document.getElementById('chat-pills')
const chatInputBar = document.getElementById('chat-input-bar')
const headerSparkle = document.getElementById('header-sparkle')
const btnCall = document.getElementById('btn-call')
const btnHangup = document.getElementById('btn-hangup')
const callOverlay = document.getElementById('call-overlay')
const callOrb = document.getElementById('call-orb')
const callOrbRing = document.getElementById('call-orb-ring')
const callStatusEl = document.getElementById('call-status')
const btnMic = document.getElementById('btn-mic')
const btnMicWelcome = document.getElementById('btn-mic-welcome')

// --- Auth (received from main window via IPC) ---
function ensureAuth() {
  return !!(accessToken && userId)
}

// Listen for auth token from main platform window
if (window.electronAPI && window.electronAPI.onAuthToken) {
  window.electronAPI.onAuthToken((data) => {
    if (data && data.accessToken) {
      accessToken = data.accessToken
      userId = data.userId
    }
  })
}

// --- UI: Expand / Collapse ---
let savedBubblePos = null // bubble position before expanding
let suggestionsLoaded = false // only load once per session

// 3 icon SVGs to rotate through for dynamic suggestions
const SUGGESTION_ICONS = [
  '<svg class="sug-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  '<svg class="sug-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>',
  '<svg class="sug-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
]

const DEFAULT_SUGGESTIONS = [
  'Quem precisa de atenção?',
  'Compare os vendedores',
  'Como está minha performance?',
]

function renderSuggestions(suggestions) {
  welcomeSuggestions.innerHTML = ''
  suggestions.forEach((text, i) => {
    const btn = document.createElement('button')
    btn.className = 'suggestion-card fade-in'
    btn.dataset.msg = text
    btn.innerHTML = `${SUGGESTION_ICONS[i % SUGGESTION_ICONS.length]}<span>${escapeHtml(text)}</span>`
    btn.addEventListener('click', () => sendMessage(text))
    welcomeSuggestions.appendChild(btn)
  })
}

function showSuggestionsLoading() {
  welcomeSuggestions.innerHTML = `
    <div class="suggestion-skeleton"><div class="skeleton-line"></div></div>
    <div class="suggestion-skeleton"><div class="skeleton-line"></div></div>
    <div class="suggestion-skeleton"><div class="skeleton-line"></div></div>
  `
}

async function loadContextualSuggestions() {
  if (suggestionsLoaded || hasMessages) return
  showSuggestionsLoading()

  try {
    // Capture screenshot of what the user is seeing
    let screenshot = null
    if (window.electronAPI && window.electronAPI.captureScreenshot) {
      screenshot = await window.electronAPI.captureScreenshot()
    }

    if (!screenshot) {
      renderSuggestions(DEFAULT_SUGGESTIONS)
      suggestionsLoaded = true
      return
    }

    const res = await fetch(SUGGESTIONS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ screenshot }),
    })

    if (!res.ok) throw new Error('API error')

    const data = await res.json()
    const suggestions = data.suggestions && data.suggestions.length >= 3
      ? data.suggestions.slice(0, 3)
      : DEFAULT_SUGGESTIONS

    renderSuggestions(suggestions)
    suggestionsLoaded = true
  } catch (err) {
    console.error('Failed to load contextual suggestions:', err)
    renderSuggestions(DEFAULT_SUGGESTIONS)
    suggestionsLoaded = true
  }
}

async function expand() {
  if (peekTimeout) { clearTimeout(peekTimeout); peekTimeout = null }
  if (snapBarTimeout) { clearTimeout(snapBarTimeout); snapBarTimeout = null }
  removeBarState()

  // Save exact bubble position — this is sacred, never change it
  savedBubblePos = await window.electronAPI.getBubblePos()

  isExpanded = true
  snappedEdge = null
  isHidden = false
  isAnimating = false

  // Calculate target position BEFORE any visual changes
  const scr = await window.electronAPI.getScreenSize()
  const panelW = 420
  const panelH = 780
  let px = savedBubblePos.x
  let py = savedBubblePos.y

  if (px + panelW > scr.width) px = scr.width - panelW - 8
  if (px < 0) px = 8
  if (py + panelH > scr.height) py = scr.height - panelH - 8
  if (py < 0) py = 8

  // Hide window → resize → show panel → restore window (prevents dark flash on Windows)
  await window.electronAPI.setBubbleOpacity(0)
  bubble.style.display = 'none'
  chatPanel.classList.remove('panel-animate')
  chatPanel.style.display = 'flex'
  await window.electronAPI.setBubbleBounds(px, py, panelW, panelH)
  void chatPanel.offsetWidth // force reflow
  chatPanel.classList.add('panel-animate')
  await window.electronAPI.setBubbleOpacity(1)

  if (hasMessages) {
    chatInput.focus()
  } else {
    welcomeInput.focus()
    // Load contextual suggestions based on what's on screen
    loadContextualSuggestions()
  }
}

async function collapse() {
  isExpanded = false
  removeBarState()
  suggestionsLoaded = false

  // End call if active
  if (isInCall) endCall()

  // Hide window → resize back to bubble → show (prevents dark flash)
  await window.electronAPI.setBubbleOpacity(0)
  chatPanel.style.display = 'none'
  chatPanel.classList.remove('panel-animate')
  bubble.style.display = 'flex'

  if (savedBubblePos) {
    await window.electronAPI.setBubbleBounds(savedBubblePos.x, savedBubblePos.y, BUBBLE_SIZE, BUBBLE_SIZE)
  } else {
    await window.electronAPI.resizeBubble(BUBBLE_SIZE, BUBBLE_SIZE)
  }
  await window.electronAPI.setBubbleOpacity(1)
}

// --- Snap to Edge State ---
let snappedEdge = null // 'left' | 'right' | 'top' | 'bottom' | null
let snappedCoord = 0   // the non-edge coordinate (y for left/right, x for top/bottom)
let isHidden = false
let isAnimating = false
const BUBBLE_SIZE = 72
const VISIBLE_PX = 20   // pixels visible when hidden at edge
const PEEK_OFFSET = 8   // pixels from edge when peeking (hover)
const SNAP_THRESHOLD = 50 // only snap if dropped within 50px of a screen edge

// Bar dimensions when hidden at edge
const BAR_THICKNESS = 18  // thin dimension (px)
const BAR_LENGTH = 180    // long dimension (px) — tall visible bar
let snapBarTimeout = null

function applyBarState(edge) {
  bubble.classList.add('edge-bar', `edge-bar-${edge}`)
}

function removeBarState() {
  bubble.classList.remove('edge-bar', 'edge-bar-left', 'edge-bar-right', 'edge-bar-top', 'edge-bar-bottom')
}

function getBarBounds(edge, scr) {
  const isVert = edge === 'left' || edge === 'right'
  const barW = isVert ? BAR_THICKNESS : BAR_LENGTH
  const barH = isVert ? BAR_LENGTH : BAR_THICKNESS

  let bx, by
  switch (edge) {
    case 'left':
      bx = 0
      by = snappedCoord + (BUBBLE_SIZE - BAR_LENGTH) / 2
      break
    case 'right':
      bx = scr.width - BAR_THICKNESS
      by = snappedCoord + (BUBBLE_SIZE - BAR_LENGTH) / 2
      break
    case 'top':
      bx = snappedCoord + (BUBBLE_SIZE - BAR_LENGTH) / 2
      by = 0
      break
    case 'bottom':
      bx = snappedCoord + (BUBBLE_SIZE - BAR_LENGTH) / 2
      by = scr.height - BAR_THICKNESS
      break
  }

  // Clamp to screen
  if (isVert) {
    by = Math.max(0, Math.min(by, scr.height - barH))
  } else {
    bx = Math.max(0, Math.min(bx, scr.width - barW))
  }

  return { x: bx, y: by, w: barW, h: barH }
}

async function snapIfNearEdge() {
  if (isExpanded) return

  const pos = await window.electronAPI.getBubblePos()
  const scr = await window.electronAPI.getScreenSize()

  // Check if near any edge
  const distLeft = pos.x
  const distRight = scr.width - (pos.x + BUBBLE_SIZE)
  const distTop = pos.y
  const distBottom = scr.height - (pos.y + BUBBLE_SIZE)
  const minDist = Math.min(distLeft, distRight, distTop, distBottom)

  if (minDist <= SNAP_THRESHOLD) {
    snapToEdge()
  }
  // Otherwise: bubble stays where user dropped it, no snap
}

async function snapToEdge() {
  if (isExpanded) return
  isAnimating = true
  if (snapBarTimeout) { clearTimeout(snapBarTimeout); snapBarTimeout = null }

  const pos = await window.electronAPI.getBubblePos()
  const scr = await window.electronAPI.getScreenSize()

  // Calculate distance to each edge
  const distances = {
    left: pos.x,
    right: scr.width - (pos.x + BUBBLE_SIZE),
    top: pos.y,
    bottom: scr.height - (pos.y + BUBBLE_SIZE)
  }

  // Find nearest edge
  let minEdge = 'right'
  let minDist = Infinity
  for (const [edge, dist] of Object.entries(distances)) {
    if (dist < minDist) { minDist = dist; minEdge = edge }
  }
  snappedEdge = minEdge

  // Save original bubble coordinate for peek position
  switch (snappedEdge) {
    case 'left':
    case 'right':
      snappedCoord = Math.max(0, Math.min(pos.y, scr.height - BUBBLE_SIZE))
      break
    case 'top':
    case 'bottom':
      snappedCoord = Math.max(0, Math.min(pos.x, scr.width - BUBBLE_SIZE))
      break
  }

  // Phase 1: Animate bubble (circle) toward the edge
  let targetX, targetY
  switch (snappedEdge) {
    case 'left':
      targetX = -(BUBBLE_SIZE - VISIBLE_PX)
      targetY = snappedCoord
      break
    case 'right':
      targetX = scr.width - VISIBLE_PX
      targetY = snappedCoord
      break
    case 'top':
      targetX = snappedCoord
      targetY = -(BUBBLE_SIZE - VISIBLE_PX)
      break
    case 'bottom':
      targetX = snappedCoord
      targetY = scr.height - VISIBLE_PX
      break
  }

  window.electronAPI.snapBubble(targetX, targetY, 250)

  // Phase 2: After animation completes, morph circle into bar
  snapBarTimeout = setTimeout(async () => {
    snapBarTimeout = null
    if (isExpanded || !snappedEdge) return

    const scr2 = await window.electronAPI.getScreenSize()
    const bar = getBarBounds(snappedEdge, scr2)

    applyBarState(snappedEdge)
    window.electronAPI.setBubbleBounds(bar.x, bar.y, bar.w, bar.h)
    isHidden = true
    isAnimating = false
  }, 300)
}

async function peekFromEdge() {
  if (!snappedEdge || isExpanded || isAnimating) return
  isAnimating = true
  if (snapBarTimeout) { clearTimeout(snapBarTimeout); snapBarTimeout = null }

  // Remove bar state — restore bubble appearance
  removeBarState()

  const scr = await window.electronAPI.getScreenSize()
  const pos = await window.electronAPI.getBubblePos()

  // Resize from bar back to bubble, centered on bar's midpoint
  const isVert = snappedEdge === 'left' || snappedEdge === 'right'
  let resizeX = isVert ? pos.x : pos.x + (BAR_LENGTH - BUBBLE_SIZE) / 2
  let resizeY = isVert ? pos.y + (BAR_LENGTH - BUBBLE_SIZE) / 2 : pos.y

  window.electronAPI.setBubbleBounds(resizeX, resizeY, BUBBLE_SIZE, BUBBLE_SIZE)

  // Animate to peek position
  let targetX, targetY
  switch (snappedEdge) {
    case 'left':
      targetX = PEEK_OFFSET
      targetY = snappedCoord
      break
    case 'right':
      targetX = scr.width - BUBBLE_SIZE - PEEK_OFFSET
      targetY = snappedCoord
      break
    case 'top':
      targetX = snappedCoord
      targetY = PEEK_OFFSET
      break
    case 'bottom':
      targetX = snappedCoord
      targetY = scr.height - BUBBLE_SIZE - PEEK_OFFSET
      break
  }

  isHidden = false
  window.electronAPI.snapBubble(targetX, targetY, 150)
  setTimeout(() => { isAnimating = false }, 200)

  // Auto-hide after 3 seconds if not clicked again
  if (peekTimeout) clearTimeout(peekTimeout)
  peekTimeout = setTimeout(() => {
    if (snappedEdge && !isExpanded && !isHidden && !isDragging) {
      hideAtEdge()
    }
  }, 3000)
}

async function hideAtEdge() {
  if (!snappedEdge || isExpanded || isAnimating) return
  isAnimating = true
  if (snapBarTimeout) { clearTimeout(snapBarTimeout); snapBarTimeout = null }

  const scr = await window.electronAPI.getScreenSize()
  const bar = getBarBounds(snappedEdge, scr)

  applyBarState(snappedEdge)
  window.electronAPI.setBubbleBounds(bar.x, bar.y, bar.w, bar.h)

  isHidden = true
  setTimeout(() => { isAnimating = false }, 250)
}

// --- Drag Logic (bubble) ---
let isDragging = false
let dragStartX = 0
let dragStartY = 0
let winStartX = 0
let winStartY = 0
const DRAG_THRESHOLD = 5

bubble.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return
  isDragging = false
  dragStartX = e.screenX
  dragStartY = e.screenY
  let posReady = false

  // Get position async but register listeners IMMEDIATELY to avoid race condition
  window.electronAPI.getBubblePos().then(pos => {
    winStartX = pos.x
    winStartY = pos.y
    posReady = true
  })

  const cleanup = () => {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
    isDragging = false
  }

  const onMove = (ev) => {
    // Safety: if no mouse button is held, the mouseup was lost (cursor left the window)
    if (ev.buttons === 0) {
      cleanup()
      return
    }
    if (!posReady) return // wait for position before allowing drag
    const dx = ev.screenX - dragStartX
    const dy = ev.screenY - dragStartY
    if (!isDragging && Math.abs(dx) + Math.abs(dy) > DRAG_THRESHOLD) {
      isDragging = true
      // If in bar state, convert back to bubble for dragging
      if (bubble.classList.contains('edge-bar')) {
        removeBarState()
        const newX = ev.screenX - BUBBLE_SIZE / 2
        const newY = ev.screenY - BUBBLE_SIZE / 2
        window.electronAPI.setBubbleBounds(newX, newY, BUBBLE_SIZE, BUBBLE_SIZE)
        winStartX = newX
        winStartY = newY
        dragStartX = ev.screenX
        dragStartY = ev.screenY
        snappedEdge = null
        isHidden = false
      }
    }
    if (isDragging) {
      window.electronAPI.moveBubble(winStartX + dx, winStartY + dy)
    }
  }

  const onUp = () => {
    const wasDragging = isDragging
    cleanup()
    if (!wasDragging) {
      // If hidden at edge, first peek; if already peeked, expand
      if (snappedEdge && isHidden) {
        peekFromEdge()
      } else {
        expand()
      }
    } else {
      // Only snap to edge if dropped near a screen border
      snapIfNearEdge()
    }
  }

  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
})

// --- Drag Logic (chat header) ---
const chatHeader = document.querySelector('.chat-header')
chatHeader.style.cursor = 'grab'

chatHeader.addEventListener('mousedown', async (e) => {
  // Ignore clicks on the close button
  if (e.target.closest('.btn-close')) return
  if (e.button !== 0) return

  chatHeader.style.cursor = 'grabbing'
  const startX = e.screenX
  const startY = e.screenY
  const pos = await window.electronAPI.getBubblePos()

  const onUp = () => {
    chatHeader.style.cursor = 'grab'
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
  }

  const onMove = (ev) => {
    // Safety: if no mouse button held, mouseup was lost (cursor left the window)
    if (ev.buttons === 0) { onUp(); return }
    window.electronAPI.moveBubble(pos.x + ev.screenX - startX, pos.y + ev.screenY - startY)
  }

  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
})

function switchToChatMode() {
  if (hasMessages) return
  hasMessages = true
  welcomeState.style.display = 'none'
  chatPills.style.display = 'flex'
  chatInputBar.style.display = 'block'
  chatInput.focus()
}

// bubble click is handled by drag logic (mousedown/mouseup)
btnClose.addEventListener('click', collapse)

// --- Avatar HTML ---
const AVATAR_HTML = `<div class="ai-avatar"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="url(#aurora-grad)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z"/></svg></div>`

// --- Chat ---
function addUserMessage(text) {
  const div = document.createElement('div')
  div.className = 'msg-user-wrap'
  div.innerHTML = `<div class="msg-user">${escapeHtml(text)}</div>`
  chatMessages.appendChild(div)
  chatMessages.scrollTop = chatMessages.scrollHeight
}

function addAIMessage(content) {
  const wrap = document.createElement('div')
  wrap.className = 'msg-ai-wrap'

  const rendered = renderRichContent(content)
  wrap.innerHTML = `${AVATAR_HTML}<div class="msg-ai">${rendered}</div>`
  chatMessages.appendChild(wrap)
  chatMessages.scrollTop = chatMessages.scrollHeight
}

function showTyping() {
  const wrap = document.createElement('div')
  wrap.className = 'typing-wrap'
  wrap.id = 'typing-indicator'
  wrap.innerHTML = `${AVATAR_HTML}<div class="typing-bubble"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>`
  chatMessages.appendChild(wrap)
  chatMessages.scrollTop = chatMessages.scrollHeight
  // Heartbeat on sparkle while AI thinks
  if (headerSparkle) headerSparkle.classList.add('thinking')
}

function removeTyping() {
  const el = document.getElementById('typing-indicator')
  if (el) el.remove()
  // Stop heartbeat (unless in call mode)
  if (headerSparkle && !isInCall) headerSparkle.classList.remove('thinking')
}

// --- Instant Desktop Action Detector (fires before AI processes) ---
const LOCAL_ACTION_MAP = {
  chrome: 'chrome', 'google chrome': 'chrome',
  firefox: 'firefox', 'mozilla firefox': 'firefox',
  edge: 'edge', 'microsoft edge': 'edge', msedge: 'edge',
  notepad: 'notepad', 'bloco de notas': 'notepad',
  calculadora: 'calculator', calculator: 'calculator', calc: 'calculator',
  explorer: 'explorer', 'explorador de arquivos': 'explorer', 'file explorer': 'explorer',
  vscode: 'vscode', 'vs code': 'vscode', 'visual studio code': 'vscode', code: 'vscode',
  terminal: 'terminal', cmd: 'cmd', powershell: 'powershell',
  paint: 'paint', mspaint: 'paint',
  word: 'word', 'microsoft word': 'word',
  excel: 'excel', 'microsoft excel': 'excel',
  powerpoint: 'powerpoint', ppt: 'powerpoint',
  outlook: 'outlook', email: 'outlook',
  spotify: 'spotify', whatsapp: 'whatsapp',
}

// Known site shortcuts
const SITE_MAP = {
  ramppy: 'https://ramppy.com',
  google: 'https://google.com',
  gmail: 'https://mail.google.com',
  youtube: 'https://youtube.com',
  linkedin: 'https://linkedin.com',
  instagram: 'https://instagram.com',
  facebook: 'https://facebook.com',
  twitter: 'https://x.com',
  github: 'https://github.com',
  chatgpt: 'https://chat.openai.com',
}

function tryInstantAction(text) {
  if (!window.electronAPI || !window.electronAPI.executeDesktopAction) return false
  const lower = text.toLowerCase().trim()
  console.log('[InstantAction] checking:', lower)

  // Broad verb patterns for opening/navigating
  const verbs = 'abre|abrir|abra|open|entra|entrar|vai|ir|navega|navegar|acessa|acessar|visita|visitar|me leva|leva-me|vai pra|vai pro|vai para|entra no|entra na|entra em|abre o|abre a'
  const match = lower.match(new RegExp(`(?:${verbs})\\s+(.+?)[.!?]*$`))

  if (!match) {
    console.log('[InstantAction] no match for pattern')
    return false
  }

  // Clean target: remove articles and prepositions at the start
  let target = match[1].trim().replace(/^(?:o|a|os|as|no|na|nos|nas|do|da|dos|das|de|em|pro|pra|para|ao|à)\s+/g, '').trim()
  console.log('[InstantAction] target:', target)

  // Check if target mentions a known site
  for (const [name, url] of Object.entries(SITE_MAP)) {
    if (target.includes(name)) {
      console.log('[InstantAction] known site:', name, '→', url)
      window.electronAPI.executeDesktopAction({ type: 'open_url', target: url }).then(r => console.log('[InstantAction] result:', r))
      return true
    }
  }

  // Check if it's a URL pattern
  if (target.includes('.com') || target.includes('.org') || target.includes('.net') || target.includes('.io') || target.includes('.site') || target.startsWith('http')) {
    // Extract the URL part
    const urlPart = target.match(/(https?:\/\/\S+|\S+\.\w{2,})/)?.[1] || target
    const url = urlPart.startsWith('http') ? urlPart : `https://${urlPart}`
    console.log('[InstantAction] opening URL:', url)
    window.electronAPI.executeDesktopAction({ type: 'open_url', target: url }).then(r => console.log('[InstantAction] result:', r))
    return true
  }

  // Check if it's a known app (exact match)
  const appKey = LOCAL_ACTION_MAP[target]
  if (appKey) {
    console.log('[InstantAction] exact match:', target, '→', appKey)
    window.electronAPI.executeDesktopAction({ type: 'open_app', target: appKey }).then(r => console.log('[InstantAction] result:', r))
    return true
  }

  // Try partial match (e.g. "o chrome" → "chrome")
  for (const [name, key] of Object.entries(LOCAL_ACTION_MAP)) {
    if (target.includes(name)) {
      console.log('[InstantAction] partial match:', target, 'contains', name, '→', key)
      window.electronAPI.executeDesktopAction({ type: 'open_app', target: key }).then(r => console.log('[InstantAction] result:', r))
      return true
    }
  }

  console.log('[InstantAction] no app match for:', target)
  return false
}

async function sendMessage(text) {
  if (!text.trim() || isSending) return

  // Fire desktop action instantly (don't wait for AI)
  tryInstantAction(text)

  if (!ensureAuth()) {
    switchToChatMode()
    addAIMessage('Oi! Preciso que você faça login na plataforma Ramppy primeiro para que eu possa te ajudar.')
    return
  }

  isSending = true
  if (btnSend) btnSend.disabled = true
  if (btnSendWelcome) btnSendWelcome.disabled = true

  // Switch to chat mode
  switchToChatMode()

  // Clear inputs
  welcomeInput.value = ''
  chatInput.value = ''

  addUserMessage(text)
  conversationHistory.push({ role: 'user', content: text })

  showTyping()

  // Auto-capture screenshot for AI vision context
  let screenshot = null
  if (window.electronAPI && window.electronAPI.captureScreenshot) {
    try { screenshot = await window.electronAPI.captureScreenshot() } catch (_) {}
  }

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        message: text,
        conversationHistory: conversationHistory.slice(-20),
        screenshot,
      }),
    })

    removeTyping()

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || `Erro ${res.status}`)
    }

    const data = await res.json()
    const reply = data.response || 'Sem resposta.'

    addAIMessage(reply)
    conversationHistory.push({ role: 'assistant', content: reply })

    // Execute desktop actions if present (only in Electron)
    if (data.desktopActions && window.electronAPI && window.electronAPI.executeDesktopAction) {
      for (const action of data.desktopActions) {
        try {
          const result = await window.electronAPI.executeDesktopAction(action)
          if (!result.success) console.warn('[Desktop Action] Failed:', action, result.error)
        } catch (err) {
          console.error('[Desktop Action] IPC error:', err)
        }
      }
    }

    // Execute search actions: search locally, then send results back to AI automatically
    if (data.searchActions && window.electronAPI && window.electronAPI.searchComputer) {
      const allResults = []
      for (const search of data.searchActions) {
        try {
          console.log('[Search] Executing:', search)
          const result = await window.electronAPI.searchComputer({ type: search.search_type, name: search.name })
          console.log('[Search] Results:', result)
          allResults.push({ query: search, results: result.results || [] })
        } catch (err) {
          console.error('[Search] IPC error:', err)
        }
      }
      // Send search results back to AI as a follow-up message
      if (allResults.length > 0) {
        const resultsText = allResults.map(r => {
          const paths = r.results.map(res => res.path || res.name || JSON.stringify(res)).join('\n- ')
          return `Busca "${r.query.name}" (${r.query.search_type}): ${r.results.length > 0 ? `\n- ${paths}` : 'Nenhum resultado encontrado.'}`
        }).join('\n\n')
        // Auto-send results to AI (hidden from user, sent as system context)
        showTyping()
        if (headerSparkle) headerSparkle.classList.add('thinking')
        try {
          const followUp = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
            body: JSON.stringify({
              message: `[RESULTADOS DA BUSCA NO COMPUTADOR - use esses caminhos reais para abrir com execute_desktop_action]\n${resultsText}\n\nAgora abra o resultado mais relevante usando execute_desktop_action(open_path, caminho_encontrado). Se não encontrou, informe o vendedor.`,
              conversationHistory: conversationHistory.slice(-20),
            }),
          })
          removeTyping()
          if (followUp.ok) {
            const data2 = await followUp.json()
            const reply2 = data2.response || ''
            if (reply2) {
              addAIMessage(reply2)
              conversationHistory.push({ role: 'assistant', content: reply2 })
            }
            // Execute desktop actions from follow-up
            if (data2.desktopActions && window.electronAPI.executeDesktopAction) {
              for (const action of data2.desktopActions) {
                try { await window.electronAPI.executeDesktopAction(action) } catch (_) {}
              }
            }
          }
        } catch (err) {
          removeTyping()
          console.error('[Search follow-up] Error:', err)
        }
        if (headerSparkle) headerSparkle.classList.remove('thinking')
      }
    }

    if (headerSparkle) headerSparkle.classList.remove('thinking')
  } catch (err) {
    removeTyping()
    if (headerSparkle) headerSparkle.classList.remove('thinking')
    addAIMessage(`Erro: ${err.message}`)
  } finally {
    isSending = false
    if (btnSend) btnSend.disabled = false
    if (btnSendWelcome) btnSendWelcome.disabled = false
    chatInput.focus()
  }
}

// --- Rich Content Renderer ---
function renderRichContent(content) {
  // Strip visual tags (score, spin, etc.) - simplify for bubble
  let text = content
    .replace(/\{\{score\|([^|]*)\|([^|]*)\|([^}]*)\}\}/g, '<div class="bullet-list"><div class="bullet-item"><div class="bullet-dot"></div><div class="bullet-text"><strong>$3:</strong> $1/$2</div></div></div>')
    .replace(/\{\{spin\|([^|]*)\|([^|]*)\|([^|]*)\|([^}]*)\}\}/g, '<div class="bullet-list"><div class="bullet-item"><div class="bullet-dot"></div><div class="bullet-text"><strong>SPIN:</strong> S=$1 P=$2 I=$3 N=$4</div></div></div>')
    .replace(/\{\{trend\|([^|]*)\|([^}]*)\}\}/g, '<em>$2</em>')
    .replace(/\{\{metric\|([^|]*)\|([^}]*)\}\}/g, '<strong>$1</strong> $2')
    .replace(/\{\{meeting\|[^}]*\}\}/g, '')
    .replace(/\{\{eval_card\|[^}]*\}\}/g, '')
    .replace(/\{\{teammate\|[^}]*\}\}/g, '')
    .replace(/\{\{ranking\|[^}]*\}\}/g, '')
    .replace(/\{\{comparison\|[^}]*\}\}/g, '')

  // Process markdown-like formatting
  const lines = text.split('\n')
  let html = ''
  let inList = false

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      if (inList) { html += '</div>'; inList = false }
      continue
    }

    // Headers (### or **)
    if (/^#{1,3}\s/.test(trimmed)) {
      if (inList) { html += '</div>'; inList = false }
      const headerText = trimmed.replace(/^#{1,3}\s/, '')
      html += `<div class="text-header"><div class="text-header-bar"></div><div class="text-header-text">${escapeHtml(headerText)}</div></div>`
      continue
    }

    // Bullet points
    if (/^[-•*]\s/.test(trimmed)) {
      if (!inList) { html += '<div class="bullet-list">'; inList = true }
      const bulletText = trimmed.replace(/^[-•*]\s/, '')
      html += `<div class="bullet-item"><div class="bullet-dot"></div><div class="bullet-text">${formatInline(bulletText)}</div></div>`
      continue
    }

    // Numbered list
    if (/^\d+[.)]\s/.test(trimmed)) {
      if (!inList) { html += '<div class="bullet-list">'; inList = true }
      const numText = trimmed.replace(/^\d+[.)]\s/, '')
      html += `<div class="bullet-item"><div class="bullet-dot"></div><div class="bullet-text">${formatInline(numText)}</div></div>`
      continue
    }

    if (inList) { html += '</div>'; inList = false }
    html += `<div style="margin-bottom:4px;">${formatInline(trimmed)}</div>`
  }

  if (inList) html += '</div>'
  return html || escapeHtml(text)
}

function formatInline(text) {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code style="background:rgba(245,245,250,0.8);padding:1px 5px;border-radius:4px;font-size:12px;">$1</code>')
}

// --- Whisper Hallucination Filter ---
const WHISPER_HALLUCINATIONS = [
  'legendas pela comunidade amara.org',
  'legendas pela comunidade amara',
  'legendas pela comunidade',
  'obrigado por assistir',
  'inscreva-se no canal',
  'não se esqueça de se inscrever',
  'até a próxima',
  'continue assistindo',
  'subtitles by the amara.org community',
  'thank you for watching',
  'thanks for watching',
]

function isWhisperHallucination(text) {
  if (!text) return true
  const lower = text.toLowerCase().trim()
  if (lower.length < 2) return true
  return WHISPER_HALLUCINATIONS.some(h => lower.includes(h))
}

// --- Voice: Recording ---
let recordingStartTime = 0
const MIN_RECORDING_MS = 500

async function startRecording(micBtn) {
  if (isRecording || isSending) return

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    audioChunks = []
    recordingStartTime = Date.now()
    mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunks.push(e.data)
    }

    mediaRecorder.onstop = async () => {
      stream.getTracks().forEach(t => t.stop())
      if (micBtn) micBtn.classList.remove('recording')
      isRecording = false

      // Discard recordings that are too short (prevents Whisper hallucinations)
      const duration = Date.now() - recordingStartTime
      if (audioChunks.length === 0 || duration < MIN_RECORDING_MS) return

      const blob = new Blob(audioChunks, { type: 'audio/webm' })
      await transcribeAndSend(blob)
    }

    mediaRecorder.start()
    isRecording = true
    if (micBtn) micBtn.classList.add('recording')
  } catch (err) {
    console.error('Mic access denied:', err)
    isRecording = false
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop()
  }
}

function toggleRecording(micBtn) {
  if (isRecording) {
    stopRecording()
  } else {
    startRecording(micBtn)
  }
}

async function transcribeAndSend(blob) {
  const formData = new FormData()
  formData.append('audio', blob, 'voice.webm')

  try {
    switchToChatMode()
    showTyping()

    const res = await fetch(TRANSCRIBE_URL, { method: 'POST', body: formData })
    if (!res.ok) throw new Error('Transcription failed')

    const data = await res.json()
    const text = data.text?.trim()

    removeTyping()

    if (!text || isWhisperHallucination(text)) {
      if (headerSparkle) headerSparkle.classList.remove('thinking')
      return
    }

    // Send as regular message
    await sendMessage(text)
  } catch (err) {
    removeTyping()
    if (headerSparkle) headerSparkle.classList.remove('thinking')
    addAIMessage('Erro ao transcrever áudio. Tente novamente.')
    console.error('Transcribe error:', err)
  }
}

// --- Call Mode: Phone Call Experience ---
function setCallState(state) {
  if (callOrb) {
    callOrb.className = 'call-orb'
    if (state !== 'idle') callOrb.classList.add('call-' + state)
    callOrb.style.transform = ''
    callOrb.style.boxShadow = ''
  }
  if (callOrbRing) {
    callOrbRing.className = 'call-orb-ring'
    if (state !== 'idle') callOrbRing.classList.add('call-' + state)
  }
  if (callStatusEl) {
    switch (state) {
      case 'listening': callStatusEl.textContent = 'Ouvindo...'; break
      case 'thinking': callStatusEl.textContent = 'Pensando...'; break
      case 'speaking': callStatusEl.textContent = 'Nicole está falando...'; break
      default: callStatusEl.textContent = ''; break
    }
  }
}

async function startCall() {
  if (isInCall || isSending) return
  if (!ensureAuth()) {
    switchToChatMode()
    addAIMessage('Faça login na plataforma Ramppy primeiro para usar a chamada de voz.')
    return
  }

  isInCall = true
  if (btnCall) btnCall.classList.add('active')
  if (callOverlay) callOverlay.style.display = 'flex'

  switchToChatMode()
  startCallListening()
}

function endCall() {
  isInCall = false

  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.onstop = () => {
      if (callStream) { callStream.getTracks().forEach(t => t.stop()); callStream = null }
    }
    mediaRecorder.stop()
  }
  isRecording = false

  if (currentAudio) { currentAudio.pause(); currentAudio = null }

  if (callAudioContext) {
    callAudioContext.close().catch(() => {})
    callAudioContext = null
    callAnalyser = null
  }
  if (callStream) { callStream.getTracks().forEach(t => t.stop()); callStream = null }

  setCallState('idle')
  if (callOverlay) callOverlay.style.display = 'none'
  if (btnCall) btnCall.classList.remove('active')
  if (headerSparkle) headerSparkle.classList.remove('thinking')
}

async function startCallListening() {
  if (!isInCall) return

  setCallState('listening')
  speechDetected = false

  try {
    callStream = await navigator.mediaDevices.getUserMedia({ audio: true })

    callAudioContext = new AudioContext()
    callAnalyser = callAudioContext.createAnalyser()
    callAnalyser.fftSize = 256
    callAnalyser.smoothingTimeConstant = 0.3
    const source = callAudioContext.createMediaStreamSource(callStream)
    source.connect(callAnalyser)

    audioChunks = []
    recordingStartTime = Date.now()
    mediaRecorder = new MediaRecorder(callStream, { mimeType: 'audio/webm;codecs=opus' })

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunks.push(e.data)
    }

    mediaRecorder.onstop = async () => {
      if (!isInCall) return

      if (callStream) { callStream.getTracks().forEach(t => t.stop()); callStream = null }
      if (callAudioContext) { callAudioContext.close().catch(() => {}); callAudioContext = null; callAnalyser = null }
      isRecording = false

      const duration = Date.now() - recordingStartTime
      if (audioChunks.length === 0 || !speechDetected || duration < MIN_RECORDING_MS) {
        if (isInCall) setTimeout(() => startCallListening(), 300)
        return
      }

      const blob = new Blob(audioChunks, { type: 'audio/webm' })
      setCallState('thinking')
      if (headerSparkle) headerSparkle.classList.add('thinking')

      await transcribeAndSendCall(blob)
    }

    mediaRecorder.start()
    isRecording = true
    monitorSilence()
  } catch (err) {
    console.error('Mic error in call:', err)
    endCall()
  }
}

function monitorSilence() {
  if (!isInCall || !callAnalyser) return

  let silenceStart = null
  const SILENCE_THRESHOLD = 18
  const SPEECH_THRESHOLD = 28
  const SILENCE_DURATION = 1800

  const dataArray = new Uint8Array(callAnalyser.frequencyBinCount)

  function check() {
    if (!isInCall || !isRecording || !callAnalyser) return

    callAnalyser.getByteFrequencyData(dataArray)
    const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length

    if (avg > SPEECH_THRESHOLD) {
      speechDetected = true
      silenceStart = null
    } else if (speechDetected && avg < SILENCE_THRESHOLD) {
      if (!silenceStart) silenceStart = Date.now()
      else if (Date.now() - silenceStart > SILENCE_DURATION) {
        if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop()
        return
      }
    }

    requestAnimationFrame(check)
  }

  check()
}

async function transcribeAndSendCall(blob) {
  if (!isInCall) return

  const formData = new FormData()
  formData.append('audio', blob, 'voice.webm')

  try {
    const res = await fetch(TRANSCRIBE_URL, { method: 'POST', body: formData })
    if (!res.ok) throw new Error('Transcription failed')

    const data = await res.json()
    const text = data.text?.trim()

    if (!text || isWhisperHallucination(text)) {
      if (isInCall) startCallListening()
      return
    }

    addUserMessage(text)
    conversationHistory.push({ role: 'user', content: text })

    // Fire desktop action instantly in call mode too
    tryInstantAction(text)

    let screenshot = null
    if (window.electronAPI && window.electronAPI.captureScreenshot) {
      try { screenshot = await window.electronAPI.captureScreenshot() } catch (_) {}
    }

    const res2 = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        message: text,
        conversationHistory: conversationHistory.slice(-20),
        screenshot,
      }),
    })

    if (!res2.ok) {
      const err = await res2.json().catch(() => ({}))
      throw new Error(err.error || `Erro ${res2.status}`)
    }

    const data2 = await res2.json()
    const reply = data2.response || 'Sem resposta.'

    addAIMessage(reply)
    conversationHistory.push({ role: 'assistant', content: reply })

    // Execute desktop actions from call mode too
    if (data2.desktopActions && window.electronAPI && window.electronAPI.executeDesktopAction) {
      for (const action of data2.desktopActions) {
        try {
          await window.electronAPI.executeDesktopAction(action)
        } catch (err) {
          console.error('[Desktop Action] IPC error:', err)
        }
      }
    }

    if (headerSparkle) headerSparkle.classList.remove('thinking')

    if (isInCall) {
      setCallState('speaking')
      await playCallTTS(reply)
      if (isInCall) startCallListening()
    }
  } catch (err) {
    console.error('Call flow error:', err)
    if (isInCall) {
      if (headerSparkle) headerSparkle.classList.remove('thinking')
      startCallListening()
    }
  }
}

function playCallTTS(text) {
  return new Promise(async (resolve) => {
    if (!isInCall) { resolve(); return }

    try {
      const res = await fetch(TTS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })

      if (!res.ok) {
        console.error('TTS failed:', res.status)
        resolve()
        return
      }

      const audioBlob = await res.blob()
      const audioUrl = URL.createObjectURL(audioBlob)

      if (currentAudio) { currentAudio.pause(); currentAudio = null }

      currentAudio = new Audio(audioUrl)

      currentAudio.onended = () => {
        URL.revokeObjectURL(audioUrl)
        currentAudio = null
        resolve()
      }
      currentAudio.onerror = (e) => {
        console.error('Audio playback error:', e)
        URL.revokeObjectURL(audioUrl)
        currentAudio = null
        resolve()
      }

      // Play audio directly — no AudioContext (createMediaElementSource captures output and kills sound)
      try {
        currentAudio.volume = 1.0
        await currentAudio.play()
        console.log('TTS audio playing, duration:', currentAudio.duration)

        // Simple CSS-based orb pulse while speaking (no Web Audio API needed)
        function pulseOrb() {
          if (!currentAudio || currentAudio.paused || currentAudio.ended) {
            if (callOrb) {
              callOrb.style.transform = 'scale(1)'
              callOrb.style.boxShadow = ''
            }
            return
          }
          // Simulate voice energy with a subtle random pulse
          const energy = 0.5 + Math.random() * 0.5
          if (callOrb) {
            const scale = 1 + energy * 0.12
            const glow = 30 + energy * 50
            callOrb.style.transform = `scale(${scale})`
            callOrb.style.boxShadow = `0 0 ${glow}px rgba(16, 185, 129, ${(0.15 + energy * 0.25).toFixed(2)})`
          }
          requestAnimationFrame(pulseOrb)
        }
        pulseOrb()
      } catch (playErr) {
        console.error('TTS play() failed:', playErr)
        resolve()
      }
    } catch (err) {
      console.error('TTS error:', err)
      resolve()
    }
  })
}

// --- Events ---
btnSend.addEventListener('click', () => sendMessage(chatInput.value))
btnSendWelcome.addEventListener('click', () => sendMessage(welcomeInput.value))

// Mic buttons
if (btnMic) btnMic.addEventListener('click', () => toggleRecording(btnMic))
if (btnMicWelcome) btnMicWelcome.addEventListener('click', () => toggleRecording(btnMicWelcome))

// Call mode
if (btnCall) btnCall.addEventListener('click', startCall)
if (btnHangup) btnHangup.addEventListener('click', endCall)

chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(chatInput.value) }
})

welcomeInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(welcomeInput.value) }
})

// Pills (static in HTML — suggestion cards are now dynamic, handled in renderSuggestions)
document.querySelectorAll('.pill').forEach(btn => {
  btn.addEventListener('click', () => sendMessage(btn.dataset.msg))
})

// Escape: end call first, or minimize
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (isInCall) endCall()
    else if (isExpanded) collapse()
  }
})

// --- Utils ---
function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

// --- Resize Logic (edge/corner drag) ---
document.querySelectorAll('.resize-handle').forEach(handle => {
  handle.addEventListener('mousedown', async (e) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()

    const dir = handle.dataset.dir
    const startX = e.screenX
    const startY = e.screenY
    const pos = await window.electronAPI.getBubblePos()
    const startBounds = { x: pos.x, y: pos.y, w: window.outerWidth, h: window.outerHeight }

    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }

    const onMove = (ev) => {
      if (ev.buttons === 0) { onUp(); return }
      const dx = ev.screenX - startX
      const dy = ev.screenY - startY
      let { x, y, w, h } = startBounds

      if (dir.includes('e')) w += dx
      if (dir.includes('w')) { w -= dx; x += dx }
      if (dir.includes('s')) h += dy
      if (dir.includes('n')) { h -= dy; y += dy }

      window.electronAPI.setBubbleBounds(x, y, w, h)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  })
})

// --- Snap to Edge: Auto-hide after peek timeout ---
let peekTimeout = null

// --- Init ---
// Auth token will be received via IPC from main window
