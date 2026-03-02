// ============================================================
// WhatsApp Web DOM Scraper
// Injected into WhatsApp Web via executeJavaScript
// Extracts conversation data and sends to Electron main process
// ============================================================

// --- Selectors (multiple fallbacks for resilience) ---
const SELECTORS = {
  conversationPanel: '#main',
  // Contact name in header — specific data-testid first, generic last
  contactHeader: [
    '#main header [data-testid="conversation-info-header-chat-title"]',
    '#main header [data-testid="conversation-title"]',
    '#main header span[title]',
  ],
  // Message containers — try class-based then data-testid
  messageRow: [
    'div.message-in, div.message-out',
    '[data-testid="msg-container"]',
  ],
  // Message text content (many fallbacks)
  messageText: [
    'span.selectable-text.copyable-text',
    'span.selectable-text',
    'span.copyable-text',
    '[data-testid="msg-text"]',
  ],
  // Timestamp metadata
  messagePrePlain: '[data-pre-plain-text]',
  // Media type detection
  messageImage: 'img[src*="blob:"], [data-testid="image-thumb"], [data-testid="media-url-provider"]',
  messageAudio: '[data-testid="audio-play"], [data-testid="ptt-play"], [data-testid="audio-seekbar"]',
  messageVideo: '[data-testid="media-state-video"], [data-testid="video-content"]',
  messageDocument: '[data-testid="document-thumb"], [data-testid="document-message"]',
  messageSticker: 'img.sticker, [data-testid="sticker"]',
  // Link preview
  messageLinkPreview: '[data-testid="link-preview"], a[href*="http"]',
  // Input field
  inputField: [
    '#main footer div[contenteditable="true"]',
    '#main [data-testid="conversation-compose-box-input"]',
    '[data-testid="compose-box"] div[contenteditable="true"]',
    'footer div[contenteditable="true"]',
  ],
  // Messages container for observer
  messagesContainer: [
    '#main [role="application"]',
    '#main div.message-list',
    '[data-testid="conversation-panel-messages"]',
    '#main',
  ],
}

// --- State (use var to allow safe re-injection via executeJavaScript) ---
var lastContactName = lastContactName || null
var lastMessageCount = lastMessageCount || 0
var observer = observer || null
var debounceTimer = debounceTimer || null
var inactiveCount = inactiveCount || 0
var DEBOUNCE_MS = 800
var INACTIVE_THRESHOLD = 3
var isAutoScanning = isAutoScanning || false

// --- Helpers ---
function trySelect(parent, selectors) {
  const sels = Array.isArray(selectors) ? selectors : [selectors]
  for (const sel of sels) {
    const el = parent.querySelector(sel)
    if (el) return el
  }
  return null
}

function trySelectAll(parent, selectors) {
  const sels = Array.isArray(selectors) ? selectors : [selectors]
  for (const sel of sels) {
    const els = parent.querySelectorAll(sel)
    if (els.length > 0) return Array.from(els)
  }
  return []
}

// --- Contact name ---
const GARBAGE_VALUES = [
  'clique para mostrar os dados do contato',
  'conta comercial',
  'visto por último',
  'online',
  'digitando',
  'gravando áudio',
]

function getContactName() {
  const header = document.querySelector('#main header')
  if (!header) return null

  // Strategy 1: Try each selector and skip garbage matches
  for (const sel of SELECTORS.contactHeader) {
    // Remove '#main header ' prefix since we already have the header element
    const localSel = sel.replace('#main header ', '').replace('#main header', '').trim()
    const el = localSel ? header.querySelector(localSel) : header
    if (el) {
      const title = el.getAttribute('title')?.trim()
      const text = el.textContent?.trim()
      const value = title || text || null
      if (!value) continue

      const lower = value.toLowerCase()
      if (GARBAGE_VALUES.some(g => lower.startsWith(g))) {
        console.log(`[Ramppy Scraper] Skipped garbage from "${sel}": "${value}"`)
        continue // Try next selector
      }

      console.log(`[Ramppy Scraper] Contact name from "${sel}": "${value}"`)
      return value
    }
  }

  // Strategy 2: Find ALL span[title] in header — pick first non-garbage
  const allSpans = header.querySelectorAll('span[title]')
  for (const span of allSpans) {
    const title = span.getAttribute('title')?.trim()
    if (!title) continue
    const lower = title.toLowerCase()
    if (GARBAGE_VALUES.some(g => lower.startsWith(g))) continue
    console.log(`[Ramppy Scraper] Contact name from fallback span[title]: "${title}"`)
    return title
  }

  // Strategy 3: First span[dir="auto"] text in header (usually the name)
  const autoDirSpans = header.querySelectorAll('span[dir="auto"]')
  for (const span of autoDirSpans) {
    const text = span.textContent?.trim()
    if (!text || text.length < 2) continue
    const lower = text.toLowerCase()
    if (GARBAGE_VALUES.some(g => lower.startsWith(g))) continue
    console.log(`[Ramppy Scraper] Contact name from span[dir=auto]: "${text}"`)
    return text
  }

  console.log('[Ramppy Scraper] Could not find contact name in header')
  return null
}

// --- Contact phone ---
function getContactPhone() {
  const name = getContactName()
  if (!name) return null
  if (/^[\d+\s()-]+$/.test(name.replace(/\s/g, ''))) {
    return name.replace(/\s/g, '')
  }
  const subtitle = trySelect(document,
    ['#main header span[title] + span', '#main header [data-testid="conversation-info-header-chat-subtitle"]']
  )
  if (subtitle) {
    const text = subtitle.textContent?.trim() || ''
    if (/^[\d+\s()-]+$/.test(text.replace(/[^\d+]/g, ''))) {
      return text.replace(/[^\d+]/g, '')
    }
  }
  return name
}

// --- Message type detection ---
function getMessageType(msgEl) {
  if (msgEl.querySelector(SELECTORS.messageAudio)) return 'audio'
  if (msgEl.querySelector(SELECTORS.messageVideo)) return 'video'
  if (msgEl.querySelector(SELECTORS.messageDocument)) return 'document'
  if (msgEl.querySelector(SELECTORS.messageSticker)) return 'sticker'
  if (msgEl.querySelector(SELECTORS.messageImage)) return 'image'
  return 'text'
}

// --- Parse timestamp from data-pre-plain-text ---
// WhatsApp Web formats vary by locale and version:
//   PT-BR: "[15:30, 01/03/2026] Nome:"  or  "[15:30] Nome:"  (today's messages)
//   EN:    "[3:30 PM, 1/3/2026] Name:"  or  "[3:30 PM] Name:"
//   Some locales reverse date/time or use different separators
function parseTimestamp(prePlainText) {
  if (!prePlainText) return { time: null, date: null, sender: null }

  // Strip invisible Unicode characters that WhatsApp injects (LRM, RLM, bidi marks, isolates)
  // These break regex matching but are invisible to users
  const cleaned = prePlainText.replace(/[\u200e\u200f\u200b\u200c\u200d\u202a-\u202e\u2066-\u2069\ufeff]/g, '')

  // Pattern 1: [time, date] sender:  (most common PT-BR)
  let match = cleaned.match(/\[(\d{1,2}:\d{2}),?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})\]\s*(.+?):\s*$/)
  if (match) return { time: match[1], date: match[2], sender: match[3].trim() }

  // Pattern 2: [time AM/PM, date] sender:  (12-hour format)
  match = cleaned.match(/\[(\d{1,2}:\d{2}\s*[APap][Mm]),?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})\]\s*(.+?):\s*$/)
  if (match) return { time: match[1], date: match[2], sender: match[3].trim() }

  // Pattern 3: [date, time] sender:  (reversed order)
  match = cleaned.match(/\[(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s*(\d{1,2}:\d{2}(?:\s*[APap][Mm])?)\]\s*(.+?):\s*$/)
  if (match) return { time: match[2], date: match[1], sender: match[3].trim() }

  // Pattern 4: [time] sender:  (no date — today's messages or WhatsApp omits date)
  match = cleaned.match(/\[(\d{1,2}:\d{2}(?:\s*[APap][Mm])?)\]\s*(.+?):\s*$/)
  if (match) return { time: match[1], date: null, sender: match[2].trim() }

  // Pattern 5: Just extract any time we can find
  const timeMatch = cleaned.match(/\[(\d{1,2}:\d{2})/)
  if (timeMatch) return { time: timeMatch[1], date: null, sender: null }

  return { time: null, date: null, sender: null }
}

// --- Resolve date text to DD/MM/YYYY ---
function resolveDateText(text) {
  if (!text) return null
  const upper = text.trim().toUpperCase()

  // Direct date format: DD/MM/YYYY or D/M/YYYY
  const directDate = upper.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/)
  if (directDate) return directDate[1]

  // "HOJE" = today
  if (upper === 'HOJE' || upper === 'TODAY') {
    const now = new Date()
    return `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`
  }

  // "ONTEM" / "YESTERDAY"
  if (upper === 'ONTEM' || upper === 'YESTERDAY') {
    const yesterday = new Date(Date.now() - 86400000)
    return `${yesterday.getDate().toString().padStart(2, '0')}/${(yesterday.getMonth() + 1).toString().padStart(2, '0')}/${yesterday.getFullYear()}`
  }

  // Day of week names (PT-BR and EN)
  const weekdays = {
    'DOMINGO': 0, 'SEGUNDA-FEIRA': 1, 'SEGUNDA': 1, 'TERÇA-FEIRA': 2, 'TERCA-FEIRA': 2, 'TERÇA': 2, 'TERCA': 2,
    'QUARTA-FEIRA': 3, 'QUARTA': 3, 'QUINTA-FEIRA': 4, 'QUINTA': 4,
    'SEXTA-FEIRA': 5, 'SEXTA': 5, 'SÁBADO': 6, 'SABADO': 6,
    'SUNDAY': 0, 'MONDAY': 1, 'TUESDAY': 2, 'WEDNESDAY': 3,
    'THURSDAY': 4, 'FRIDAY': 5, 'SATURDAY': 6,
  }
  for (const [name, targetDay] of Object.entries(weekdays)) {
    if (upper.includes(name)) {
      const now = new Date()
      const currentDay = now.getDay()
      let daysBack = currentDay - targetDay
      if (daysBack <= 0) daysBack += 7
      const target = new Date(now.getTime() - daysBack * 86400000)
      return `${target.getDate().toString().padStart(2, '0')}/${(target.getMonth() + 1).toString().padStart(2, '0')}/${target.getFullYear()}`
    }
  }

  return null
}

// --- Extract date separators from WhatsApp's date header dividers ---
// WhatsApp shows date headers between message groups: "HOJE", "ONTEM", "01/03/2026", etc.
// Returns a Map of DOM element → date string (DD/MM/YYYY)
function extractDateHeaders(panel) {
  const dateMap = new Map()
  const debugLog = []

  // Strategy 1: Try specific WhatsApp selectors for date dividers
  const dividerSelectors = [
    '[data-testid="msg-date-divider"]',
    '[data-testid="date-divider"]',
    '.message-date-divider',
  ]

  for (const sel of dividerSelectors) {
    const dividers = panel.querySelectorAll(sel)
    if (dividers.length > 0) {
      debugLog.push(`S1: "${sel}" found ${dividers.length} elements`)
      for (const div of dividers) {
        const text = (div.textContent || '').trim()
        const dateStr = resolveDateText(text)
        if (dateStr) dateMap.set(div, dateStr)
        debugLog.push(`  text="${text}" → date=${dateStr || 'null'}`)
      }
      if (dateMap.size > 0) {
        console.log('[Ramppy Scraper] DateHeaders:', debugLog.join('\n'))
        return dateMap
      }
    }
  }

  // Strategy 2: Broad text-based search — find ANY element in the message area
  // whose text looks like a date keyword, that is NOT inside a message bubble
  // WhatsApp date headers are typically short text (< 30 chars) between message groups
  const msgContainer = panel.querySelector('[role="application"]') || panel
  const allElements = msgContainer.querySelectorAll('span, div')
  const dateKeywords = /^(HOJE|ONTEM|TODAY|YESTERDAY|DOMINGO|SEGUNDA|TER[CÇ]A|QUARTA|QUINTA|SEXTA|S[AÁ]BADO|SUNDAY|MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|\d{1,2}\/\d{1,2}\/\d{2,4})[-\s]*(FEIRA)?$/i

  debugLog.push(`S2: Scanning ${allElements.length} elements for date text...`)
  let foundCount = 0

  for (const el of allElements) {
    // Skip elements inside message bubbles
    if (el.closest('.message-in, .message-out, [data-pre-plain-text]')) continue

    const text = (el.textContent || '').trim()
    // Must be short text (date labels are typically < 30 chars)
    if (!text || text.length > 40 || text.length < 3) continue

    if (dateKeywords.test(text)) {
      const dateStr = resolveDateText(text)
      if (dateStr) {
        // Avoid duplicates — only add if this element isn't contained by one already added
        let isDuplicate = false
        for (const [existingEl] of dateMap) {
          if (existingEl.contains(el) || el.contains(existingEl)) {
            isDuplicate = true
            break
          }
        }
        if (!isDuplicate) {
          dateMap.set(el, dateStr)
          debugLog.push(`  MATCH: "${text}" → ${dateStr}`)
          foundCount++
        }
      }
    }
  }

  debugLog.push(`S2: Found ${foundCount} date headers via text search`)
  console.log('[Ramppy Scraper] DateHeaders:', debugLog.join('\n'))
  return dateMap
}

// --- Robust text extraction from a message element ---
function extractTextFromMessage(row) {
  // Strategy 1: Try known selectors
  const textEl = trySelect(row, SELECTORS.messageText)
  if (textEl) {
    const txt = textEl.innerText?.trim() || textEl.textContent?.trim()
    if (txt) return txt
  }

  // Strategy 2: data-pre-plain-text parent often wraps the text
  const prePlainEl = row.querySelector('[data-pre-plain-text]')
  if (prePlainEl) {
    // The text is usually in a sibling/child span of the pre-plain container
    const spans = prePlainEl.querySelectorAll('span')
    for (const span of spans) {
      // Skip spans that look like timestamps or metadata
      if (span.querySelector('span') && span.children.length > 0) continue
      const txt = span.innerText?.trim() || span.textContent?.trim()
      if (txt && txt.length > 0 && !/^\d{1,2}:\d{2}$/.test(txt)) {
        return txt
      }
    }
    // Fallback: get innerText of pre-plain parent, strip the metadata prefix
    const fullText = prePlainEl.innerText?.trim()
    if (fullText) {
      // Remove the "[time, date] sender: " prefix
      const cleaned = fullText.replace(/^\[\d{1,2}:\d{2},?\s*\d{1,2}\/\d{1,2}\/\d{2,4}\]\s*[^:]*:\s*/, '')
      if (cleaned && cleaned !== fullText) return cleaned
    }
  }

  // Strategy 3: Look for any copyable/selectable text anywhere in the row
  const candidates = row.querySelectorAll('[class*="copyable"], [class*="selectable"], [class*="text-message"]')
  for (const el of candidates) {
    const txt = el.innerText?.trim() || el.textContent?.trim()
    if (txt && txt.length > 0) return txt
  }

  // Strategy 4: For link previews, get the URL
  const linkEl = row.querySelector('a[href*="http"]')
  if (linkEl) {
    const href = linkEl.getAttribute('href')
    const title = row.querySelector('[data-testid="link-preview-title"]')?.textContent?.trim()
    if (title) return `${title} - ${href}`
    return href
  }

  // Strategy 5: Broad text extraction — get the message bubble text
  // Find the bubble div (usually the main content area, excluding metadata)
  const bubble = row.querySelector('[data-testid="msg-text"], [data-testid="msg-container"] > div, .copyable-text')
  if (bubble) {
    const txt = bubble.innerText?.trim()
    if (txt) return txt
  }

  return ''
}

// --- Determine if message is outgoing ---
function isOutgoingMessage(row) {
  // Check class directly
  if (row.classList.contains('message-out')) return true
  if (row.classList.contains('message-in')) return false
  // Check parent
  const parent = row.closest('.message-out')
  if (parent) return true
  const parentIn = row.closest('.message-in')
  if (parentIn) return false
  // data-testid fallback: check for msg-dblcheck (double check = sent)
  if (row.querySelector('[data-testid="msg-dblcheck"]')) return true
  if (row.querySelector('[data-icon="msg-dblcheck"]')) return true
  if (row.querySelector('[data-icon="msg-check"]')) return true
  return false
}

// --- Convert time string to 24h format ---
function normalizeTime(timeStr) {
  if (!timeStr) return null
  // Handle 12-hour format (3:30 PM → 15:30)
  const ampm = timeStr.match(/(\d{1,2}):(\d{2})\s*([APap][Mm])/)
  if (ampm) {
    let h = parseInt(ampm[1])
    const m = ampm[2]
    const period = ampm[3].toUpperCase()
    if (period === 'PM' && h < 12) h += 12
    if (period === 'AM' && h === 12) h = 0
    return `${h.toString().padStart(2, '0')}:${m}`
  }
  // Already 24h format
  const h24 = timeStr.match(/(\d{1,2}):(\d{2})/)
  if (h24) return `${h24[1].padStart(2, '0')}:${h24[2]}`
  return null
}

// --- Convert date string (DD/MM/YYYY) to timestamp ---
function dateTimeToTimestamp(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null
  const normalTime = normalizeTime(timeStr)
  if (!normalTime) return null
  const parts = dateStr.split('/')
  if (parts.length !== 3) return null
  let year = parts[2]
  if (year.length === 2) year = '20' + year
  const ts = new Date(`${year}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}T${normalTime}:00`).getTime()
  return isNaN(ts) ? null : ts
}

// --- Extract all messages from current conversation ---
function extractMessages() {
  const panel = document.querySelector(SELECTORS.conversationPanel)
  if (!panel) return []

  // Extract date separator headers FIRST (before processing messages)
  const dateHeaders = extractDateHeaders(panel)

  // Build ordered list of date headers by their DOM position
  // We'll compare message elements' position relative to these headers
  const dateHeaderEntries = []
  for (const [el, dateStr] of dateHeaders) {
    dateHeaderEntries.push({ el, dateStr })
  }

  // Try to find message rows
  let rows = trySelectAll(panel, SELECTORS.messageRow)

  // Ultimate fallback: find elements with data-pre-plain-text (these are always message bubbles)
  if (rows.length === 0) {
    const prePlainEls = panel.querySelectorAll('[data-pre-plain-text]')
    rows = Array.from(prePlainEls).map(el => {
      // Walk up to find the message container
      let node = el
      for (let i = 0; i < 10; i++) {
        if (!node.parentElement) break
        node = node.parentElement
        if (node.classList.contains('message-in') || node.classList.contains('message-out')) return node
        if (node.getAttribute('data-testid') === 'msg-container') return node
      }
      return el.parentElement || el
    })
    // Deduplicate
    rows = [...new Set(rows)]
  }

  const messages = []

  // Helper: find the most recent date header that appears BEFORE a given element in DOM order
  function getDateFromHeaders(msgEl) {
    let lastDate = null
    for (const entry of dateHeaderEntries) {
      // compareDocumentPosition: PRECEDING (2) = entry.el comes BEFORE msgEl in DOM
      const pos = msgEl.compareDocumentPosition(entry.el)
      if (pos & Node.DOCUMENT_POSITION_PRECEDING) {
        lastDate = entry.dateStr
      } else if (pos & Node.DOCUMENT_POSITION_FOLLOWING) {
        break // All subsequent headers are also after this message (querySelectorAll is ordered)
      }
    }
    return lastDate
  }

  // Log first few data-pre-plain-text values for debugging
  let debugSamples = []

  for (const row of rows) {
    const isOutgoing = isOutgoingMessage(row)
    const type = getMessageType(row)
    let body = extractTextFromMessage(row)

    // For non-text messages without text, add label
    if (!body && type !== 'text') {
      const labels = { image: '[Imagem]', audio: '[Áudio]', video: '[Vídeo]', document: '[Documento]', sticker: '[Sticker]' }
      body = labels[type] || `[${type}]`
    }

    // Skip completely empty messages (usually system notifications)
    if (!body && type === 'text') continue

    // Get timestamp from data-pre-plain-text
    const prePlainEl = row.querySelector(SELECTORS.messagePrePlain)
    const prePlainText = prePlainEl ? prePlainEl.getAttribute('data-pre-plain-text') : ''
    const { time, date, sender } = parseTimestamp(prePlainText)

    // Collect debug samples (first 3 messages)
    if (debugSamples.length < 3) {
      debugSamples.push({ raw: prePlainText, time, date, sender })
    }

    let timestamp = null
    let displayTime = time || ''
    let displayDate = date || ''

    // Try to build timestamp from parsed time + date
    if (date && time) {
      timestamp = dateTimeToTimestamp(date, time)
    }

    // If we have time but no date, try to get date from WhatsApp's date header dividers
    if (!timestamp && time) {
      const headerDate = getDateFromHeaders(row)
      if (headerDate) {
        timestamp = dateTimeToTimestamp(headerDate, time)
        if (timestamp) displayDate = headerDate
      }
    }

    // Fallback: try to extract time from visible msg-time span
    if (!timestamp) {
      const timeSpan = row.querySelector('[data-testid="msg-time"] span, [data-testid="msg-time"]')
      if (timeSpan) {
        const t = timeSpan.textContent?.trim()
        if (t && /^\d{1,2}:\d{2}$/.test(t)) {
          displayTime = t
          // Try with date header
          const headerDate = getDateFromHeaders(row)
          if (headerDate) {
            timestamp = dateTimeToTimestamp(headerDate, t)
            if (timestamp) displayDate = headerDate
          }
        }
      }
      // Also check any small span that looks like a time
      if (!displayTime) {
        const allSpans = row.querySelectorAll('span')
        for (const s of allSpans) {
          const t = s.textContent?.trim()
          if (t && /^\d{1,2}:\d{2}$/.test(t) && !s.querySelector('span')) {
            displayTime = t
            break
          }
        }
      }
    }

    // Mark messages without real timestamps for post-processing
    const hasRealTimestamp = !!timestamp
    if (!timestamp) timestamp = 0 // placeholder, will be fixed below

    messages.push({
      body,
      fromMe: isOutgoing,
      timestamp,
      time: displayTime,
      date: displayDate,
      type,
      sender: sender || (isOutgoing ? 'Vendedor' : getContactName() || 'Cliente'),
      _hasRealTimestamp: hasRealTimestamp,
    })
  }

  // Attach debug info to the return value for copilot !debug command
  messages._debugInfo = {
    prePlainSamples: debugSamples,
    dateHeadersFound: dateHeaderEntries.length,
    dateHeaderDates: dateHeaderEntries.map(e => e.dateStr),
  }

  // Count how many messages have real timestamps
  const realCount = messages.filter(m => m._hasRealTimestamp).length
  const totalCount = messages.length
  const hasAnyRealTimestamp = realCount > 0

  // Post-process: fix missing timestamps to preserve DOM order
  // DOM order IS chronological order in WhatsApp
  for (let i = 0; i < messages.length; i++) {
    if (!messages[i]._hasRealTimestamp) {
      // Find nearest previous message with a real timestamp
      let prevTs = null
      for (let j = i - 1; j >= 0; j--) {
        if (messages[j]._hasRealTimestamp) { prevTs = messages[j].timestamp; break }
      }
      // Find nearest next message with a real timestamp
      let nextTs = null
      for (let j = i + 1; j < messages.length; j++) {
        if (messages[j]._hasRealTimestamp) { nextTs = messages[j].timestamp; break }
      }

      if (prevTs && nextTs) {
        // Interpolate between known timestamps
        const prevIdx = messages.findIndex((m, idx) => idx < i && m._hasRealTimestamp && m.timestamp === prevTs)
        const nextIdx = messages.findIndex((m, idx) => idx > i && m._hasRealTimestamp && m.timestamp === nextTs)
        const fraction = (i - prevIdx) / (nextIdx - prevIdx)
        messages[i].timestamp = Math.floor(prevTs + (nextTs - prevTs) * fraction)
      } else if (prevTs) {
        // After last known timestamp: add 1 minute per position
        const prevIdx = [...messages].reverse().findIndex((m, idx) => (messages.length - 1 - idx) < i && m._hasRealTimestamp)
        messages[i].timestamp = prevTs + ((i - (messages.length - 1 - prevIdx)) * 60000)
      } else if (nextTs) {
        // Before first known timestamp: subtract 1 minute per position
        const nextIdx = messages.findIndex((m, idx) => idx > i && m._hasRealTimestamp)
        messages[i].timestamp = nextTs - ((nextIdx - i) * 60000)
      } else {
        // No real timestamps at all — DON'T use Date.now() (causes false "recent" detection)
        // Instead mark as unknown: use 0 (epoch) so copilot knows timestamps are unreliable
        messages[i].timestamp = 0
        messages[i]._timestampUnknown = true
      }
    }
    // Clean up internal flag
    delete messages[i]._hasRealTimestamp
  }

  // If ALL timestamps are unknown (epoch 0), flag the entire batch
  const allUnknown = messages.every(m => m._timestampUnknown || m.timestamp === 0)
  if (allUnknown && messages.length > 0) {
    console.warn(`[Ramppy Scraper] WARNING: No real timestamps found for ${messages.length} messages. data-pre-plain-text may have changed format.`)
    // Assign relative ordering timestamps (old but sequential) so messages have order
    // Use a date far enough in the past to not trigger "recent" detection
    // But preserve relative order
    for (let i = 0; i < messages.length; i++) {
      messages[i].timestamp = 0 // Will be handled by copilot as "unknown"
      delete messages[i]._timestampUnknown
    }
  } else {
    // Clean up unknown flags
    for (const m of messages) delete m._timestampUnknown
  }

  // Final safety: ensure strictly increasing timestamps (DOM order = correct order)
  // Only apply if we have at least some real timestamps
  if (!allUnknown) {
    for (let i = 1; i < messages.length; i++) {
      if (messages[i].timestamp <= messages[i - 1].timestamp) {
        messages[i].timestamp = messages[i - 1].timestamp + 1000
      }
    }
  }

  return messages
}

// --- Send context update to Electron ---
function sendUpdate() {
  const contactName = getContactName()
  if (!contactName) {
    // DOM might be temporarily mutating — don't immediately declare inactive
    inactiveCount++
    if (inactiveCount < INACTIVE_THRESHOLD) return // wait for more confirmations
    if (lastContactName !== null) {
      lastContactName = null
      lastMessageCount = 0
      if (window.ramppy) {
        window.ramppy.sendContext({ active: false, contactName: null, contactPhone: null, messages: [] })
      }
    }
    return
  }
  // Contact found — reset inactive counter
  inactiveCount = 0

  const messages = extractMessages()
  const debugInfo = messages._debugInfo || null
  const contactPhone = getContactPhone()
  const conversationChanged = contactName !== lastContactName
  lastContactName = contactName
  lastMessageCount = messages.length

  console.log(`[Ramppy Scraper] Update: ${contactName}, ${messages.length} msgs, changed=${conversationChanged}`)
  if (messages.length > 0) {
    const last = messages[messages.length - 1]
    console.log(`[Ramppy Scraper] Last msg: "${last.body?.substring(0, 50)}" (${last.type}, fromMe=${last.fromMe})`)
  }

  if (window.ramppy) {
    window.ramppy.sendContext({
      active: true,
      contactName,
      contactPhone,
      messages,
      conversationChanged,
      _debugInfo: debugInfo,
    })
  }
}

// --- Debounced update ---
function debouncedUpdate() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(sendUpdate, DEBOUNCE_MS)
}

// --- MutationObserver on messages container ---
function setupObserver() {
  if (observer) {
    observer.disconnect()
    observer = null
  }

  const container = trySelect(document, SELECTORS.messagesContainer)
  if (!container) return

  observer = new MutationObserver((mutations) => {
    let hasRelevantChange = false
    for (const mutation of mutations) {
      if (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0) {
        hasRelevantChange = true
        break
      }
    }
    if (hasRelevantChange) debouncedUpdate()
  })

  observer.observe(container, { childList: true, subtree: true, attributes: false })
}

// --- Watch for conversation panel changes ---
function setupConversationWatcher() {
  const bodyObserver = new MutationObserver(() => {
    const currentContact = getContactName()
    if (currentContact !== lastContactName) {
      setupObserver()
      sendUpdate()
    }
  })

  bodyObserver.observe(document.body, { childList: true, subtree: true, attributes: false })
}

// --- Inject text into WhatsApp input field ---
function injectText(text) {
  const input = trySelect(document, SELECTORS.inputField)
  if (!input) {
    console.warn('[Ramppy Scraper] Input field not found')
    return false
  }

  input.focus()
  input.textContent = ''
  document.execCommand('insertText', false, text)
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

// --- Scrape ALL conversations from sidebar ---
function scrapeConversationList() {
  const paneEl = document.getElementById('pane-side')
  if (!paneEl) return []

  // Find conversation cells — try multiple selectors
  let cells = paneEl.querySelectorAll('[role="row"]')
  if (cells.length === 0) cells = paneEl.querySelectorAll('[data-testid="cell-frame-container"]')
  if (cells.length === 0) cells = paneEl.querySelectorAll('[role="gridcell"]')
  if (cells.length === 0) return []

  const conversations = []
  for (const cell of cells) {
    try {
      // Contact name: first span[title] in the cell
      const spans = cell.querySelectorAll('span[title]')
      if (spans.length === 0) continue

      const name = spans[0]?.getAttribute('title')?.trim()
      if (!name) continue

      // Phone: if name looks like a phone number, use it; otherwise use name as identifier
      let phone = name
      if (/^[\d+\s()-]+$/.test(name.replace(/\s/g, ''))) {
        phone = name.replace(/\s/g, '')
      }

      // Last message preview: second span[title] or last span with title
      let lastMessage = ''
      for (let i = 1; i < spans.length; i++) {
        const title = spans[i]?.getAttribute('title')?.trim()
        if (title && title !== name) {
          lastMessage = title
          break
        }
      }
      // Fallback: look for message preview text in other elements
      if (!lastMessage) {
        const previewEl = cell.querySelector('[data-testid="last-msg-status"]')
          || cell.querySelector('span[dir="ltr"]:not([title])')
        if (previewEl) lastMessage = previewEl.textContent?.trim() || ''
      }

      // Unread count
      const unreadEl = cell.querySelector('[data-testid="icon-unread-count"]')
        || cell.querySelector('span[aria-label*="não lida"], span[aria-label*="unread"]')
      const unread = parseInt(unreadEl?.textContent || '0') || 0

      conversations.push({ name, phone, lastMessage, unread })
    } catch (e) {
      // Skip malformed cells
    }
  }
  return conversations
}

// --- Periodic sidebar sync ---
var sidebarSyncInterval = sidebarSyncInterval || null

function startSidebarSync() {
  if (sidebarSyncInterval) return
  sidebarSyncInterval = setInterval(() => {
    const list = scrapeConversationList()
    if (list.length > 0 && window.ramppy) {
      console.log(`[Ramppy Scraper] Sidebar sync: ${list.length} conversations`)
      window.ramppy.sendConversationList(list)
    }
  }, 15000) // every 15 seconds

  // Also send immediately on start
  setTimeout(() => {
    const list = scrapeConversationList()
    if (list.length > 0 && window.ramppy) {
      console.log(`[Ramppy Scraper] Initial sidebar sync: ${list.length} conversations`)
      window.ramppy.sendConversationList(list)
    }
  }, 2000)
}

// --- Auto-scan: open top N conversations and scrape messages ---
// This function is called from main.js via executeJavaScript.
// It explicitly extracts messages and sends via IPC (does NOT rely on MutationObserver).
async function autoScanConversations(maxConversations) {
  maxConversations = maxConversations || 15
  if (isAutoScanning) return { status: 'already_scanning' }
  isAutoScanning = true

  const paneEl = document.getElementById('pane-side')
  if (!paneEl) {
    isAutoScanning = false
    return { status: 'no_sidebar' }
  }

  // Snapshot the cells ONCE before we start clicking
  var cellList = paneEl.querySelectorAll('[role="row"]')
  if (cellList.length === 0) cellList = paneEl.querySelectorAll('[data-testid="cell-frame-container"]')
  if (cellList.length === 0) cellList = paneEl.querySelectorAll('[role="gridcell"]')

  if (cellList.length === 0) {
    isAutoScanning = false
    return { status: 'no_conversations' }
  }

  var total = Math.min(cellList.length, maxConversations)
  var scanned = 0

  console.log('[Ramppy Auto-Scan] Starting scan of ' + total + ' conversations...')

  for (var i = 0; i < total; i++) {
    try {
      // Re-query cells each iteration (DOM might update after clicks)
      var freshCells = paneEl.querySelectorAll('[role="row"]')
      if (freshCells.length === 0) freshCells = paneEl.querySelectorAll('[data-testid="cell-frame-container"]')
      var cell = freshCells[i]
      if (!cell) {
        console.log('[Ramppy Auto-Scan] ' + (i + 1) + '/' + total + ': Cell not found, skipping')
        continue
      }

      // Extract contact name for logging
      var nameSpan = cell.querySelector('span[title]')
      var name = nameSpan ? nameSpan.getAttribute('title') : '#' + i

      console.log('[Ramppy Auto-Scan] ' + (i + 1) + '/' + total + ': Opening "' + name + '"...')

      // Debug: log DOM structure of first cell to understand WhatsApp's layout
      if (i === 0) {
        var debugInfo = []
        var walkDOM = function(el, depth) {
          if (depth > 5) return
          var tag = el.tagName ? el.tagName.toLowerCase() : '?'
          var attrs = []
          if (el.getAttribute) {
            if (el.getAttribute('role')) attrs.push('role=' + el.getAttribute('role'))
            if (el.getAttribute('data-testid')) attrs.push('testid=' + el.getAttribute('data-testid'))
            if (el.getAttribute('tabindex')) attrs.push('tabindex=' + el.getAttribute('tabindex'))
            if (el.getAttribute('aria-selected')) attrs.push('selected=' + el.getAttribute('aria-selected'))
          }
          debugInfo.push('  '.repeat(depth) + tag + (attrs.length ? '[' + attrs.join(',') + ']' : ''))
          var children = el.children || []
          for (var c = 0; c < Math.min(children.length, 6); c++) {
            walkDOM(children[c], depth + 1)
          }
        }
        walkDOM(cell, 0)
        console.log('[Ramppy Auto-Scan] Cell DOM structure:\n' + debugInfo.join('\n'))
      }

      // Click strategy: simulate real mouse events (React needs pointer events)
      var clickTarget = cell.querySelector('[data-testid="cell-frame-container"]')
        || cell.querySelector('div[tabindex="-1"]')
        || cell.querySelector('div[role="gridcell"]')
        || cell
      var rect = clickTarget.getBoundingClientRect()
      var cx = rect.left + rect.width / 2
      var cy = rect.top + rect.height / 2
      var evtInit = { bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy, button: 0 }
      clickTarget.dispatchEvent(new PointerEvent('pointerdown', evtInit))
      clickTarget.dispatchEvent(new MouseEvent('mousedown', evtInit))
      clickTarget.dispatchEvent(new PointerEvent('pointerup', evtInit))
      clickTarget.dispatchEvent(new MouseEvent('mouseup', evtInit))
      clickTarget.dispatchEvent(new MouseEvent('click', evtInit))

      // Wait for conversation panel (#main) to load
      await new Promise(function(r) { setTimeout(r, 3000) })

      // Directly extract messages and send via IPC (bypass MutationObserver)
      var contactName = getContactName()
      var contactPhone = getContactPhone()
      var messages = extractMessages()

      console.log('[Ramppy Auto-Scan] ' + (i + 1) + '/' + total + ': "' + (contactName || name) + '" → ' + messages.length + ' msgs, panel=' + (!!document.querySelector('#main')))

      if (contactName && messages.length > 0 && window.ramppy) {
        window.ramppy.sendContext({
          active: true,
          contactName: contactName,
          contactPhone: contactPhone || name,
          messages: messages,
          conversationChanged: true,
        })
      }

      // Buffer for sync pipeline to process
      await new Promise(function(r) { setTimeout(r, 500) })

      scanned++
    } catch (e) {
      console.log('[Ramppy Auto-Scan] Error on conversation ' + i + ': ' + e.message)
    }
  }

  // Update scraper state to current conversation
  lastContactName = getContactName()
  lastMessageCount = 0

  isAutoScanning = false
  console.log('[Ramppy Auto-Scan] Complete: scanned ' + scanned + '/' + total + ' conversations')
  return { status: 'done', scanned: scanned, total: total }
}

// Expose for main process to call via executeJavaScript
window.__ramppyAutoScan = autoScanConversations

// --- Initialize ---
function init() {
  console.log('[Ramppy Scraper] Initializing WhatsApp Web scraper...')

  const waitForApp = setInterval(() => {
    const sidebar = document.querySelector('[data-testid="chat-list"]') || document.querySelector('#pane-side')
    if (sidebar) {
      clearInterval(waitForApp)
      console.log('[Ramppy Scraper] WhatsApp Web loaded. Setting up observers...')
      setupObserver()
      setupConversationWatcher()
      sendUpdate()
      // Start periodic sidebar conversation list sync
      startSidebarSync()
    }
  }, 1000)

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
