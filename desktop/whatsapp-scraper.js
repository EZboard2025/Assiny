// ============================================================
// WhatsApp Web DOM Scraper
// Injected into WhatsApp Web via whatsapp-preload.js
// Extracts conversation data and sends to Electron main process
// ============================================================

// --- Selectors (update these when WhatsApp Web changes DOM) ---
// Multiple selectors per element for resilience against DOM updates
const SELECTORS = {
  // Conversation panel (right side with messages)
  conversationPanel: '#main',
  // Contact name in conversation header (multiple fallbacks)
  contactHeader: '#main header span[title]',
  contactHeaderAlt: '#main header [data-testid="conversation-info-header-chat-title"]',
  contactHeaderAlt2: '#main header [data-testid="conversation-title"]',
  // Message rows (parent container for each message)
  messageRow: 'div.message-in, div.message-out',
  messageRowAlt: '[data-testid="msg-container"]',
  // Message text content (multiple fallbacks)
  messageText: 'span.selectable-text',
  messageTextAlt: '[data-testid="msg-text"]',
  // Timestamp + sender metadata
  messagePrePlain: '[data-pre-plain-text]',
  // Image messages
  messageImage: 'img[src*="blob:"], [data-testid="image-thumb"]',
  // Audio/PTT messages
  messageAudio: '[data-testid="audio-play"], [data-testid="ptt-play"], [data-testid="audio-seekbar"]',
  // Video messages
  messageVideo: '[data-testid="media-state-video"], [data-testid="video-content"]',
  // Document messages
  messageDocument: '[data-testid="document-thumb"], [data-testid="document-message"]',
  // Sticker messages
  messageSticker: 'img.sticker, [data-testid="sticker"]',
  // WhatsApp input field (contenteditable)
  inputField: '#main footer div[contenteditable="true"]',
  inputFieldAlt: '#main [data-testid="conversation-compose-box-input"]',
  inputFieldAlt2: '[data-testid="compose-box"] div[contenteditable="true"]',
  // Messages container (for MutationObserver)
  messagesContainer: '#main [role="application"]',
  messagesContainerAlt: '#main div.message-list',
  messagesContainerAlt2: '[data-testid="conversation-panel-messages"]',
}

// --- State ---
let lastContactName = null
let lastMessageCount = 0
let observer = null
let debounceTimer = null
const DEBOUNCE_MS = 800

// --- Helper: try multiple selectors ---
function querySelector(parent, ...selectors) {
  for (const sel of selectors) {
    const el = parent.querySelector(sel)
    if (el) return el
  }
  return null
}

function querySelectorAll(parent, ...selectors) {
  for (const sel of selectors) {
    const els = parent.querySelectorAll(sel)
    if (els.length > 0) return els
  }
  return []
}

// --- Extract contact name from conversation header ---
function getContactName() {
  const el = querySelector(document, SELECTORS.contactHeader, SELECTORS.contactHeaderAlt, SELECTORS.contactHeaderAlt2)
  if (!el) return null
  return el.textContent?.trim() || el.getAttribute('title')?.trim() || null
}

// --- Extract phone from contact info or header ---
function getContactPhone() {
  // WhatsApp Web sometimes shows phone in the header title
  const name = getContactName()
  if (!name) return null
  // Check if name looks like a phone number (starts with + or digits)
  if (/^[\d+\s()-]+$/.test(name.replace(/\s/g, ''))) {
    return name.replace(/\s/g, '')
  }
  // Otherwise try to get from the subtitle/status area
  const subtitle = querySelector(document,
    '#main header span[title] + span',
    '#main header [data-testid="conversation-info-header-chat-subtitle"]'
  )
  if (subtitle) {
    const text = subtitle.textContent?.trim() || ''
    if (/^[\d+\s()-]+$/.test(text.replace(/[^\d+]/g, ''))) {
      return text.replace(/[^\d+]/g, '')
    }
  }
  return name // fallback: use name as identifier
}

// --- Determine message type ---
function getMessageType(msgEl) {
  if (msgEl.querySelector(SELECTORS.messageAudio)) return 'audio'
  if (msgEl.querySelector(SELECTORS.messageVideo)) return 'video'
  if (msgEl.querySelector(SELECTORS.messageDocument)) return 'document'
  if (msgEl.querySelector(SELECTORS.messageSticker)) return 'sticker'
  if (msgEl.querySelector(SELECTORS.messageImage)) return 'image'
  return 'text'
}

// --- Parse timestamp from data-pre-plain-text ---
// Format: "[HH:MM, DD/MM/YYYY] ContactName: " or "[HH:MM, DD/MM/YYYY] "
function parseTimestamp(prePlainText) {
  if (!prePlainText) return { time: null, date: null, sender: null }

  const match = prePlainText.match(/\[(\d{1,2}:\d{2}),?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})\]\s*(.+?):\s*$/)
  if (match) {
    return { time: match[1], date: match[2], sender: match[3].trim() }
  }

  // Fallback: just time
  const timeMatch = prePlainText.match(/\[(\d{1,2}:\d{2})/)
  if (timeMatch) {
    return { time: timeMatch[1], date: null, sender: null }
  }

  return { time: null, date: null, sender: null }
}

// --- Extract all messages from current conversation ---
function extractMessages() {
  const panel = document.querySelector(SELECTORS.conversationPanel)
  if (!panel) return []

  let rows = querySelectorAll(panel, SELECTORS.messageRow)
  // Fallback: try data-testid based selector
  if (rows.length === 0) {
    rows = querySelectorAll(panel, SELECTORS.messageRowAlt)
  }
  const messages = []

  rows.forEach(row => {
    const isOutgoing = row.classList.contains('message-out') || row.closest?.('.message-out') !== null
    const type = getMessageType(row)

    // Get text content (try multiple selectors)
    let textEl = row.querySelector(SELECTORS.messageText)
    if (!textEl) textEl = row.querySelector(SELECTORS.messageTextAlt)
    let body = textEl ? textEl.textContent?.trim() : ''

    // For non-text messages without text, add label
    if (!body && type !== 'text') {
      const labels = { image: '[Imagem]', audio: '[Áudio]', video: '[Vídeo]', document: '[Documento]', sticker: '[Sticker]' }
      body = labels[type] || `[${type}]`
    }

    // Get timestamp from data-pre-plain-text
    const prePlainEl = row.querySelector(SELECTORS.messagePrePlain)
    const prePlainText = prePlainEl ? prePlainEl.getAttribute('data-pre-plain-text') : ''
    const { time, date, sender } = parseTimestamp(prePlainText)

    // Build timestamp (combine date + time into Date object)
    let timestamp = null
    if (date && time) {
      const parts = date.split('/')
      if (parts.length === 3) {
        let year = parts[2]
        if (year.length === 2) year = '20' + year
        // DD/MM/YYYY format
        timestamp = new Date(`${year}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}T${time}:00`).getTime()
      }
    }
    if (!timestamp) {
      timestamp = Date.now() // fallback
    }

    messages.push({
      body,
      fromMe: isOutgoing,
      timestamp,
      time: time || '',
      date: date || '',
      type,
      sender: sender || (isOutgoing ? 'Vendedor' : getContactName() || 'Cliente'),
    })
  })

  return messages
}

// --- Send context update to Electron ---
function sendUpdate() {
  const contactName = getContactName()
  if (!contactName) {
    // No conversation open
    if (lastContactName !== null) {
      lastContactName = null
      lastMessageCount = 0
      if (window.ramppy) {
        window.ramppy.sendContext({ active: false, contactName: null, contactPhone: null, messages: [] })
      }
    }
    return
  }

  const messages = extractMessages()
  const contactPhone = getContactPhone()

  // Detect conversation change
  const conversationChanged = contactName !== lastContactName
  lastContactName = contactName
  lastMessageCount = messages.length

  if (window.ramppy) {
    window.ramppy.sendContext({
      active: true,
      contactName,
      contactPhone,
      messages,
      conversationChanged,
    })
  }
}

// --- Debounced update ---
function debouncedUpdate() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(sendUpdate, DEBOUNCE_MS)
}

// --- Setup MutationObserver on messages container ---
function setupObserver() {
  // Disconnect existing observer
  if (observer) {
    observer.disconnect()
    observer = null
  }

  const container = querySelector(document,
    SELECTORS.messagesContainer,
    SELECTORS.messagesContainerAlt,
    SELECTORS.messagesContainerAlt2,
    '#main'
  )

  if (!container) return

  observer = new MutationObserver((mutations) => {
    // Check if any mutation involves message elements
    let hasRelevantChange = false
    for (const mutation of mutations) {
      if (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0) {
        hasRelevantChange = true
        break
      }
      // Attribute changes on message elements
      if (mutation.type === 'attributes' && mutation.target.closest?.('.message-in, .message-out')) {
        hasRelevantChange = true
        break
      }
    }

    if (hasRelevantChange) {
      debouncedUpdate()
    }
  })

  observer.observe(container, {
    childList: true,
    subtree: true,
    attributes: false,
  })
}

// --- Watch for conversation panel changes (switching chats) ---
function setupConversationWatcher() {
  const bodyObserver = new MutationObserver(() => {
    const panel = document.querySelector(SELECTORS.conversationPanel)
    const currentContact = getContactName()

    if (currentContact !== lastContactName) {
      // Conversation changed — re-setup observer and send update
      setupObserver()
      sendUpdate()
    }
  })

  bodyObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: false,
  })
}

// --- Inject text into WhatsApp input field ---
function injectText(text) {
  const input = querySelector(document, SELECTORS.inputField, SELECTORS.inputFieldAlt, SELECTORS.inputFieldAlt2)
  if (!input) {
    console.warn('[Ramppy Scraper] Input field not found')
    return false
  }

  // Focus the input
  input.focus()

  // Clear existing content
  input.textContent = ''

  // Use execCommand for compatibility with WhatsApp's contenteditable
  document.execCommand('insertText', false, text)

  // Dispatch input event for WhatsApp to detect the change
  input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }))

  return true
}

// --- Listen for text injection requests ---
if (window.ramppy) {
  window.ramppy.onInjectText((text) => {
    const success = injectText(text)
    console.log(`[Ramppy Scraper] Text injection ${success ? 'successful' : 'failed'}`)
  })
}

// --- Initialize ---
function init() {
  console.log('[Ramppy Scraper] Initializing WhatsApp Web scraper...')

  // Wait for WhatsApp Web to fully load
  const waitForApp = setInterval(() => {
    const panel = document.querySelector(SELECTORS.conversationPanel)
    const sidebar = document.querySelector('[data-testid="chat-list"]') || document.querySelector('#pane-side')

    if (sidebar) {
      clearInterval(waitForApp)
      console.log('[Ramppy Scraper] WhatsApp Web loaded. Setting up observers...')
      setupObserver()
      setupConversationWatcher()
      sendUpdate() // Initial state
    }
  }, 1000)

  // Timeout after 30s
  setTimeout(() => clearInterval(waitForApp), 30000)
}

// Run when DOM is ready (guard against double-injection)
if (!window.__ramppyScraperActive) {
  window.__ramppyScraperActive = true
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
}
