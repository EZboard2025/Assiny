// ============================================================
// Ramppy Floating Assistant — Bubble Chat
// Design: matches SellerAgentChat.tsx from website
// ============================================================

const API_URL = 'http://localhost:3000/api/agent/chat'
const SUGGESTIONS_URL = 'http://localhost:3000/api/agent/suggestions'

// --- State ---
let accessToken = null
let userId = null
let userName = null
let conversationHistory = []
let isExpanded = false
let isSending = false
let hasMessages = false

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
  bubble.style.display = 'none'
  chatPanel.style.display = 'flex'

  // Panel opens at bubble position, only shift if it overflows the screen
  const scr = await window.electronAPI.getScreenSize()
  const panelW = 420
  const panelH = 780
  let px = savedBubblePos.x
  let py = savedBubblePos.y

  if (px + panelW > scr.width) px = scr.width - panelW - 8
  if (px < 0) px = 8
  if (py + panelH > scr.height) py = scr.height - panelH - 8
  if (py < 0) py = 8

  // Atomic: set position + size in one call to avoid visual jumps
  window.electronAPI.setBubbleBounds(px, py, panelW, panelH)

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
  chatPanel.style.display = 'none'
  bubble.style.display = 'flex'
  removeBarState()

  // Reset suggestions so next open captures a fresh screenshot
  suggestionsLoaded = false

  // Atomic: restore exact saved position + bubble size in one call
  if (savedBubblePos) {
    window.electronAPI.setBubbleBounds(savedBubblePos.x, savedBubblePos.y, 72, 72)
  } else {
    await window.electronAPI.resizeBubble(72, 72)
  }
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
}

function removeTyping() {
  const el = document.getElementById('typing-indicator')
  if (el) el.remove()
}

async function sendMessage(text) {
  if (!text.trim() || isSending) return

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
  } catch (err) {
    removeTyping()
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

// --- Events ---
btnSend.addEventListener('click', () => sendMessage(chatInput.value))
btnSendWelcome.addEventListener('click', () => sendMessage(welcomeInput.value))

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

// Escape to minimize
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && isExpanded) collapse()
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
