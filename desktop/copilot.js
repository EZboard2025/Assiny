// ============================================================
// Copiloto de Vendas — Desktop Window
// Mirrors SalesCopilot.tsx behavior for the Electron WhatsApp
// ============================================================

// --- API URL (resolved dynamically) ---
let API_BASE = 'https://ramppy.site'
if (window.electronAPI && window.electronAPI.getPlatformUrl) {
  window.electronAPI.getPlatformUrl().then(url => { API_BASE = url })
}

// --- State ---
let accessToken = null
let userId = null
let copilotHistory = []
let feedbackStates = {}
let sentMsgIds = new Set()
let isSending = false
let hasMessages = false
let showActionHints = true

// WhatsApp context from scraper
let waContext = { active: false, contactName: null, contactPhone: null, messages: [] }
let currentContact = null

// --- DOM ---
const messagesArea = document.getElementById('messages')
const welcomeState = document.getElementById('welcome-state')
const noConversation = document.getElementById('no-conversation')
const welcomeInput = document.getElementById('welcome-input')
const btnSendWelcome = document.getElementById('btn-send-welcome')
const chatInput = document.getElementById('chat-input')
const btnSend = document.getElementById('btn-send')
const chatPills = document.getElementById('chat-pills')
const chatInputBar = document.getElementById('chat-input-bar')
const headerContact = document.getElementById('header-contact')
const contactNameEl = document.getElementById('contact-name')
const btnBack = document.getElementById('btn-back')

// --- Auth ---
if (window.electronAPI && window.electronAPI.onAuthToken) {
  window.electronAPI.onAuthToken((data) => {
    if (data && data.accessToken) {
      accessToken = data.accessToken
      userId = data.userId
    }
  })
}

// --- Avatar HTML ---
const AVATAR_HTML = `<div class="ai-avatar"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z"/></svg></div>`

// ============================================================
// UI STATE MANAGEMENT
// ============================================================

function showWelcome() {
  welcomeState.style.display = 'flex'
  noConversation.style.display = 'none'
  chatPills.style.display = 'none'
  chatInputBar.style.display = 'none'
  hasMessages = false
}

function showNoConversation() {
  welcomeState.style.display = 'none'
  noConversation.style.display = 'flex'
  chatPills.style.display = 'none'
  chatInputBar.style.display = 'none'
  hasMessages = false
}

function switchToChatMode() {
  if (hasMessages) return
  hasMessages = true
  welcomeState.style.display = 'none'
  noConversation.style.display = 'none'
  chatPills.style.display = 'flex'
  chatInputBar.style.display = 'block'
  chatInput.focus()
}

function resetChat() {
  copilotHistory = []
  feedbackStates = {}
  sentMsgIds = new Set()
  showActionHints = true
  hasMessages = false
  // Clear messages, re-add welcome
  messagesArea.innerHTML = ''
  messagesArea.appendChild(welcomeState)
  showWelcome()
}

// ============================================================
// CONTACT / CONVERSATION CHANGE
// ============================================================

function onContactChange(contactName) {
  if (contactName === currentContact) return
  currentContact = contactName

  // Update header
  if (contactName) {
    contactNameEl.textContent = contactName
    headerContact.style.display = 'flex'
  } else {
    headerContact.style.display = 'none'
  }

  // Reset chat for new contact
  resetChat()
}

// ============================================================
// MESSAGE RENDERING
// ============================================================

function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

function addUserMessage(text) {
  const div = document.createElement('div')
  div.className = 'msg-user-wrap'
  div.innerHTML = `<div class="msg-user">${escapeHtml(text)}</div>`
  messagesArea.appendChild(div)
  messagesArea.scrollTop = messagesArea.scrollHeight
}

function addAIMessage(content, feedbackId) {
  const wrap = document.createElement('div')
  wrap.className = 'msg-ai-wrap'
  const msgId = `ai_${Date.now()}`

  const rendered = renderRichContent(content)

  // Build action buttons
  let actionsHtml = `<div class="msg-actions" data-msg-id="${msgId}">`

  // Send to WhatsApp button
  actionsHtml += `
    <button class="btn-action btn-send-wa" data-msg-id="${msgId}" title="Enviar para o chat" onclick="sendToWhatsApp(this)">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
      Enviar
    </button>`

  // Copy button
  actionsHtml += `
    <button class="btn-action" title="Copiar" onclick="copyMessage(this)">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
      Copiar
    </button>`

  // Feedback buttons
  if (feedbackId) {
    actionsHtml += `
      <button class="btn-action btn-feedback-up" data-feedback-id="${feedbackId}" title="Útil" onclick="handleFeedback(this, true)">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z"/><path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/></svg>
      </button>
      <button class="btn-action btn-feedback-down" data-feedback-id="${feedbackId}" title="Não útil" onclick="handleFeedback(this, false)">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10z"/><path d="M17 2h3a2 2 0 012 2v7a2 2 0 01-2 2h-3"/></svg>
      </button>`
  }

  actionsHtml += '</div>'

  wrap.innerHTML = `${AVATAR_HTML}<div class="msg-ai" data-raw="${escapeHtml(content)}">${rendered}${actionsHtml}</div>`
  messagesArea.appendChild(wrap)
  messagesArea.scrollTop = messagesArea.scrollHeight
}

function showTyping() {
  const wrap = document.createElement('div')
  wrap.className = 'typing-wrap'
  wrap.id = 'typing-indicator'
  wrap.innerHTML = `${AVATAR_HTML}<div class="typing-bubble"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>`
  messagesArea.appendChild(wrap)
  messagesArea.scrollTop = messagesArea.scrollHeight
}

function removeTyping() {
  const el = document.getElementById('typing-indicator')
  if (el) el.remove()
}

// ============================================================
// CONVERSATION CONTEXT FORMATTING (mirrors SalesCopilot.tsx)
// ============================================================

function formatConversationContext() {
  if (!waContext.active || !waContext.messages?.length) return ''

  const now = new Date()
  const clientName = waContext.contactName || 'Cliente'
  const msgs = waContext.messages

  // Smart truncation: if >30 messages, keep first 5 + last 25
  let selected = [...msgs]
  if (selected.length > 30) {
    selected = [...selected.slice(0, 5), ...selected.slice(-25)]
  }

  // Build analysis header
  let analysis = `DATA E HORA ATUAL: ${now.toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}, ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}\n`

  if (selected.length > 0) {
    const lastMsg = selected[selected.length - 1]
    const lastMsgDate = new Date(lastMsg.timestamp)
    const diffMs = now.getTime() - lastMsgDate.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    const timeAgo = diffDays > 0 ? `${diffDays} dia(s)` : diffHours > 0 ? `${diffHours} hora(s)` : 'menos de 1 hora'

    analysis += `ULTIMA MENSAGEM: ${lastMsg.fromMe ? 'Vendedor' : clientName}, ha ${timeAgo}\n`

    // Lead status / ghosting detection
    const reversed = [...selected].reverse()
    const lastSellerIdx = reversed.findIndex(m => m.fromMe)
    const lastClientIdx = reversed.findIndex(m => !m.fromMe)

    if (lastSellerIdx !== -1 && (lastClientIdx === -1 || lastSellerIdx < lastClientIdx)) {
      const sellerMsg = selected[selected.length - 1 - lastSellerIdx]
      const sellerDiffMs = now.getTime() - new Date(sellerMsg.timestamp).getTime()
      const sellerDiffHours = Math.floor(sellerDiffMs / (1000 * 60 * 60))
      const sellerDiffDays = Math.floor(sellerDiffMs / (1000 * 60 * 60 * 24))
      if (sellerDiffHours > 2) {
        const vacuoTime = sellerDiffDays > 0 ? `${sellerDiffDays} dia(s)` : `${sellerDiffHours} hora(s)`
        analysis += `SITUACAO: CLIENTE NAO RESPONDEU a ultima mensagem do vendedor (ha ${vacuoTime}). O vendedor esta tentando retomar contato.\n`
      } else {
        analysis += `SITUACAO: Vendedor mandou a ultima mensagem (recente). Aguardando resposta do cliente.\n`
      }
    } else if (lastClientIdx !== -1 && (lastSellerIdx === -1 || lastClientIdx < lastSellerIdx)) {
      analysis += `SITUACAO: Cliente respondeu e aguarda resposta do vendedor (lead QUENTE).\n`
    }
  }

  // Format messages
  const lines = selected.map(m => {
    const sender = m.fromMe ? 'Vendedor' : clientName
    const dateStr = m.date || new Date(m.timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    const timeStr = m.time || new Date(m.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    let content = m.body
    if (!content && m.type !== 'text') {
      const labels = { image: '[Imagem]', audio: '[Audio]', video: '[Video]', document: '[Documento]', sticker: '[Sticker]' }
      content = labels[m.type] || `[${m.type}]`
    }
    if (!content) content = `[${m.type}]`
    return `[${dateStr} ${timeStr}] ${sender}: ${content}`
  })

  return analysis + '\n' + lines.join('\n')
}

// ============================================================
// EXTRACT CLEAN MESSAGE (for sending to WhatsApp)
// ============================================================

function extractCleanMessage(text) {
  // Remove visual tags
  let cleaned = text.replace(/\{\{(NOTA|BARRA|TENDENCIA|AGENDAR):[^}]+\}\}/g, '').replace(/\n{3,}/g, '\n\n').trim()

  // Try to find quoted messages
  const quoteMatches = cleaned.match(/"([^"]+)"/g) || cleaned.match(/«([^»]+)»/g) || cleaned.match(/\u201c([^\u201d]+)\u201d/g)
  if (quoteMatches && quoteMatches.length > 0) {
    const longest = quoteMatches
      .map(q => q.replace(/^["«\u201c]|["»\u201d]$/g, ''))
      .sort((a, b) => b.length - a.length)[0]
    if (longest && longest.length > 20) return longest
  }

  // Remove AI prefixes
  cleaned = cleaned
    .replace(/^(sugest[ãa]o\s*(de\s*)?mensagem|mensagem\s*sugerida|resposta\s*sugerida|aqui\s*vai|tente\s*(algo\s*como|enviar|responder)|segue|minha\s*sugest[ãa]o)[^:]*:\s*/i, '')
    .replace(/^\*\*[^*]+\*\*\s*:?\s*/, '')
    .trim()

  // Remove surrounding quotes
  cleaned = cleaned.replace(/^["'\u201c\u201d«]|["'\u201c\u201d»]$/g, '').trim()
  return cleaned
}

// ============================================================
// SEND MESSAGE
// ============================================================

async function sendMessage(text) {
  if (!text.trim() || isSending) return

  if (!accessToken || !userId) {
    switchToChatMode()
    addAIMessage('Faca login na plataforma Ramppy primeiro para usar o copiloto.', null)
    return
  }

  isSending = true
  disableInputs(true)
  switchToChatMode()

  welcomeInput.value = ''
  chatInput.value = ''

  addUserMessage(text)
  showTyping()
  copilotHistory.push({ role: 'user', content: text })

  try {
    const conversationContext = formatConversationContext()

    const res = await fetch(`${API_BASE}/api/copilot/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        userMessage: text,
        conversationContext,
        contactPhone: waContext.contactPhone || 'unknown',
        contactName: waContext.contactName || 'Cliente',
        copilotHistory: copilotHistory.slice(-10).map(m => ({ role: m.role, content: m.content })),
      }),
    })

    removeTyping()

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || `Erro ${res.status}`)
    }

    const data = await res.json()
    const reply = data.suggestion || 'Sem sugestao.'
    const feedbackId = data.feedbackId || null

    addAIMessage(reply, feedbackId)
    copilotHistory.push({ role: 'assistant', content: reply })
  } catch (err) {
    removeTyping()
    addAIMessage(`Erro: ${err.message}`, null)
  } finally {
    isSending = false
    disableInputs(false)
    chatInput.focus()
  }
}

function disableInputs(disabled) {
  if (btnSend) btnSend.disabled = disabled
  if (btnSendWelcome) btnSendWelcome.disabled = disabled
}

// ============================================================
// ACTION HANDLERS (global for onclick)
// ============================================================

window.sendToWhatsApp = function (btn) {
  const msgAi = btn.closest('.msg-ai')
  const raw = msgAi?.dataset.raw || msgAi?.textContent || ''
  const cleaned = extractCleanMessage(raw)

  if (window.electronAPI && window.electronAPI.injectWhatsAppText) {
    window.electronAPI.injectWhatsAppText(cleaned)
    btn.classList.add('sent')
    btn.disabled = true
    const origHtml = btn.innerHTML
    btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Enviado!'
    showActionHints = false
  }
}

window.copyMessage = function (btn) {
  const msgAi = btn.closest('.msg-ai')
  const raw = msgAi?.dataset.raw || msgAi?.textContent || ''
  const cleaned = extractCleanMessage(raw)

  navigator.clipboard.writeText(cleaned).then(() => {
    const origHtml = btn.innerHTML
    btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Copiado!'
    setTimeout(() => { btn.innerHTML = origHtml }, 1500)
  })
}

window.handleFeedback = async function (btn, wasHelpful) {
  const feedbackId = btn.dataset.feedbackId
  if (!feedbackId || feedbackStates[feedbackId]) return

  feedbackStates[feedbackId] = wasHelpful ? 'up' : 'down'
  showActionHints = false

  // Update UI
  const actionsDiv = btn.closest('.msg-actions')
  if (actionsDiv) {
    const upBtn = actionsDiv.querySelector('.btn-feedback-up')
    const downBtn = actionsDiv.querySelector('.btn-feedback-down')
    if (wasHelpful && upBtn) { upBtn.classList.add('active-up'); upBtn.disabled = true }
    if (!wasHelpful && downBtn) { downBtn.classList.add('active-down'); downBtn.disabled = true }
    if (upBtn) upBtn.disabled = true
    if (downBtn) downBtn.disabled = true
  }

  // Send feedback to API
  try {
    await fetch(`${API_BASE}/api/copilot/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ feedbackId, wasHelpful }),
    })
  } catch (_) {
    // Silent fail
  }
}

// ============================================================
// RICH CONTENT RENDERER
// ============================================================

function renderRichContent(content) {
  // Process visual tags first
  let text = content
    .replace(/\{\{NOTA:([^}]+)\}\}/g, (_, score) => {
      const s = parseFloat(score)
      const cls = s >= 7 ? 'score-green' : s >= 5 ? 'score-yellow' : 'score-red'
      return `<span class="score-badge ${cls}">${score}/10</span>`
    })
    .replace(/\{\{BARRA:([^|]+)\|([^|]+)\|([^}]+)\}\}/g, (_, label, val, max) => {
      const pct = Math.round((parseFloat(val) / parseFloat(max)) * 100)
      const s = parseFloat(val)
      const color = s >= 7 ? '#22c55e' : s >= 5 ? '#eab308' : '#ef4444'
      return `<div style="margin:6px 0;"><div style="font-size:11px;color:#8696a0;margin-bottom:2px;">${escapeHtml(label)} (${val}/${max})</div><div style="height:6px;background:#2a3942;border-radius:3px;overflow:hidden;"><div style="height:100%;width:${pct}%;background:${color};border-radius:3px;"></div></div></div>`
    })
    .replace(/\{\{TENDENCIA:([^}]+)\}\}/g, (_, trend) => {
      const t = trend.toLowerCase()
      const cls = t.includes('quente') ? 'trend-quente' : t.includes('frio') ? 'trend-frio' : 'trend-morno'
      return `<span class="trend-badge ${cls}">${escapeHtml(trend)}</span>`
    })
    .replace(/\{\{AGENDAR:[^}]+\}\}/g, '') // Remove calendar tags in desktop

  // Highlight quoted suggestions
  text = text.replace(/"([^"]{10,})"/g, '<div class="quoted-msg">$1</div>')

  // Parse markdown-like content
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
    .replace(/`(.+?)`/g, '<code style="background:#1a2730;padding:1px 4px;border-radius:3px;font-size:12px;color:#00a884;">$1</code>')
}

// ============================================================
// WHATSAPP STATE LISTENER
// ============================================================

if (window.electronAPI && window.electronAPI.onWhatsAppState) {
  window.electronAPI.onWhatsAppState((data) => {
    waContext = data

    if (data.active && data.contactName) {
      onContactChange(data.contactName)
      // Make sure welcome or chat is showing (not no-conversation)
      if (!hasMessages) {
        showWelcome()
      }
    } else if (!data.active || !data.contactName) {
      currentContact = null
      headerContact.style.display = 'none'
      showNoConversation()
    }

    // Handle conversation change within same session
    if (data.conversationChanged && data.contactName) {
      onContactChange(data.contactName)
    }
  })
}

// Check initial state on load
if (window.electronAPI && window.electronAPI.getWhatsAppState) {
  window.electronAPI.getWhatsAppState().then((data) => {
    if (data && data.active && data.contactName) {
      waContext = data
      onContactChange(data.contactName)
    } else {
      showNoConversation()
    }
  })
} else {
  showNoConversation()
}

// ============================================================
// EVENT LISTENERS
// ============================================================

btnSend.addEventListener('click', () => sendMessage(chatInput.value))
btnSendWelcome.addEventListener('click', () => sendMessage(welcomeInput.value))

chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(chatInput.value) }
})

welcomeInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(welcomeInput.value) }
})

// Suggestion cards (welcome)
document.querySelectorAll('.suggestion-card').forEach(btn => {
  btn.addEventListener('click', () => sendMessage(btn.dataset.msg))
})

// Quick pills (chat mode)
document.querySelectorAll('.pill').forEach(btn => {
  btn.addEventListener('click', () => sendMessage(btn.dataset.msg))
})

// Back button (reset to welcome)
btnBack.addEventListener('click', () => {
  resetChat()
})
