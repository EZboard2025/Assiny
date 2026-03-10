// ============================================================
// Ramppy Floating Assistant — Bubble Chat
// Design: matches SellerAgentChat.tsx from website
// ============================================================

const BASE_URL = (window.location.protocol === 'file:') ? 'http://localhost:3000' : 'https://ramppy.site'
const API_URL = BASE_URL + '/api/agent/chat'
const SUGGESTIONS_URL = BASE_URL + '/api/agent/suggestions'
const TRANSCRIBE_URL = BASE_URL + '/api/roleplay/transcribe'
const TTS_URL = BASE_URL + '/api/agent/tts'
const NOTIFICATION_CHECK_URL = BASE_URL + '/api/agent/notifications/check'
const MORNING_SUMMARY_URL = BASE_URL + '/api/agent/morning-summary'

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
const btnHome = document.getElementById('btn-home')
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

// --- Notification DOM ---
const notificationToast = document.getElementById('notification-toast')
const notifIcon = document.getElementById('notif-icon')
const notifTitle = document.getElementById('notif-title')
const notifText = document.getElementById('notif-text')
const notifDismiss = document.getElementById('notif-dismiss')
const notificationBadge = document.getElementById('notification-badge')

// --- Notification State ---
let notificationCheckInterval = null
let lastNotificationTimes = {} // { 'nicole_meeting_soon:eventId': ts, ... }
let activeNotification = null
let notificationQueue = []
let notifDismissTimeout = null
let morningSummaryShownToday = false
let morningData = null

const NOTIFICATION_COOLDOWN = {
  nicole_meeting_soon: 10 * 60 * 1000,     // 10 minutes per event
  nicole_training_gap: 24 * 60 * 60 * 1000, // Once per day
  nicole_stale_leads: 8 * 60 * 60 * 1000,   // Every 8 hours
}

const NOTIFICATION_ICONS = {
  meeting_soon: '📅',
  training_gap: '🏋️',
  stale_leads: '📱',
  morning_summary: '☀️',
}

// --- Auth (received from main window via IPC) ---
function ensureAuth() {
  return !!(accessToken && userId)
}

// Listen for auth token from main platform window
if (window.electronAPI && window.electronAPI.onAuthToken) {
  window.electronAPI.onAuthToken((data) => {
    if (data && data.accessToken) {
      const wasLoggedOut = !accessToken
      accessToken = data.accessToken
      userId = data.userId

      // Start notification system on first auth
      if (wasLoggedOut && accessToken) {
        startNotificationChecker()
        checkMorningSummary()
      }
    }
  })
}

// Listen for notification nudge from main process (on window focus)
if (window.electronAPI && window.electronAPI.onNotificationNudge) {
  window.electronAPI.onNotificationNudge(() => {
    if (ensureAuth()) checkNotifications()
  })
}

// Listen for test notification trigger — cycles through all 4 types on each press
let testNotifIndex = 0
const TEST_NOTIFICATION_TYPES = ['training_gap', 'meeting_soon', 'stale_leads', 'morning_summary']
const TEST_NOTIFICATION_DATA = {
  training_gap: { days_since_last: 3, has_any_session: true },
  meeting_soon: { title: 'Reunião com Cliente Demo', minutes_until: 28, meet_link: 'https://meet.google.com/test', attendees: ['cliente@empresa.com'] },
  stale_leads: { count: 3, contacts: [{ name: 'João Silva', phone: '5511999001122', hours_since: 52 }, { name: 'Maria Santos', phone: '5511999003344', hours_since: 72 }] },
  morning_summary: { meetings: [], tasks: [] },
}

if (window.electronAPI && window.electronAPI.onTestNotification) {
  window.electronAPI.onTestNotification(() => {
    const type = TEST_NOTIFICATION_TYPES[testNotifIndex % TEST_NOTIFICATION_TYPES.length]
    testNotifIndex++

    console.log(`[Nicole] Test notification: ${type} (press Ctrl+Shift+N again for next type)`)

    // Force-dismiss current notification and clear queue for instant cycling
    if (activeNotification) {
      dismissNotification()
    }
    notificationQueue.length = 0

    // Inject fake notification directly
    notificationQueue.push({
      type,
      data: TEST_NOTIFICATION_DATA[type],
      dedupKey: `test_${Date.now()}`
    })
    showNextNotification()
  })
}

// ─── Notification System ────────────────────────────────────────────────────

function startNotificationChecker() {
  // Proactive notifications disabled — leads sem resposta, dias sem treinar, etc.
  // were too intrusive. Keep the function for manual/test triggers only.
  return
}

async function checkNotifications(forceTest = false) {
  if (!ensureAuth()) return
  // Don't interrupt active typing or sending (unless force test)
  if (!forceTest && isSending) return
  if (!forceTest && (document.activeElement === chatInput || document.activeElement === welcomeInput)) return

  try {
    const res = await fetch(NOTIFICATION_CHECK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ userId, force_test: forceTest || undefined }),
    })

    if (!res.ok) return
    const { notifications } = await res.json()
    if (!notifications || notifications.length === 0) return

    for (const notif of notifications) {
      const dedupKey = forceTest ? `test_${Date.now()}` : (`nicole_${notif.type}` + (notif.type === 'meeting_soon' ? `:${notif.data?.title}` : ''))
      const cooldown = NOTIFICATION_COOLDOWN[`nicole_${notif.type}`] || 60 * 60 * 1000
      const lastTime = lastNotificationTimes[dedupKey] || 0

      if (Date.now() - lastTime < cooldown) continue

      notificationQueue.push({ ...notif, dedupKey })
    }

    if (notificationQueue.length > 0 && !activeNotification) {
      showNextNotification()
    }
  } catch (err) {
    console.error('[Notification Check] Error:', err)
  }
}

async function showNextNotification() {
  if (notificationQueue.length === 0) {
    activeNotification = null
    notificationBadge.style.display = 'none'
    return
  }

  const notif = notificationQueue.shift()
  activeNotification = notif
  lastNotificationTimes[notif.dedupKey] = Date.now()

  // Show badge on bubble
  notificationBadge.style.display = 'block'

  // If bubble is hidden at edge, peek first
  if (isHidden && snappedEdge) {
    peekFromEdge()
    await new Promise(r => setTimeout(r, 400))
  }

  // Don't show toast if panel is expanded — user is actively chatting
  if (isExpanded) {
    // Just leave the badge, they'll see it when they close the panel
    return
  }

  // Show notification in a SEPARATE window (no bubble resize needed)
  const icon = NOTIFICATION_ICONS[notif.type] || '🔔'
  const iconClass = notif.type === 'meeting_soon' ? 'meeting' : notif.type === 'training_gap' ? 'training' : 'leads'

  try {
    if (window.electronAPI && window.electronAPI.showNotificationToast) {
      await window.electronAPI.showNotificationToast({
        icon,
        iconClass,
        title: getNotifTitle(notif),
        text: getNotifMessage(notif),
      })
    }
  } catch (err) {
    console.error('[Nicole] Show notification toast error:', err)
  }
}

function getNotifTitle(notif) {
  switch (notif.type) {
    case 'meeting_soon':
      return `Reuniao em ${notif.data?.minutes_until || '~30'} min`
    case 'training_gap':
      return notif.data?.days_since_last
        ? `${notif.data.days_since_last} dias sem treinar`
        : 'Hora de treinar!'
    case 'stale_leads':
      return `${notif.data?.count || ''} lead${(notif.data?.count || 0) > 1 ? 's' : ''} sem resposta`
    case 'morning_summary': {
      const hour = new Date().getHours()
      return hour < 12 ? 'Bom dia!' : hour < 18 ? 'Boa tarde!' : 'Boa noite!'
    }
    default:
      return 'Nicole'
  }
}

function getNotifMessage(notif) {
  switch (notif.type) {
    case 'meeting_soon':
      return `"${notif.data?.title || 'Reuniao'}" comeca logo. Clique para saber mais.`
    case 'training_gap':
      return 'Que tal uma sessao rapida de roleplay? Clique para comecar.'
    case 'stale_leads': {
      const names = (notif.data?.contacts || []).slice(0, 2).map(c => c.name).join(', ')
      const extra = (notif.data?.count || 0) > 2 ? ` e +${notif.data.count - 2}` : ''
      return `${names}${extra} aguardando resposta ha 48h+`
    }
    case 'morning_summary':
      return 'Tenho seu resumo do dia pronto. Clique para ver.'
    default:
      return ''
  }
}

function dismissNotification(skipHide) {
  activeNotification = null

  // Close the separate notification window (unless already closed by main process)
  if (!skipHide && window.electronAPI && window.electronAPI.hideNotificationToast) {
    window.electronAPI.hideNotificationToast().catch(() => {})
  }

  // Show next notification after 2s gap
  if (notificationQueue.length > 0) {
    setTimeout(() => showNextNotification(), 2000)
  } else {
    notificationBadge.style.display = 'none'
  }
}

async function handleNotificationClick() {
  const notif = activeNotification
  console.log('[Nicole] handleNotificationClick called, notif type:', notif?.type, ', activeNotification exists:', !!activeNotification)
  dismissNotification(true) // skipHide — main already closed the notification window
  notificationBadge.style.display = 'none'

  // Expand and auto-send contextual message
  if (!isExpanded) {
    console.log('[Nicole] Expanding panel...')
    await expand()
    console.log('[Nicole] Panel expanded')
    // Small delay to let UI settle after expansion
    await new Promise(r => setTimeout(r, 300))
  }

  let msg = ''
  switch (notif?.type) {
    case 'meeting_soon':
      msg = 'O que tenho daqui a pouco na agenda?'
      break
    case 'training_gap':
      msg = 'Faz tempo que nao treino, me sugere um roleplay'
      break
    case 'stale_leads':
      msg = 'Quais leads estao sem responder?'
      break
    case 'morning_summary':
      msg = 'Me da um resumo do meu dia'
      break
  }

  console.log('[Nicole] Notification msg to send:', JSON.stringify(msg), ', isSending:', isSending, ', hasAuth:', ensureAuth())
  if (msg && !isSending && ensureAuth()) {
    console.log('[Nicole] Auto-sending from notification click:', JSON.stringify(msg))
    sendMessage(msg)
  }
}

// Listen for notification click/dismiss from the separate notification window (via main process IPC)
if (window.electronAPI && window.electronAPI.onNotificationClicked) {
  window.electronAPI.onNotificationClicked(() => {
    console.log('[Nicole] Notification clicked (from separate window)')
    handleNotificationClick()
  })
}
if (window.electronAPI && window.electronAPI.onNotificationDismissed) {
  window.electronAPI.onNotificationDismissed(() => {
    console.log('[Nicole] Notification dismissed (from separate window)')
    dismissNotification(true) // skipHide — main already closed the notification window
  })
}

// Legacy: Wire up in-page notification toast click and dismiss (kept for fallback)
if (notificationToast) {
  notificationToast.addEventListener('click', (e) => {
    if (e.target === notifDismiss || notifDismiss.contains(e.target)) return
    handleNotificationClick()
  })
}
if (notifDismiss) {
  notifDismiss.addEventListener('click', (e) => {
    e.stopPropagation()
    dismissNotification()
  })
}

// ─── Morning Summary ────────────────────────────────────────────────────────

function checkMorningSummary() {
  if (!ensureAuth()) return

  const today = new Date().toISOString().split('T')[0]
  const storageKey = 'ramppy_morning_summary_' + userId
  const lastShown = localStorage.getItem(storageKey)

  if (lastShown === today) {
    morningSummaryShownToday = true
    return
  }

  // Delay 8 seconds to let app settle
  setTimeout(async () => {
    if (morningSummaryShownToday) return
    await loadMorningSummary()
  }, 8000)
}

async function loadMorningSummary() {
  try {
    const res = await fetch(MORNING_SUMMARY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ userId }),
    })

    if (!res.ok) return
    const data = await res.json()
    if (!data || !data.summary) return

    morningData = data.summary

    const today = new Date().toISOString().split('T')[0]
    localStorage.setItem('ramppy_morning_summary_' + userId, today)
    morningSummaryShownToday = true

    // If bubble is hidden, peek and show toast
    if (isHidden && snappedEdge) {
      peekFromEdge()
    }

    // Show a notification toast inviting user to open
    notificationQueue.push({
      type: 'morning_summary',
      dedupKey: 'morning_summary',
      data: morningData,
    })

    if (!activeNotification) showNextNotification()
  } catch (err) {
    console.error('[Morning Summary] Error:', err)
  }
}

function renderMorningSummary(data) {
  if (!data) return

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'
  const name = userName || ''

  let html = `<div class="morning-summary">`
  html += `<div class="morning-greeting">${greeting}${name ? ', ' + name : ''}!</div>`

  // Meetings
  if (data.meetings && data.meetings.length > 0) {
    html += `<div class="morning-section"><div class="morning-section-header"><span class="morning-section-icon">📅</span><span>Reunioes Hoje (${data.meetings.length})</span></div>`
    for (const m of data.meetings) {
      const time = m.time || new Date(m.start).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      const attendeeNames = Array.isArray(m.attendees) ? m.attendees.map(a => typeof a === 'object' ? (a.displayName || a.email || '') : a).filter(Boolean).join(', ') : (m.attendees || '')
      html += `<div class="morning-item"><span class="morning-item-title">${time}</span> — ${m.title || 'Reuniao'}${attendeeNames ? ` <span class="morning-item-meta">com ${attendeeNames}</span>` : ''}</div>`
    }
    html += `</div>`
  }

  // Stale leads
  if (data.stale_leads && data.stale_leads.length > 0) {
    html += `<div class="morning-section"><div class="morning-section-header"><span class="morning-section-icon">📱</span><span>Leads Aguardando (${data.stale_leads.length})</span></div>`
    for (const l of data.stale_leads.slice(0, 3)) {
      html += `<div class="morning-item"><span class="morning-item-title">${l.name || l.phone}</span> <span class="morning-item-meta">${l.hours_since || ''}h sem resposta</span></div>`
    }
    html += `</div>`
  }

  // Challenge
  if (data.challenge) {
    html += `<div class="morning-section"><div class="morning-section-header"><span class="morning-section-icon">🎯</span><span>Desafio do Dia</span></div>`
    html += `<div class="morning-item"><span class="morning-item-title">${data.challenge.title || 'Desafio disponivel'}</span></div>`
    html += `</div>`
  }

  // Streak
  if (data.streak && data.streak.current > 0) {
    html += `<div class="morning-streak">🔥 ${data.streak.current} dia${data.streak.current > 1 ? 's' : ''} consecutivo${data.streak.current > 1 ? 's' : ''} de treino!</div>`
  }

  // Nicole message
  if (data.nicole_message) {
    html += `<div class="morning-nicole-msg">${data.nicole_message}</div>`
  }

  // Action buttons
  html += `<div class="morning-actions">`
  if (data.meetings && data.meetings.length > 0) {
    html += `<button class="morning-action-btn" data-morning-action="agenda">Ver agenda</button>`
  }
  if (data.stale_leads && data.stale_leads.length > 0) {
    html += `<button class="morning-action-btn" data-morning-action="leads">Checar leads</button>`
  }
  if (data.challenge) {
    html += `<button class="morning-action-btn" data-morning-action="challenge">Iniciar desafio</button>`
  }
  html += `</div></div>`

  // Add input field at the bottom of morning summary
  html += `<div class="welcome-input-wrap" style="margin-top:12px;">
    <input type="text" id="morning-input" class="welcome-input" placeholder="Me pergunte qualquer coisa..." autocomplete="off">
    <button id="btn-mic-morning" class="btn-mic" title="Falar">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
    </button>
    <button id="btn-send-morning" class="btn-send-small" title="Enviar">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
    </button>
  </div>`

  // Replace welcome state content
  welcomeState.innerHTML = html

  // Wire morning input
  const morningInput = document.getElementById('morning-input')
  const btnSendMorning = document.getElementById('btn-send-morning')
  const btnMicMorning = document.getElementById('btn-mic-morning')
  if (morningInput) {
    morningInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(morningInput.value) }
    })
  }
  if (btnSendMorning) {
    btnSendMorning.addEventListener('click', () => sendMessage(morningInput.value))
  }
  if (btnMicMorning) {
    btnMicMorning.addEventListener('click', () => toggleRecording(btnMicMorning))
  }

  // Wire action buttons
  welcomeState.querySelectorAll('[data-morning-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.getAttribute('data-morning-action')
      switch (action) {
        case 'agenda': sendMessage('O que tenho na agenda hoje?'); break
        case 'leads': sendMessage('Quais leads precisam de atencao?'); break
        case 'challenge':
          if (window.electronAPI && window.electronAPI.navigatePlatform) {
            window.electronAPI.navigatePlatform('?view=challenge-history')
          } else {
            sendMessage('Mostra meu desafio de hoje')
          }
          break
      }
    })
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
  snappedScreen = null
  isHidden = false
  isAnimating = false

  // Calculate target position BEFORE any visual changes
  const scr = await window.electronAPI.getScreenSize()
  const scrX = scr.x || 0
  const scrY = scr.y || 0
  const panelW = 420
  const panelH = 780
  let px = savedBubblePos.x
  let py = savedBubblePos.y

  if (px + panelW > scrX + scr.width) px = scrX + scr.width - panelW - 8
  if (px < scrX) px = scrX + 8
  if (py + panelH > scrY + scr.height) py = scrY + scr.height - panelH - 8
  if (py < scrY) py = scrY + 8

  // Hide window → resize → show panel → restore window (prevents dark flash on Windows)
  await window.electronAPI.setBubbleOpacity(0)
  bubble.style.display = 'none'
  chatPanel.classList.remove('panel-animate')
  chatPanel.style.display = 'flex'
  // Show rec bar if recording
  if (isBubbleRecording) recBar.style.display = 'flex'
  await window.electronAPI.setBubbleBounds(px, py, panelW, panelH)
  // Wait a frame for the resize to settle, then animate
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
  chatPanel.classList.add('panel-animate')
  await window.electronAPI.setBubbleOpacity(1)

  if (hasMessages) {
    chatInput.focus()
  } else {
    // Show morning summary if available, otherwise normal welcome
    if (morningData && !hasMessages) {
      renderMorningSummary(morningData)
    } else {
      welcomeInput.focus()
      // Load contextual suggestions based on what's on screen
      loadContextualSuggestions()
    }
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
  recBar.style.display = 'none'
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
let snappedScreen = null // display info at time of snap (avoids re-detection after move)
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
  const scrX = scr.x || 0
  const scrY = scr.y || 0
  const isVert = edge === 'left' || edge === 'right'
  const barW = isVert ? BAR_THICKNESS : BAR_LENGTH
  const barH = isVert ? BAR_LENGTH : BAR_THICKNESS

  let bx, by
  switch (edge) {
    case 'left':
      bx = scrX
      by = snappedCoord + (BUBBLE_SIZE - BAR_LENGTH) / 2
      break
    case 'right':
      bx = scrX + scr.width - BAR_THICKNESS
      by = snappedCoord + (BUBBLE_SIZE - BAR_LENGTH) / 2
      break
    case 'top':
      bx = snappedCoord + (BUBBLE_SIZE - BAR_LENGTH) / 2
      by = scrY
      break
    case 'bottom':
      bx = snappedCoord + (BUBBLE_SIZE - BAR_LENGTH) / 2
      by = scrY + scr.height - BAR_THICKNESS
      break
  }

  // Clamp to current display
  if (isVert) {
    by = Math.max(scrY, Math.min(by, scrY + scr.height - barH))
  } else {
    bx = Math.max(scrX, Math.min(bx, scrX + scr.width - barW))
  }

  return { x: bx, y: by, w: barW, h: barH }
}

async function snapIfNearEdge() {
  if (isExpanded) return

  const pos = await window.electronAPI.getBubblePos()
  const scr = await window.electronAPI.getScreenSize()
  const scrX = scr.x || 0
  const scrY = scr.y || 0

  // Check if near any edge (relative to current display)
  // Skip edges that border another monitor — don't snap between monitors
  const adj = scr.adjacent || {}
  const distLeft = adj.left ? Infinity : (pos.x - scrX)
  const distRight = adj.right ? Infinity : ((scrX + scr.width) - (pos.x + BUBBLE_SIZE))
  const distTop = adj.top ? Infinity : (pos.y - scrY)
  const distBottom = adj.bottom ? Infinity : ((scrY + scr.height) - (pos.y + BUBBLE_SIZE))
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
  const scrX = scr.x || 0
  const scrY = scr.y || 0

  // Save display info for later phases (bar, peek, hide) — avoids
  // re-detecting display after bubble moves partially off-screen
  snappedScreen = scr

  // Calculate distance to each edge (skip edges with adjacent monitors)
  const adj = scr.adjacent || {}
  const distances = {
    left: adj.left ? Infinity : (pos.x - scrX),
    right: adj.right ? Infinity : ((scrX + scr.width) - (pos.x + BUBBLE_SIZE)),
    top: adj.top ? Infinity : (pos.y - scrY),
    bottom: adj.bottom ? Infinity : ((scrY + scr.height) - (pos.y + BUBBLE_SIZE))
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
      snappedCoord = Math.max(scrY, Math.min(pos.y, scrY + scr.height - BUBBLE_SIZE))
      break
    case 'top':
    case 'bottom':
      snappedCoord = Math.max(scrX, Math.min(pos.x, scrX + scr.width - BUBBLE_SIZE))
      break
  }

  // Phase 1: Animate bubble (circle) toward the edge
  let targetX, targetY
  switch (snappedEdge) {
    case 'left':
      targetX = scrX - (BUBBLE_SIZE - VISIBLE_PX)
      targetY = snappedCoord
      break
    case 'right':
      targetX = scrX + scr.width - VISIBLE_PX
      targetY = snappedCoord
      break
    case 'top':
      targetX = snappedCoord
      targetY = scrY - (BUBBLE_SIZE - VISIBLE_PX)
      break
    case 'bottom':
      targetX = snappedCoord
      targetY = scrY + scr.height - VISIBLE_PX
      break
  }

  window.electronAPI.snapBubble(targetX, targetY, 250, { fadeOut: true })

  // Phase 2: After animation completes, morph circle into bar
  snapBarTimeout = setTimeout(async () => {
    snapBarTimeout = null
    if (isExpanded || !snappedEdge) return

    // Use saved display info — don't re-detect (bubble is off-screen now)
    const bar = getBarBounds(snappedEdge, snappedScreen)

    applyBarState(snappedEdge)
    await window.electronAPI.setBubbleOpacity(1) // reset opacity after fade-out animation
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

  // Use saved display info from snap time (avoids wrong display detection)
  const scr = snappedScreen || await window.electronAPI.getScreenSize()
  const scrX = scr.x || 0
  const scrY = scr.y || 0
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
      targetX = scrX + PEEK_OFFSET
      targetY = snappedCoord
      break
    case 'right':
      targetX = scrX + scr.width - BUBBLE_SIZE - PEEK_OFFSET
      targetY = snappedCoord
      break
    case 'top':
      targetX = snappedCoord
      targetY = scrY + PEEK_OFFSET
      break
    case 'bottom':
      targetX = snappedCoord
      targetY = scrY + scr.height - BUBBLE_SIZE - PEEK_OFFSET
      break
  }

  isHidden = false
  window.electronAPI.snapBubble(targetX, targetY, 150, { fadeIn: true })
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

  // Use saved display info from snap time
  const scr = snappedScreen || await window.electronAPI.getScreenSize()
  const bar = getBarBounds(snappedEdge, scr)

  applyBarState(snappedEdge)
  window.electronAPI.setBubbleBounds(bar.x, bar.y, bar.w, bar.h)

  isHidden = true
  setTimeout(() => { isAnimating = false }, 250)
}

// --- Global shortcut toggle (Cmd+Shift+Space) ---
if (window.electronAPI && window.electronAPI.onToggleBubble) {
  window.electronAPI.onToggleBubble(() => {
    if (isExpanded) {
      collapse()
    } else {
      expand()
    }
  })
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
  // Ignore clicks on header buttons
  if (e.target.closest('.btn-close') || e.target.closest('.btn-header-action')) return
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

// --- Home (new conversation) ---
btnHome.addEventListener('click', goHome)

function goHome() {
  // End call if active
  if (isInCall) endCall()

  // Clear all messages from DOM
  const msgs = chatMessages.querySelectorAll('.msg-user-wrap, .msg-ai-wrap, .candidate-card, .thinking-indicator')
  msgs.forEach(el => el.remove())

  // Reset state
  conversationHistory = []
  hasMessages = false
  isSending = false
  suggestionsLoaded = false

  // Hide chat mode elements
  chatPills.style.display = 'none'
  chatInputBar.style.display = 'none'
  chatInput.value = ''

  // Show welcome state
  welcomeState.style.display = ''
  if (welcomeInput) welcomeInput.value = ''
  if (welcomeInput) welcomeInput.focus()
}

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

// --- Briefing Card ---
function addCandidateCard(searchResult) {
  const wrap = document.createElement('div')
  wrap.className = 'msg-ai-wrap'

  const candidates = searchResult.candidates || []
  const waMatch = searchResult.whatsapp_match
  const searchName = searchResult.search_name || ''
  const searchCompany = searchResult.search_company || ''

  if (candidates.length === 0 && !waMatch) {
    // No results found
    wrap.innerHTML = `${AVATAR_HTML}<div class="briefing-card">
      <div class="briefing-header">
        <div class="briefing-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>
        </div>
        <div class="briefing-title">Busca de Contato</div>
        <span class="briefing-badge badge-low">Não encontrado</span>
      </div>
      <div class="briefing-contact">
        <div class="briefing-contact-name">${escapeHtml(searchName)}</div>
        ${searchCompany ? `<div class="briefing-contact-detail">Empresa: ${escapeHtml(searchCompany)}</div>` : ''}
        <div class="briefing-contact-detail" style="color:#ff6b6b;margin-top:6px">Nenhum perfil encontrado nos resultados de busca.</div>
      </div>
    </div>`
    chatMessages.appendChild(wrap)
    chatMessages.scrollTop = chatMessages.scrollHeight
    return
  }

  const isInternal = searchResult.is_internal_search === true

  // Build candidate cards
  let candidatesHtml = ''
  candidates.forEach((c, i) => {
    const isFirst = i === 0
    candidatesHtml += `
      <div class="candidate-item ${isFirst ? 'candidate-primary' : ''}" data-candidate-index="${i}">
        <div class="candidate-info">
          <div class="candidate-name">${escapeHtml(c.name || searchName)}</div>
          ${c.title ? `<div class="candidate-title">${escapeHtml(c.title)}</div>` : ''}
          ${c.company ? `<div class="candidate-company">${escapeHtml(c.company)}</div>` : ''}
          ${c.location ? `<div class="candidate-location">${escapeHtml(c.location)}</div>` : ''}
        </div>
        <div class="candidate-actions">
          ${!isInternal && c.linkedin_url ? `<button class="candidate-linkedin-btn" data-linkedin-url="${escapeHtml(c.linkedin_url)}" title="Ver LinkedIn">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
          </button>` : ''}
          <button class="candidate-confirm-btn" data-confirm-index="${i}">${isInternal ? 'Esse' : 'Esse'}</button>
        </div>
      </div>`
  })

  // WhatsApp match info (skip uncertain matches to avoid confusion)
  const waHtml = (waMatch && !waMatch.uncertain) ? `
    <div class="candidate-wa-match">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="#16a34a"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492l4.634-1.215A11.95 11.95 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75c-2.115 0-4.142-.655-5.856-1.893l-.42-.249-2.747.72.735-2.686-.274-.435A9.724 9.724 0 012.25 12C2.25 6.615 6.615 2.25 12 2.25S21.75 6.615 21.75 12 17.385 21.75 12 21.75z"/></svg>
      <span>Encontrado no WhatsApp: ${escapeHtml(waMatch.contact_name || '')}</span>
    </div>` : ''

  // Internal team icon vs external search icon
  const headerIcon = isInternal
    ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>`
    : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>`

  const headerTitle = isInternal ? 'Colega Encontrado' : 'Contatos Encontrados'
  const badgeClass = isInternal ? 'badge-high' : 'badge-medium'
  const hintText = isInternal
    ? 'Membro da sua equipe.'
    : 'Clique em "Esse" para confirmar e gerar o briefing completo.'

  wrap.innerHTML = `${AVATAR_HTML}<div class="briefing-card candidate-card">
    <div class="briefing-header">
      <div class="briefing-icon">
        ${headerIcon}
      </div>
      <div class="briefing-title">${headerTitle}</div>
      <span class="briefing-badge ${badgeClass}">${candidates.length} resultado${candidates.length > 1 ? 's' : ''}</span>
    </div>
    <div class="candidate-search-query">
      Buscando: <strong>${escapeHtml(searchName)}</strong>${searchCompany ? ` da <strong>${escapeHtml(searchCompany)}</strong>` : ''}
    </div>
    ${waHtml}
    <div class="briefing-divider"></div>
    <div class="candidate-list">
      ${candidatesHtml}
    </div>
    <div class="candidate-hint">${hintText}</div>
  </div>`

  chatMessages.appendChild(wrap)

  // Attach event listeners for LinkedIn buttons (external only)
  if (!isInternal) {
    wrap.querySelectorAll('.candidate-linkedin-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        const url = btn.getAttribute('data-linkedin-url')
        if (url && window.electronAPI && window.electronAPI.executeDesktopAction) {
          window.electronAPI.executeDesktopAction({ type: 'open_url', target: url })
        }
      })
    })
  }

  // Attach event listeners for confirm buttons - sends confirmation message
  wrap.querySelectorAll('.candidate-confirm-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-confirm-index'))
      const candidate = candidates[idx]
      if (candidate) {
        if (isInternal) {
          // For internal team members, ask about their performance
          const confirmMsg = `Sim, é ${candidate.name}. Mostra a performance dele.`
          chatInput.value = confirmMsg
          sendMessage()
        } else {
          // For external contacts, generate briefing
          const confirmMsg = `Sim, é ${candidate.name}${candidate.company ? ` da ${candidate.company}` : ''}. Gera o briefing.`
          chatInput.value = confirmMsg
          sendMessage()
        }
      }
    })
  })

  chatMessages.scrollTop = chatMessages.scrollHeight
}

function addBriefingCard(enrich) {
  const wrap = document.createElement('div')
  wrap.className = 'msg-ai-wrap'

  const contact = enrich.contact || {}
  const contactName = contact.contact_name || contact.name || 'Contato'
  const contactCompany = contact.company || ''

  // Parse briefing sections from markdown
  const briefingHtml = renderRichContent(enrich.briefing || '')

  wrap.innerHTML = `${AVATAR_HTML}<div class="briefing-card">
    <div class="briefing-header">
      <div class="briefing-icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4-4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
      </div>
      <div class="briefing-title">Briefing Pré-Reunião</div>
    </div>
    <div class="briefing-contact">
      <div class="briefing-contact-name">${escapeHtml(contactName)}</div>
      ${contactCompany ? `<div class="briefing-contact-detail">Empresa: ${escapeHtml(contactCompany)}</div>` : ''}
    </div>
    <div class="briefing-divider"></div>
    <div class="briefing-content">${briefingHtml}</div>
    <div class="briefing-actions">
      ${enrich.linkedin_url ? '<button class="briefing-linkedin-btn" data-linkedin-url><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>Ver LinkedIn</button>' : ''}
    </div>
  </div>`

  chatMessages.appendChild(wrap)

  // Attach LinkedIn button event listener
  if (enrich.linkedin_url) {
    const btn = wrap.querySelector('[data-linkedin-url]')
    if (btn) {
      btn.addEventListener('click', () => {
        if (window.electronAPI && window.electronAPI.executeDesktopAction) {
          window.electronAPI.executeDesktopAction({ type: 'open_url', target: enrich.linkedin_url })
        }
      })
    }
  }

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

// ============================================================
// SEND MESSAGE (Agent API)
// ============================================================
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
    if (data.desktopActions && window.electronAPI) {
      for (const action of data.desktopActions) {
        try {
          // navigate_platform: open page inside the Electron app (not external browser)
          if (action.type === 'navigate_platform' && window.electronAPI.navigatePlatform) {
            const result = await window.electronAPI.navigatePlatform(action.target)
            if (!result.success) console.warn('[Navigate Platform] Failed:', action, result.error)
          } else if (window.electronAPI.executeDesktopAction) {
            const result = await window.electronAPI.executeDesktopAction(action)
            if (!result.success) console.warn('[Desktop Action] Failed:', action, result.error)
          }
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
            if (data2.desktopActions && window.electronAPI) {
              for (const action of data2.desktopActions) {
                try {
                  if (action.type === 'navigate_platform' && window.electronAPI.navigatePlatform) {
                    await window.electronAPI.navigatePlatform(action.target)
                  } else if (window.electronAPI.executeDesktopAction) {
                    await window.electronAPI.executeDesktopAction(action)
                  }
                } catch (_) {}
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

    // Handle contact search results: show candidate confirmation card
    if (data.contactCandidates && data.contactCandidates.length > 0) {
      for (const searchResult of data.contactCandidates) {
        addCandidateCard(searchResult)
      }
    }

    // Handle briefing results: show full briefing card
    if (data.enrichActions && data.enrichActions.length > 0) {
      for (const enrich of data.enrichActions) {
        if (enrich.briefing) {
          addBriefingCard(enrich)
        }
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

    // Lines already containing HTML from tag replacements ({{score}}, {{spin}}, etc.)
    // Pass through directly — do NOT escape
    if (trimmed.startsWith('<div') || trimmed.startsWith('<em>') || trimmed.startsWith('<strong>')) {
      if (inList) { html += '</div>'; inList = false }
      html += trimmed
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

// --- Recording state indicator (Meet auto-detection) ---
const recBadge = document.getElementById('rec-badge')
const recBar = document.getElementById('rec-bar')
const btnStopRec = document.getElementById('btn-stop-rec')
let isBubbleRecording = false

if (window.electronAPI && window.electronAPI.onRecordingState) {
  window.electronAPI.onRecordingState((isRec) => {
    isBubbleRecording = isRec
    if (isRec) {
      bubble.classList.add('recording')
      if (recBadge) recBadge.style.display = 'flex'
      // Show rec bar in expanded chat panel
      if (isExpanded && recBar) recBar.style.display = 'flex'
    } else {
      bubble.classList.remove('recording')
      if (recBadge) recBadge.style.display = 'none'
      if (recBar) recBar.style.display = 'none'
    }
  })
}

// Clicking REC badge (collapsed) or Stop button (expanded) → show end card
if (recBadge) {
  recBadge.addEventListener('click', (e) => {
    e.stopPropagation()
    if (isBubbleRecording) showMeetPrompt()
  })
}

if (btnStopRec) {
  btnStopRec.addEventListener('click', (e) => {
    e.stopPropagation()
    if (isBubbleRecording) showMeetPrompt()
  })
}

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
  if (meetStartSubtitle) meetStartSubtitle.textContent = codeMatch ? codeMatch[0] : ''

  // Hide bubble and chat panel, show start prompt
  bubble.style.display = 'none'
  chatPanel.style.display = 'none'
  if (meetStartPrompt) meetStartPrompt.style.display = 'block'

  enableMouseCapture()
  window.electronAPI.resizeBubble(300, 240)
}

async function hideMeetStartPrompt() {
  meetStartPromptVisible = false
  if (meetStartPrompt) meetStartPrompt.style.display = 'none'

  // Restore to expanded or collapsed state
  if (isExpanded) {
    chatPanel.style.display = 'flex'
    enableMouseCapture()
    const panelW = 420
    const panelH = 780
    if (savedBubblePos) {
      await window.electronAPI.setBubbleBounds(savedBubblePos.x, savedBubblePos.y, panelW, panelH)
    } else {
      await window.electronAPI.resizeBubble(panelW, panelH)
    }
  } else {
    // Hide window → resize → show bubble (same pattern as collapse)
    await window.electronAPI.setBubbleOpacity(0)
    bubble.style.display = 'flex'
    if (savedBubblePos) {
      await window.electronAPI.setBubbleBounds(savedBubblePos.x, savedBubblePos.y, BUBBLE_SIZE, BUBBLE_SIZE)
    } else {
      await window.electronAPI.resizeBubble(BUBBLE_SIZE, BUBBLE_SIZE)
    }
    disableMouseCapture()
    await window.electronAPI.setBubbleOpacity(1)
  }
}

if (btnMeetStartYes) {
  btnMeetStartYes.addEventListener('click', () => {
    hideMeetStartPrompt()
    window.electronAPI.confirmMeetingStart()
  })
}

if (btnMeetStartNo) {
  btnMeetStartNo.addEventListener('click', () => {
    hideMeetStartPrompt()
    window.electronAPI.dismissMeetingStart()
  })
}

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
  if (meetPrompt) meetPrompt.style.display = 'block'

  // Expand window to fit the prompt card
  enableMouseCapture()
  window.electronAPI.resizeBubble(240, 180)
}

async function hideMeetPrompt() {
  meetPromptVisible = false
  if (meetPrompt) meetPrompt.style.display = 'none'

  // Restore to expanded or collapsed state
  if (isExpanded) {
    chatPanel.style.display = 'flex'
    enableMouseCapture()
    const panelW = 420
    const panelH = 780
    if (savedBubblePos) {
      await window.electronAPI.setBubbleBounds(savedBubblePos.x, savedBubblePos.y, panelW, panelH)
    } else {
      await window.electronAPI.resizeBubble(panelW, panelH)
    }
  } else {
    // Hide window → resize → show bubble (same pattern as collapse)
    await window.electronAPI.setBubbleOpacity(0)
    bubble.style.display = 'flex'
    if (savedBubblePos) {
      await window.electronAPI.setBubbleBounds(savedBubblePos.x, savedBubblePos.y, BUBBLE_SIZE, BUBBLE_SIZE)
    } else {
      await window.electronAPI.resizeBubble(BUBBLE_SIZE, BUBBLE_SIZE)
    }
    disableMouseCapture()
    await window.electronAPI.setBubbleOpacity(1)
  }
}

if (btnMeetYes) {
  btnMeetYes.addEventListener('click', () => {
    hideMeetPrompt()
    window.electronAPI.confirmMeetingEnded()
  })
}

if (btnMeetNo) {
  btnMeetNo.addEventListener('click', () => {
    hideMeetPrompt()
    window.electronAPI.dismissMeetingEnded()
  })
}

// Listen for prompt request from main process
if (window.electronAPI && window.electronAPI.onAskMeetingEnded) {
  window.electronAPI.onAskMeetingEnded(() => {
    showMeetPrompt()
  })
}

// --- Init ---
// Auth token will be received via IPC from main window
