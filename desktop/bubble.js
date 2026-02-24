// ============================================================
// Ramppy Floating Assistant — Bubble Chat
// Design: matches SellerAgentChat.tsx from website
// ============================================================

const API_URL = 'https://assiny.ramppy.site/api/agent/chat'

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
function expand() {
  isExpanded = true
  bubble.style.display = 'none'
  chatPanel.style.display = 'flex'
  window.electronAPI.resizeBubble(380, 520)
  if (hasMessages) {
    chatInput.focus()
  } else {
    welcomeInput.focus()
  }
}

function collapse() {
  isExpanded = false
  chatPanel.style.display = 'none'
  bubble.style.display = 'flex'
  window.electronAPI.resizeBubble(72, 72)
}

// --- Drag Logic (bubble) ---
let isDragging = false
let dragStartX = 0
let dragStartY = 0
let winStartX = 0
let winStartY = 0
const DRAG_THRESHOLD = 5

bubble.addEventListener('mousedown', async (e) => {
  if (e.button !== 0) return
  isDragging = false
  dragStartX = e.screenX
  dragStartY = e.screenY
  const pos = await window.electronAPI.getBubblePos()
  winStartX = pos.x
  winStartY = pos.y

  const onMove = (ev) => {
    const dx = ev.screenX - dragStartX
    const dy = ev.screenY - dragStartY
    if (!isDragging && Math.abs(dx) + Math.abs(dy) > DRAG_THRESHOLD) {
      isDragging = true
    }
    if (isDragging) {
      window.electronAPI.moveBubble(winStartX + dx, winStartY + dy)
    }
  }

  const onUp = () => {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
    if (!isDragging) {
      expand()
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

  const onMove = (ev) => {
    window.electronAPI.moveBubble(pos.x + ev.screenX - startX, pos.y + ev.screenY - startY)
  }

  const onUp = () => {
    chatHeader.style.cursor = 'grab'
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
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
const AVATAR_HTML = `<div class="ai-avatar"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z"/></svg></div>`

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
    addAIMessage('Faça login na plataforma Ramppy primeiro para usar o assistente.')
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
    .replace(/`(.+?)`/g, '<code style="background:#e5e7eb;padding:1px 4px;border-radius:3px;font-size:12px;">$1</code>')
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

// Suggestion cards + pills
document.querySelectorAll('.suggestion-card, .pill').forEach(btn => {
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

    const onMove = (ev) => {
      const dx = ev.screenX - startX
      const dy = ev.screenY - startY
      let { x, y, w, h } = startBounds

      if (dir.includes('e')) w += dx
      if (dir.includes('w')) { w -= dx; x += dx }
      if (dir.includes('s')) h += dy
      if (dir.includes('n')) { h -= dy; y += dy }

      window.electronAPI.setBubbleBounds(x, y, w, h)
    }

    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  })
})

// --- Init ---
// Auth token will be received via IPC from main window
