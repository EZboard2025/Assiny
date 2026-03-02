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

// Per-contact chat cache: contactName → { history, feedbackStates, sentMsgIds, showActionHints, messagesHtml }
const contactCache = new Map()

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
const btnToggle = document.getElementById('btn-toggle')
const collapsedBar = document.getElementById('collapsed-bar')
const btnExpand = document.getElementById('btn-expand')
const copilotHeader = document.querySelector('.copilot-header')

let isCopilotExpanded = true

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
  // Never reset to welcome while sending or revealing a response
  if (isSending || revealTimer) return
  messagesArea.style.display = 'flex'
  welcomeState.style.display = 'flex'
  noConversation.style.display = 'none'
  chatPills.style.display = 'none'
  chatInputBar.style.display = 'none'
  hasMessages = false
}

function showNoConversation() {
  // Never reset while sending or revealing a response
  if (isSending || revealTimer) return
  messagesArea.style.display = 'none'
  welcomeState.style.display = 'none'
  noConversation.style.display = 'flex'
  chatPills.style.display = 'none'
  chatInputBar.style.display = 'none'
  hasMessages = false
}

function switchToChatMode() {
  if (hasMessages) return
  hasMessages = true
  messagesArea.style.display = 'flex'
  welcomeState.style.display = 'none'
  noConversation.style.display = 'none'
  chatPills.style.display = 'flex'
  chatInputBar.style.display = 'block'
  chatInput.focus()
}

function resetChat() {
  // Cancel any in-progress reveal
  if (revealTimer) { clearTimeout(revealTimer); revealTimer = null }
  // Remove cached state for this contact (explicit reset)
  if (currentContact) contactCache.delete(currentContact)
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

function saveCurrentContactState() {
  if (!currentContact || !hasMessages) return
  contactCache.set(currentContact, {
    history: [...copilotHistory],
    feedbackStates: { ...feedbackStates },
    sentMsgIds: new Set(sentMsgIds),
    showActionHints,
    messagesHtml: messagesArea.innerHTML,
  })
  // Cap cache at 20 contacts to prevent memory bloat
  if (contactCache.size > 20) {
    const oldest = contactCache.keys().next().value
    contactCache.delete(oldest)
  }
}

function restoreContactState(contactName) {
  const cached = contactCache.get(contactName)
  if (!cached) return false

  copilotHistory = [...cached.history]
  feedbackStates = { ...cached.feedbackStates }
  sentMsgIds = new Set(cached.sentMsgIds)
  showActionHints = cached.showActionHints
  hasMessages = true

  // Restore DOM
  messagesArea.innerHTML = cached.messagesHtml
  welcomeState.style.display = 'none'
  noConversation.style.display = 'none'
  chatPills.style.display = 'flex'
  chatInputBar.style.display = 'block'
  messagesArea.scrollTop = messagesArea.scrollHeight
  return true
}

function onContactChange(contactName) {
  if (contactName === currentContact) return

  // If actively sending or revealing, defer the contact change
  if (isSending || revealTimer) {
    // Just update header — don't reset chat mid-response
    if (contactName) {
      contactNameEl.textContent = contactName
      headerContact.style.display = 'flex'
    }
    currentContact = contactName
    return
  }

  // Save current contact's chat state before switching
  saveCurrentContactState()

  currentContact = contactName

  // Update header
  if (contactName) {
    contactNameEl.textContent = contactName
    headerContact.style.display = 'flex'
  } else {
    headerContact.style.display = 'none'
  }

  // Cancel any in-progress reveal
  if (revealTimer) { clearTimeout(revealTimer); revealTimer = null }

  // Try to restore cached state for this contact
  if (contactName && restoreContactState(contactName)) {
    return // Restored from cache — done
  }

  // No cache — fresh start
  copilotHistory = []
  feedbackStates = {}
  sentMsgIds = new Set()
  showActionHints = true
  hasMessages = false
  messagesArea.innerHTML = ''
  messagesArea.appendChild(welcomeState)
  showWelcome()
}

// ============================================================
// MESSAGE RENDERING
// ============================================================

function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

// Reveal timer ref (to cancel on new message)
let revealTimer = null

function addUserMessage(text) {
  const div = document.createElement('div')
  div.className = 'msg-user-wrap msg-fade-in'
  div.innerHTML = `<div class="msg-user">${escapeHtml(text)}</div>`
  messagesArea.appendChild(div)
  messagesArea.scrollTop = messagesArea.scrollHeight
}

function addAIMessage(content, feedbackId) {
  const wrap = document.createElement('div')
  wrap.className = 'msg-ai-wrap msg-fade-in'
  const msgId = `ai_${Date.now()}`

  // Build action buttons (hidden during reveal, shown after)
  const actionsHtml = buildActionsHtml(msgId, feedbackId)

  // Start with empty content — will be progressively revealed
  wrap.innerHTML = `<div class="ai-avatar thinking"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z"/></svg></div><div class="msg-ai" data-raw="${escapeHtml(content)}"></div>`
  messagesArea.appendChild(wrap)
  messagesArea.scrollTop = messagesArea.scrollHeight

  // Progressive word-by-word reveal
  const msgEl = wrap.querySelector('.msg-ai')
  const avatarEl = wrap.querySelector('.ai-avatar')
  const steps = getRevealSteps(content)

  if (steps.length === 0) {
    // Empty content — just show actions
    msgEl.innerHTML = renderRichContent(content) + actionsHtml
    avatarEl.classList.remove('thinking')
    return
  }

  let current = 0
  if (revealTimer) clearTimeout(revealTimer)

  const revealNext = () => {
    current++
    const visibleText = current <= steps.length ? content.slice(0, steps[Math.min(current - 1, steps.length - 1)].pos) : content
    msgEl.innerHTML = renderRichContent(visibleText)
    messagesArea.scrollTop = messagesArea.scrollHeight

    if (current < steps.length) {
      const delay = steps[current].isNewline ? 120 : 25 + Math.random() * 20
      revealTimer = setTimeout(revealNext, delay)
    } else {
      // Reveal complete — show actions, remove thinking animation
      msgEl.innerHTML = renderRichContent(content) + actionsHtml
      avatarEl.classList.remove('thinking')
      messagesArea.scrollTop = messagesArea.scrollHeight
      revealTimer = null
    }
  }

  revealTimer = setTimeout(revealNext, 50)
}

function buildActionsHtml(msgId, feedbackId) {
  let html = `<div class="msg-actions" data-msg-id="${msgId}">`

  html += `
    <button class="btn-action btn-send-wa" data-msg-id="${msgId}" title="Enviar para o chat" onclick="sendToWhatsApp(this)">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
      Enviar
    </button>`

  html += `
    <button class="btn-action" title="Copiar" onclick="copyMessage(this)">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
      Copiar
    </button>`

  if (feedbackId) {
    html += `
      <button class="btn-action btn-feedback-up" data-feedback-id="${feedbackId}" title="Útil" onclick="handleFeedback(this, true)">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z"/><path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/></svg>
      </button>
      <button class="btn-action btn-feedback-down" data-feedback-id="${feedbackId}" title="Não útil" onclick="handleFeedback(this, false)">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10z"/><path d="M17 2h3a2 2 0 012 2v7a2 2 0 01-2 2h-3"/></svg>
      </button>`
  }

  html += '</div>'
  return html
}

// Compute reveal steps — each step is a word position (tags count as one step)
function getRevealSteps(text) {
  const steps = []
  let i = 0
  while (i < text.length) {
    if (text[i] === '\n') {
      i++
      steps.push({ pos: i, isNewline: true })
      continue
    }
    if (/\s/.test(text[i])) { i++; continue }
    // Visual tag — reveal entire tag as one step
    if (text[i] === '{' && text[i + 1] === '{') {
      const tagMatch = text.slice(i).match(/^\{\{(NOTA|BARRA|TENDENCIA|AGENDAR):[^}]+\}\}/)
      if (tagMatch) {
        i += tagMatch[0].length
        steps.push({ pos: i, isNewline: false })
        continue
      }
    }
    // Regular word — advance to next whitespace
    while (i < text.length && !/\s/.test(text[i])) i++
    steps.push({ pos: i, isNewline: false })
  }
  return steps
}

function showTyping() {
  const wrap = document.createElement('div')
  wrap.className = 'typing-wrap msg-fade-in'
  wrap.id = 'typing-indicator'
  wrap.innerHTML = `<div class="ai-avatar thinking"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z"/></svg></div><div class="typing-bubble"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>`
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

  // Check if timestamps are reliable (0 = unknown/unparsed)
  const hasReliableTimestamps = selected.some(m => m.timestamp > 1000000000000) // After year 2001 in ms

  // Build analysis header
  let analysis = `DATA E HORA ATUAL: ${now.toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}, ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}\n`

  if (selected.length > 0 && hasReliableTimestamps) {
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
  } else if (selected.length > 0) {
    // Timestamps unreliable — use display dates/times from scraper if available
    const lastMsg = selected[selected.length - 1]
    if (lastMsg.date) {
      analysis += `ULTIMA MENSAGEM: ${lastMsg.fromMe ? 'Vendedor' : clientName}, data: ${lastMsg.date} ${lastMsg.time || ''}\n`

      // Try to calculate time difference from display date
      const dateParts = lastMsg.date.split('/')
      if (dateParts.length === 3) {
        let year = dateParts[2]
        if (year.length === 2) year = '20' + year
        const msgDate = new Date(`${year}-${dateParts[1].padStart(2, '0')}-${dateParts[0].padStart(2, '0')}`)
        if (!isNaN(msgDate.getTime())) {
          const diffDays = Math.floor((now.getTime() - msgDate.getTime()) / (1000 * 60 * 60 * 24))
          if (diffDays > 0) {
            analysis += `SITUACAO: Ultima interacao ha ${diffDays} dia(s).\n`
          }
        }
      }
    } else {
      analysis += `ULTIMA MENSAGEM: ${lastMsg.fromMe ? 'Vendedor' : clientName} (data exata indisponivel)\n`
      analysis += `NOTA: As datas exatas das mensagens nao puderam ser extraidas. Analise o conteudo da conversa para inferir o contexto temporal.\n`
    }

    // Still try to detect who sent the last message
    const reversed = [...selected].reverse()
    const lastSellerIdx = reversed.findIndex(m => m.fromMe)
    const lastClientIdx = reversed.findIndex(m => !m.fromMe)
    if (lastSellerIdx !== -1 && (lastClientIdx === -1 || lastSellerIdx < lastClientIdx)) {
      analysis += `SITUACAO: Vendedor mandou a ultima mensagem. Aguardando resposta do cliente.\n`
    } else if (lastClientIdx !== -1 && (lastSellerIdx === -1 || lastClientIdx < lastSellerIdx)) {
      analysis += `SITUACAO: Cliente respondeu e aguarda resposta do vendedor.\n`
    }
  }

  // Format messages
  const lines = selected.map(m => {
    const sender = m.fromMe ? 'Vendedor' : clientName
    let dateStr = m.date || ''
    let timeStr = m.time || ''

    // Only use timestamp-derived date/time if timestamp is reliable
    if (!dateStr && m.timestamp > 1000000000000) {
      dateStr = new Date(m.timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    }
    if (!timeStr && m.timestamp > 1000000000000) {
      timeStr = new Date(m.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    }

    let content = m.body
    if (!content && m.type !== 'text') {
      const labels = { image: '[Imagem]', audio: '[Audio]', video: '[Video]', document: '[Documento]', sticker: '[Sticker]' }
      content = labels[m.type] || `[${m.type}]`
    }
    if (!content) content = `[${m.type}]`

    const timeLabel = dateStr && timeStr ? `${dateStr} ${timeStr}` : timeStr || dateStr || '??'
    return `[${timeLabel}] ${sender}: ${content}`
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

  // Debug command: show what messages the scraper extracted
  if (text.trim() === '!debug') {
    switchToChatMode()
    welcomeInput.value = ''
    chatInput.value = ''
    addUserMessage('!debug')
    const msgs = waContext.messages || []
    const reliableCount = msgs.filter(m => m.timestamp > 1000000000000).length
    const dbg = waContext._debugInfo || {}
    let debugInfo = `**Contexto WhatsApp**\n`
    debugInfo += `- Ativo: ${waContext.active}\n`
    debugInfo += `- Contato: ${waContext.contactName || 'nenhum'}\n`
    debugInfo += `- Telefone: ${waContext.contactPhone || 'n/a'}\n`
    debugInfo += `- Mensagens: ${msgs.length}\n`
    debugInfo += `- Timestamps confiaveis: ${reliableCount}/${msgs.length}\n`
    debugInfo += `- Date headers encontrados: ${dbg.dateHeadersFound || 0}\n`
    if (dbg.dateHeaderDates?.length > 0) {
      debugInfo += `- Datas dos headers: ${dbg.dateHeaderDates.join(', ')}\n`
    }
    debugInfo += `\n`

    // Show raw data-pre-plain-text samples
    if (dbg.prePlainSamples?.length > 0) {
      debugInfo += `**data-pre-plain-text (primeiras ${dbg.prePlainSamples.length} msgs):**\n`
      dbg.prePlainSamples.forEach((s, i) => {
        debugInfo += `- raw: \`${s.raw || '[vazio]'}\`\n`
        debugInfo += `  parsed: time=${s.time || 'null'}, date=${s.date || 'null'}, sender=${s.sender || 'null'}\n`
      })
      debugInfo += `\n`
    }

    if (msgs.length > 0) {
      debugInfo += `**Ultimas 10 mensagens:**\n`
      const last10 = msgs.slice(-10)
      last10.forEach((m, i) => {
        const dir = m.fromMe ? 'OUT' : 'IN'
        const body = (m.body || '').substring(0, 60)
        const tsInfo = m.timestamp > 1000000000000 ? new Date(m.timestamp).toLocaleString('pt-BR') : (m.timestamp === 0 ? 'DESCONHECIDO' : `ts=${m.timestamp}`)
        debugInfo += `- [${m.date || '??'} ${m.time || '??'}] ${dir}: ${body || '[vazio]'}\n`
        debugInfo += `  ts: ${tsInfo}\n`
      })
    }
    debugInfo += `\n**Contexto formatado (primeiros 600 chars):**\n`
    debugInfo += '`' + formatConversationContext().substring(0, 600) + '`'
    addAIMessage(debugInfo, null)
    return
  }

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
  // Strip calendar tags (not supported in desktop)
  let text = content.replace(/\{\{AGENDAR:[^}]+\}\}/g, '')

  // Parse markdown-like content
  // NOTE: visual tags (NOTA, BARRA, TENDENCIA) are processed in formatInline/formatVisualTags
  // AFTER escapeHtml, so they don't get double-escaped
  const lines = text.split('\n')
  let html = ''
  let inList = false

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      if (inList) { html += '</div>'; inList = false }
      continue
    }

    // Standalone quoted message (entire line is "..." or \u201c...\u201d)
    const quoteMatch = trimmed.match(/^(?:"|[\u201c])(.{10,})(?:"|[\u201d])$/)
    if (quoteMatch) {
      if (inList) { html += '</div>'; inList = false }
      html += `<div class="quoted-msg">${escapeHtml(quoteMatch[1])}</div>`
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
  let escaped = escapeHtml(text)
  // 1. Quoted suggestions FIRST (on plain escaped text — no HTML attributes to match)
  escaped = escaped.replace(/\u201c([^\u201d]{10,}?)\u201d/g, '<span class="quoted-msg">$1</span>')
  escaped = escaped.replace(/"([^"<>]{10,}?)"/g, '<span class="quoted-msg">$1</span>')
  // 2. Visual tags AFTER quotes (generates HTML with "..." in attributes — safe now)
  escaped = formatVisualTags(escaped)
  // 3. Markdown formatting last
  return escaped
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code style="background:#f0fdf9;padding:1px 4px;border-radius:3px;font-size:12px;color:#059669;">$1</code>')
}

// Process visual tags on already-escaped text (safe — no double-escaping)
function formatVisualTags(escaped) {
  return escaped
    .replace(/\{\{NOTA:([^}]+)\}\}/g, (_, score) => {
      const s = parseFloat(score)
      const cls = s >= 7 ? 'score-green' : s >= 5 ? 'score-yellow' : 'score-red'
      return `<span class="score-badge ${cls}">${score}/10</span>`
    })
    .replace(/\{\{BARRA:([^|]+)\|([^|]+)\|([^}]+)\}\}/g, (_, label, val, max) => {
      const pct = Math.round((parseFloat(val) / parseFloat(max)) * 100)
      const s = parseFloat(val)
      const color = s >= 7 ? '#22c55e' : s >= 5 ? '#eab308' : '#ef4444'
      return `<div style="margin:6px 0;"><div style="font-size:11px;color:#9ca3af;margin-bottom:2px;">${label} (${val}/${max})</div><div style="height:6px;background:#e5e7eb;border-radius:3px;overflow:hidden;"><div style="height:100%;width:${pct}%;background:${color};border-radius:3px;"></div></div></div>`
    })
    .replace(/\{\{TENDENCIA:([^}]+)\}\}/g, (_, trend) => {
      const t = trend.toLowerCase()
      const cls = t.includes('quente') ? 'trend-quente' : t.includes('frio') ? 'trend-frio' : 'trend-morno'
      return `<span class="trend-badge ${cls}">${trend}</span>`
    })
}

// ============================================================
// WHATSAPP STATE LISTENER
// ============================================================

let inactiveTimer = null // debounce inactive transitions

if (window.electronAPI && window.electronAPI.onWhatsAppState) {
  window.electronAPI.onWhatsAppState((data) => {
    waContext = data

    if (data.active && data.contactName) {
      // Cancel any pending inactive transition
      if (inactiveTimer) { clearTimeout(inactiveTimer); inactiveTimer = null }
      onContactChange(data.contactName)
      // Only show welcome if no messages AND not mid-response
      if (!hasMessages && !isSending && !revealTimer) {
        noConversation.style.display = 'none'
        welcomeState.style.display = 'flex'
      }
    } else if (!data.active || !data.contactName) {
      // Debounce: wait 2s before showing "no conversation" (avoids flicker from DOM mutations)
      if (!inactiveTimer) {
        inactiveTimer = setTimeout(() => {
          inactiveTimer = null
          if (!isSending && !revealTimer) {
            currentContact = null
            headerContact.style.display = 'none'
            showNoConversation()
          }
        }, 2000)
      }
    }

    // Handle explicit conversation change
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

// ============================================================
// COPILOT TOGGLE (minimize/expand)
// ============================================================

function collapseCopilot() {
  isCopilotExpanded = false
  copilotHeader.style.display = 'none'
  messagesArea.style.display = 'none'
  chatPills.style.display = 'none'
  chatInputBar.style.display = 'none'
  noConversation.style.display = 'none'
  collapsedBar.style.display = 'flex'
}

function expandCopilot() {
  isCopilotExpanded = true
  collapsedBar.style.display = 'none'
  copilotHeader.style.display = 'flex'
  // Restore correct content state
  if (currentContact && hasMessages) {
    messagesArea.style.display = 'flex'
    chatPills.style.display = 'flex'
    chatInputBar.style.display = 'block'
  } else if (currentContact) {
    messagesArea.style.display = 'flex'
    welcomeState.style.display = 'flex'
  } else {
    noConversation.style.display = 'flex'
  }
}

btnToggle.addEventListener('click', () => {
  if (window.electronAPI && window.electronAPI.toggleCopilot) {
    window.electronAPI.toggleCopilot()
  }
})

btnExpand.addEventListener('click', () => {
  if (window.electronAPI && window.electronAPI.toggleCopilot) {
    window.electronAPI.toggleCopilot()
  }
})

// Listen for toggle state from main process
if (window.electronAPI && window.electronAPI.onCopilotToggled) {
  window.electronAPI.onCopilotToggled((isOpen) => {
    if (isOpen) {
      expandCopilot()
    } else {
      collapseCopilot()
    }
  })
}
