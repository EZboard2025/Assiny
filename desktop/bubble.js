// ============================================================
// Ramppy Floating Assistant — Bubble Chat (Agent Mode)
// ============================================================

// API URLs — resolved dynamically (dev: localhost, prod: ramppy.site)
let API_BASE = 'https://ramppy.site'
if (window.electronAPI && window.electronAPI.getPlatformUrl) {
  window.electronAPI.getPlatformUrl().then(url => { API_BASE = url })
}

function getAgentUrl() { return `${API_BASE}/api/agent/chat` }

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

if (window.electronAPI && window.electronAPI.onAuthToken) {
  window.electronAPI.onAuthToken((data) => {
    if (data && data.accessToken) {
      accessToken = data.accessToken
      userId = data.userId
    }
  })
}

// --- Mouse event forwarding (transparent areas pass clicks through) ---
function enableMouseCapture() {
  if (window.electronAPI && window.electronAPI.setIgnoreMouse) {
    window.electronAPI.setIgnoreMouse(false)
  }
}

function disableMouseCapture() {
  if (window.electronAPI && window.electronAPI.setIgnoreMouse) {
    window.electronAPI.setIgnoreMouse(true)
  }
}

bubble.addEventListener('mouseenter', enableMouseCapture)
bubble.addEventListener('mouseleave', () => {
  if (!isDragging && !isExpanded) {
    disableMouseCapture()
  }
})

// --- UI: Expand / Collapse ---
function expand() {
  isExpanded = true
  bubble.style.display = 'none'
  chatPanel.style.display = 'flex'
  // Show rec bar if recording
  if (isBubbleRecording) recBar.style.display = 'flex'
  enableMouseCapture()
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
  recBar.style.display = 'none'
  bubble.style.display = 'flex'
  disableMouseCapture()
  // Slightly larger when recording so REC badge is clickable
  if (isBubbleRecording) {
    window.electronAPI.resizeBubble(90, 80)
  } else {
    window.electronAPI.resizeBubble(72, 72)
  }
}

// --- Global shortcut toggle (Cmd+Shift+R) ---
if (window.electronAPI && window.electronAPI.onToggleBubble) {
  window.electronAPI.onToggleBubble(() => {
    if (isExpanded) {
      collapse()
    } else {
      expand()
    }
  })
}

// --- Drag Logic (bubble) with edge snapping ---
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
      bubble.classList.add('dragging')
    }
    if (isDragging) {
      window.electronAPI.moveBubble(winStartX + dx, winStartY + dy)
    }
  }

  const onUp = () => {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)

    if (isDragging) {
      bubble.classList.remove('dragging')
      if (window.electronAPI.snapToEdge) {
        window.electronAPI.snapToEdge()
      }
      isDragging = false
    } else {
      expand()
    }
  }

  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
})

// --- Drag Logic (chat header) ---
const chatHeader = document.querySelector('.chat-header')

chatHeader.addEventListener('mousedown', async (e) => {
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

// ============================================================
// SEND MESSAGE (Agent API)
// ============================================================
async function sendMessage(text) {
  if (!text.trim() || isSending) return

  if (!ensureAuth()) {
    switchToChatMode()
    addAIMessage('Faca login na plataforma Ramppy primeiro para usar o assistente.')
    return
  }

  isSending = true
  if (btnSend) btnSend.disabled = true
  if (btnSendWelcome) btnSendWelcome.disabled = true

  switchToChatMode()

  welcomeInput.value = ''
  chatInput.value = ''

  addUserMessage(text)
  showTyping()

  try {
    conversationHistory.push({ role: 'user', content: text })

    let screenshot = null
    if (window.electronAPI && window.electronAPI.captureScreenshot) {
      try { screenshot = await window.electronAPI.captureScreenshot() } catch (_) {}
    }

    const res = await fetch(getAgentUrl(), {
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

  const lines = text.split('\n')
  let html = ''
  let inList = false

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      if (inList) { html += '</div>'; inList = false }
      continue
    }

    if (/^#{1,3}\s/.test(trimmed)) {
      if (inList) { html += '</div>'; inList = false }
      const headerText = trimmed.replace(/^#{1,3}\s/, '')
      html += `<div class="text-header"><div class="text-header-bar"></div><div class="text-header-text">${escapeHtml(headerText)}</div></div>`
      continue
    }

    if (/^[-•*]\s/.test(trimmed)) {
      if (!inList) { html += '<div class="bullet-list">'; inList = true }
      const bulletText = trimmed.replace(/^[-•*]\s/, '')
      html += `<div class="bullet-item"><div class="bullet-dot"></div><div class="bullet-text">${formatInline(bulletText)}</div></div>`
      continue
    }

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

// --- Recording state indicator (Meet auto-detection) ---
const recBadge = document.getElementById('rec-badge')
const recBar = document.getElementById('rec-bar')
const btnStopRec = document.getElementById('btn-stop-rec')
let isBubbleRecording = false

if (window.electronAPI && window.electronAPI.onRecordingState) {
  window.electronAPI.onRecordingState((isRecording) => {
    isBubbleRecording = isRecording
    if (isRecording) {
      bubble.classList.add('recording')
      recBadge.style.display = 'flex'
      // Show rec bar in expanded chat panel
      if (isExpanded) recBar.style.display = 'flex'
      // Expand window slightly so REC badge (positioned outside bubble) is clickable
      if (!isExpanded && !meetPromptVisible && !meetStartPromptVisible) {
        window.electronAPI.resizeBubble(90, 80)
      }
    } else {
      bubble.classList.remove('recording')
      recBadge.style.display = 'none'
      recBar.style.display = 'none'
      // Restore normal size if collapsed
      if (!isExpanded && !meetPromptVisible && !meetStartPromptVisible) {
        window.electronAPI.resizeBubble(72, 72)
      }
    }
  })
}

// Clicking REC badge (collapsed) or Stop button (expanded) → show end card
recBadge.addEventListener('click', (e) => {
  e.stopPropagation()
  if (isBubbleRecording) showMeetPrompt()
})

btnStopRec.addEventListener('click', (e) => {
  e.stopPropagation()
  if (isBubbleRecording) showMeetPrompt()
})

// --- Meeting Start Prompt ---
const meetStartPrompt = document.getElementById('meet-start-prompt')
const meetStartSubtitle = document.getElementById('meet-start-subtitle')
const btnMeetStartYes = document.getElementById('btn-meet-start-yes')
const btnMeetStartNo = document.getElementById('btn-meet-start-no')
let meetStartPromptVisible = false

function showMeetStartPrompt(meetTitle) {
  if (meetStartPromptVisible) return
  meetStartPromptVisible = true

  // Extract meeting code from title (e.g. "abc-defg-hij")
  const codeMatch = meetTitle && meetTitle.match(/[a-z]{3}-[a-z]{4}-[a-z]{3}/)
  meetStartSubtitle.textContent = codeMatch ? codeMatch[0] : ''

  // Hide bubble and chat panel, show start prompt
  bubble.style.display = 'none'
  chatPanel.style.display = 'none'
  meetStartPrompt.style.display = 'block'

  enableMouseCapture()
  window.electronAPI.resizeBubble(300, 240)
}

function hideMeetStartPrompt() {
  meetStartPromptVisible = false
  meetStartPrompt.style.display = 'none'

  // Restore bubble (collapsed state)
  if (isExpanded) {
    chatPanel.style.display = 'flex'
    window.electronAPI.resizeBubble(380, 520)
  } else {
    bubble.style.display = 'flex'
    disableMouseCapture()
    window.electronAPI.resizeBubble(72, 72)
  }
}

btnMeetStartYes.addEventListener('click', () => {
  hideMeetStartPrompt()
  window.electronAPI.confirmMeetingStart()
})

btnMeetStartNo.addEventListener('click', () => {
  hideMeetStartPrompt()
  window.electronAPI.dismissMeetingStart()
})

// Listen for start prompt request from main process
if (window.electronAPI && window.electronAPI.onAskMeetingStart) {
  window.electronAPI.onAskMeetingStart((meetTitle) => {
    showMeetStartPrompt(meetTitle)
  })
}

// Listen for hide signal (meeting disappeared before user responded)
if (window.electronAPI && window.electronAPI.onHideMeetingStart) {
  window.electronAPI.onHideMeetingStart(() => {
    if (meetStartPromptVisible) {
      hideMeetStartPrompt()
    }
  })
}

// --- Meeting End Prompt ---
const meetPrompt = document.getElementById('meet-prompt')
const btnMeetYes = document.getElementById('btn-meet-yes')
const btnMeetNo = document.getElementById('btn-meet-no')
let meetPromptVisible = false

function showMeetPrompt() {
  if (meetPromptVisible) return
  meetPromptVisible = true

  // Hide bubble and chat panel, show prompt
  bubble.style.display = 'none'
  chatPanel.style.display = 'none'
  meetPrompt.style.display = 'block'

  // Expand window to fit the prompt card
  enableMouseCapture()
  window.electronAPI.resizeBubble(240, 180)
}

function hideMeetPrompt() {
  meetPromptVisible = false
  meetPrompt.style.display = 'none'

  // Restore bubble (collapsed state)
  if (isExpanded) {
    chatPanel.style.display = 'flex'
    window.electronAPI.resizeBubble(380, 520)
  } else {
    bubble.style.display = 'flex'
    disableMouseCapture()
    window.electronAPI.resizeBubble(72, 72)
  }
}

btnMeetYes.addEventListener('click', () => {
  hideMeetPrompt()
  window.electronAPI.confirmMeetingEnded()
})

btnMeetNo.addEventListener('click', () => {
  hideMeetPrompt()
  window.electronAPI.dismissMeetingEnded()
})

// Listen for prompt request from main process
if (window.electronAPI && window.electronAPI.onAskMeetingEnded) {
  window.electronAPI.onAskMeetingEnded(() => {
    showMeetPrompt()
  })
}

// --- Init ---
// Auth token will be received via IPC from main window
