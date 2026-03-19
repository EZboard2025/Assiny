const { app, BrowserWindow, BaseWindow, WebContentsView, ipcMain, session, desktopCapturer, shell, screen, Tray, Menu, nativeImage, Notification, globalShortcut, systemPreferences, dialog, powerSaveBlocker } = require('electron')
const path = require('path')
const fs = require('fs')
const { exec } = require('child_process')
const { isBlackHoleInstalled, installBlackHoleDriver, createMultiOutputDevice, destroyMultiOutputDevice } = require('./audio-devices')

// File-based logging for auto-scan debugging
const LOG_FILE = '/tmp/electron-debug.log'
function debugLog(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`
  try { fs.appendFileSync(LOG_FILE, line) } catch {}
  try { console.log(msg) } catch {}
}

debugLog('=== Electron main.js loaded ===')

// Persisted scan state (survives app restarts)
const SCAN_STATE_FILE = path.join(app.getPath('userData'), 'scan-state.json')

function getLastAutoScanDate() {
  try {
    if (fs.existsSync(SCAN_STATE_FILE)) {
      const data = JSON.parse(fs.readFileSync(SCAN_STATE_FILE, 'utf8'))
      return data.lastAutoScanDate || null
    }
  } catch (e) {
    debugLog('[Scan State] Error reading: ' + e.message)
  }
  return null
}

function setLastAutoScanDate(dateString) {
  try {
    fs.writeFileSync(SCAN_STATE_FILE, JSON.stringify({ lastAutoScanDate: dateString }))
  } catch (e) {
    debugLog('[Scan State] Error writing: ' + e.message)
  }
}

// System audio loopback is handled via setDisplayMediaRequestHandler (see app.whenReady)

// DEV: use localhost | PROD: use ramppy.site
const IS_DEV = !app.isPackaged
const PLATFORM_URL = IS_DEV ? 'http://localhost:3000' : 'https://ramppy.site'
const ALLOWED_DOMAIN = 'ramppy.site'

const iconFile = process.platform === 'win32' ? 'icon.ico' : 'icon.png'
const ICON_PATH = path.join(__dirname, 'assets', iconFile)
const APP_ICON = nativeImage.createFromPath(ICON_PATH)

// Force Windows taskbar to use our icon instead of default Electron icon
app.setAppUserModelId('com.ramppy.app')

// Auto-start: open Ramppy when user logs in to the computer
if (app.isPackaged) {
  app.setLoginItemSettings({
    openAtLogin: true,
    name: 'Ramppy'
  })
}

// Allow audio autoplay without user gesture (needed for TTS in bubble window)
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')
// Force Wave audio backend (bypasses WASAPI routing issues on Windows)
app.commandLine.appendSwitch('force-wave-audio')
// Disable audio sandboxing that can block output on Windows
app.commandLine.appendSwitch('disable-features', 'AudioServiceSandbox,AudioServiceOutOfProcess')
app.commandLine.appendSwitch('disable-renderer-backgrounding')
app.commandLine.appendSwitch('no-sandbox')

let mainWindow = null
let bubbleWindow = null
let recordingWindow = null
let whatsappBaseWindow = null // Single window for WhatsApp + Copilot
let waView = null             // WebContentsView: WhatsApp Web (left)
let copilotView = null        // WebContentsView: Sales Copilot (right)
let notificationWindow = null
let isAutoScanRunning = false // Prevents scraper re-injection during auto-scan
let authTokenInterval = null
let tray = null

const COPILOT_WIDTH = 400
const COPILOT_COLLAPSED_WIDTH = 48
let copilotExpanded = true

// WhatsApp scraper state (forwarded to copilot view)
let whatsappContext = { active: false, contactName: null, contactPhone: null, messages: [] }
let lastSidebarList = []  // Latest sidebar conversation list from scraper

// Desktop → Server message sync state
let syncedMessageKeys = new Map()  // Map<contactPhone, Set<localKey>> — client-side dedup
let syncQueue = []                 // Array of { contactPhone, contactName, messages }
let syncTimer = null               // Periodic sync interval (10s)
let isSyncing = false              // Prevent concurrent sync calls

// Meet auto-detection state
let meetDetectionInterval = null
let isRecordingMeet = false
let detectedMeetTitle = null
let hasUserAuth = false
let lastRecordedMeetCode = null // Prevents re-recording same meeting after user leaves
let meetWindowGoneCount = 0 // Debounce counter for Meet tab disappearing
let noActiveMeetCount = 0 // Tracks how long activeMeet is null while meetTabAny still exists
let meetHadAudioIndicator = false // Whether the meet title had 🔊 at some point during recording
let waitingForMeetReactivation = false // After user dismisses "ended?" card, wait for Meet to become active again before re-asking
let dismissCooldownUntil = null // Timestamp: don't re-ask until this time passes (60s after dismiss)
let pendingMeetConfirmation = false // Waiting for user to confirm/decline recording
let pendingMeetTitle = null // Title of the meeting awaiting confirmation
let declinedMeetCode = null // Meeting code the user declined (don't ask again)
let powerSaveBlockerId = null // Prevents macOS App Nap during recording
// will-move prevention removed — frame:false means OS won't drag the window

// Single instance lock — prevent duplicate app processes
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    // Focus existing main window when user tries to open a second instance
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
  })
}

// ============================================================
// MAIN WINDOW (full platform)
// ============================================================
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    resizable: true,
    minWidth: 900,
    minHeight: 600,
    title: 'Ramppy',
    icon: APP_ICON,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      sandbox: false, // Required for audio playback on Windows
    },
  })

  // Garantir que áudio não está mutado
  mainWindow.webContents.setAudioMuted(false)

  // Force audio session initialization on Windows — play test tone on load
  mainWindow.webContents.on('did-finish-load', async () => {
    mainWindow.webContents.setAudioMuted(false)
    console.log('[Audio] Window audio muted:', mainWindow.webContents.isAudioMuted())

    // Play a silent then audible test tone to initialize Windows audio session
    try {
      const result = await mainWindow.webContents.executeJavaScript(`
        (async () => {
          try {
            const ctx = new AudioContext();
            if (ctx.state === 'suspended') await ctx.resume();
            // Play a very short 440Hz tone to force Windows to create the audio session
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = 440;
            gain.gain.value = 0.01; // nearly silent
            osc.start();
            await new Promise(r => setTimeout(r, 100));
            osc.stop();
            await ctx.close();
            return { ok: true, state: 'initialized', sampleRate: ctx.sampleRate };
          } catch (e) {
            return { ok: false, error: e.message };
          }
        })()
      `)
      try { console.log('[Audio] Init result:', JSON.stringify(result)) } catch {}
    } catch (e) {
      try { console.error('[Audio] Init failed:', e.message) } catch {}
    }
  })

  mainWindow.loadURL(PLATFORM_URL)
  mainWindow.webContents.setZoomFactor(1.2)
  mainWindow.setMenuBarVisibility(false)

  // Force taskbar icon on Windows
  if (process.platform === 'win32') {
    mainWindow.setIcon(APP_ICON)
  }

  // Open external links in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const hostname = new URL(url).hostname
      if (hostname.endsWith(ALLOWED_DOMAIN) || hostname === 'localhost') {
        return { action: 'allow' }
      }
    } catch (_) {}
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // F12 to toggle DevTools, F5/Ctrl+R to reload
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12') {
      mainWindow.webContents.toggleDevTools()
    }
    if (input.key === 'F5' || (input.control && input.key === 'r')) {
      mainWindow.reload()
    }
  })

  // "X" hides to tray instead of quitting
  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault()
      mainWindow.hide()
      // Hide bubble and other windows too
      if (bubbleWindow && !bubbleWindow.isDestroyed()) bubbleWindow.hide()
      if (whatsappBaseWindow && !whatsappBaseWindow.isDestroyed()) whatsappBaseWindow.hide()
      if (notificationWindow && !notificationWindow.isDestroyed()) notificationWindow.hide()
    }
  })

  // Proactive notifications disabled — too intrusive
  // mainWindow.on('focus', () => {
  //   if (bubbleWindow && !bubbleWindow.isDestroyed()) {
  //     bubbleWindow.webContents.send('notification-nudge')
  //   }
  // })

  mainWindow.on('closed', () => {
    mainWindow = null
    if (bubbleWindow && !bubbleWindow.isDestroyed()) {
      bubbleWindow.close()
    }
    if (recordingWindow && !recordingWindow.isDestroyed()) {
      recordingWindow.close()
    }
    if (authTokenInterval) {
      clearInterval(authTokenInterval)
      authTokenInterval = null
    }
  })
}

// ============================================================
// MULTI-MONITOR: get combined bounds of all displays
// ============================================================
function getAllScreenBounds() {
  const displays = screen.getAllDisplays()
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const d of displays) {
    const { x, y, width, height } = d.workArea
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x + width > maxX) maxX = x + width
    if (y + height > maxY) maxY = y + height
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY, maxX, maxY }
}

// Get the display that contains the given point
function getDisplayAt(px, py) {
  const displays = screen.getAllDisplays()
  for (const d of displays) {
    const { x, y, width, height } = d.workArea
    if (px >= x && px < x + width && py >= y && py < y + height) return d
  }
  return screen.getPrimaryDisplay()
}

// Check which edges of a display have an adjacent monitor (should NOT snap there)
function getAdjacentEdges(display) {
  const displays = screen.getAllDisplays()
  const a = display.workArea
  const GAP = 50 // tolerance for edge alignment
  const result = { left: false, right: false, top: false, bottom: false }

  for (const d of displays) {
    if (d.id === display.id) continue
    const b = d.workArea
    // Vertical overlap check (monitors share Y range)
    const vOverlap = b.y < a.y + a.height && b.y + b.height > a.y
    // Horizontal overlap check (monitors share X range)
    const hOverlap = b.x < a.x + a.width && b.x + b.width > a.x

    if (vOverlap) {
      // Left edge: another display's right edge touches our left
      if (Math.abs((b.x + b.width) - a.x) < GAP) result.left = true
      // Right edge: another display's left edge touches our right
      if (Math.abs(b.x - (a.x + a.width)) < GAP) result.right = true
    }
    if (hOverlap) {
      // Top edge: another display's bottom touches our top
      if (Math.abs((b.y + b.height) - a.y) < GAP) result.top = true
      // Bottom edge: another display's top touches our bottom
      if (Math.abs(b.y - (a.y + a.height)) < GAP) result.bottom = true
    }
  }
  return result
}

// ============================================================
// BUBBLE WINDOW (floating assistant)
// ============================================================
function createBubbleWindow() {
  const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize

  bubbleWindow = new BrowserWindow({
    width: 72,
    height: 72,
    x: screenW - 90,
    y: screenH - 90,
    resizable: false,
    movable: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: true,
    hasShadow: false,
    show: false,
    title: 'Ramppy Assistant',
    icon: APP_ICON,
    visibleOnAllWorkspaces: true,
    fullscreenable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // Highest window level + relative bump
  bubbleWindow.setAlwaysOnTop(true, 'floating', 1)
  bubbleWindow.setVisibleOnAllWorkspaces(true, {
    visibleOnFullScreen: true,
    skipTransformProcessType: true,
  })

  bubbleWindow.loadFile('bubble.html')
  bubbleWindow.setMenuBarVisibility(false)

  // Start with mouse events enabled — the window is small (72x72) so it doesn't block much.
  // setIgnoreMouseEvents(true, {forward:true}) is unreliable on macOS with transparent windows.
  // When expanded, the bubble.js handles enabling/disabling via IPC as needed.

  // Re-assert on blur (other apps stealing z-order)
  bubbleWindow.on('blur', () => {
    if (bubbleWindow && !bubbleWindow.isDestroyed()) {
      bubbleWindow.setAlwaysOnTop(true, 'floating', 1)
    }
  })

  // Re-assert on show
  bubbleWindow.on('show', () => {
    if (bubbleWindow && !bubbleWindow.isDestroyed()) {
      bubbleWindow.setAlwaysOnTop(true, 'floating', 1)
      bubbleWindow.setVisibleOnAllWorkspaces(true, {
        visibleOnFullScreen: true,
        skipTransformProcessType: true,
      })
    }
  })

  // Re-apply always-on-top periodically and force focus recovery
  setInterval(() => {
    if (bubbleWindow && !bubbleWindow.isDestroyed() && bubbleWindow.isVisible()) {
      bubbleWindow.setAlwaysOnTop(true, 'floating', 1)
      // On macOS, moveTop() brings window above fullscreen apps
      bubbleWindow.moveTop()
    }
  }, 2000)

  // F12 for DevTools on bubble too
  bubbleWindow.webContents.on('before-input-event', (_event, input) => {
    if (input.key === 'F12') {
      bubbleWindow.webContents.toggleDevTools()
    }
  })

  // No will-move handler needed: frame:false + no -webkit-app-region:drag
  // means the OS won't initiate moves. All moves are via IPC setBounds/moveBubble.

  // Forward console.log from bubble renderer to main process stdout (for debugging)
  bubbleWindow.webContents.on('console-message', (_event, _level, message) => {
    if (message.startsWith('[Bubble]') || message.startsWith('[Nicole]')) {
      console.log('[Bubble]', message)
    }
  })

  bubbleWindow.on('closed', () => { bubbleWindow = null })
}

// ============================================================
// RECORDING WINDOW (meeting audio capture)
// ============================================================
function createRecordingWindow(autoStart = false, meetingType = 'sales') {
  if (recordingWindow && !recordingWindow.isDestroyed()) {
    if (autoStart) {
      // New auto-recording requested — close stale window and create fresh
      recordingWindow.destroy()
      recordingWindow = null
    } else {
      recordingWindow.focus()
      return
    }
  }

  // Hide window when auto-starting: macOS needs BlackHole, Windows uses loopback natively
  const canBeHidden = autoStart && (process.platform === 'win32' || isBlackHoleInstalled())

  const { width: screenW } = screen.getPrimaryDisplay().workAreaSize

  recordingWindow = new BrowserWindow({
    width: 480,
    height: 700,
    x: screenW - 500,
    y: 20,
    resizable: true,
    minWidth: 400,
    minHeight: 500,
    frame: false,
    alwaysOnTop: true,
    show: !canBeHidden, // Hidden when BlackHole handles audio (no picker needed)
    title: 'Ramppy Recorder',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false, // CRITICAL: prevent audio drops when window is hidden
    },
  })

  recordingWindow.loadFile('recording.html')
  recordingWindow.setMenuBarVisibility(false)
  // Disable cache in dev to ensure latest JS is loaded
  if (IS_DEV) recordingWindow.webContents.session.clearCache()

  // Forward renderer console logs to main process stdout + file
  recordingWindow.webContents.on('console-message', (_event, level, message) => {
    const prefix = ['LOG', 'WARN', 'ERR'][level] || 'LOG'
    debugLog(`[Recorder:${prefix}] ${message}`)
  })

  // F12 for DevTools
  recordingWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12') {
      recordingWindow.webContents.toggleDevTools()
    }
  })

  // Auto-start recording after window loads (for Meet auto-detection)
  if (autoStart) {
    recordingWindow.webContents.on('did-finish-load', () => {
      // Immediately forward auth token if available
      const forwardAuthAndStart = async () => {
        if (!mainWindow || mainWindow.isDestroyed() || !recordingWindow || recordingWindow.isDestroyed()) return

        try {
          const authData = await mainWindow.webContents.executeJavaScript(`
            (function() {
              try {
                for (let i = 0; i < localStorage.length; i++) {
                  const key = localStorage.key(i);
                  if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
                    const raw = localStorage.getItem(key);
                    if (raw) {
                      const parsed = JSON.parse(raw);
                      if (parsed && parsed.access_token) {
                        return JSON.stringify({
                          accessToken: parsed.access_token,
                          userId: parsed.user ? parsed.user.id : null,
                        });
                      }
                    }
                  }
                }
              } catch(e) {}
              return null;
            })()
          `)

          if (authData && recordingWindow && !recordingWindow.isDestroyed()) {
            const parsed = JSON.parse(authData)
            // Send auth token directly to recording window
            recordingWindow.webContents.send('auth-token', parsed)
            // Wait a moment for auth to be processed, then auto-start
            setTimeout(() => {
              if (recordingWindow && !recordingWindow.isDestroyed()) {
                recordingWindow.webContents.send('auto-start-recording', meetingType)
              }
            }, 1000)
          }
        } catch (err) {
          console.error('[Recorder] Failed to forward auth for auto-start:', err)
          // Fallback: wait for regular auth bridge
          setTimeout(() => {
            if (recordingWindow && !recordingWindow.isDestroyed()) {
              recordingWindow.webContents.send('auto-start-recording')
            }
          }, 4000)
        }
      }

      forwardAuthAndStart()
    })
  }

  recordingWindow.on('closed', () => {
    recordingWindow = null
    // If recording was auto-started and window was closed manually, reset state
    if (isRecordingMeet) {
      isRecordingMeet = false
      detectedMeetTitle = null
      meetHadAudioIndicator = false
      noActiveMeetCount = 0
      meetWindowGoneCount = 0
      waitingForMeetReactivation = false
      stopPowerSaveBlocker()
    }
    // Always notify bubble that recording stopped
    if (bubbleWindow && !bubbleWindow.isDestroyed()) {
      bubbleWindow.webContents.send('recording-state', false)
    }
  })
}

// ============================================================
// WHATSAPP + COPILOT WINDOW (unified: BaseWindow with two WebContentsViews)
// ============================================================
function createWhatsAppWindow() {
  if (whatsappBaseWindow && !whatsappBaseWindow.isDestroyed()) {
    whatsappBaseWindow.focus()
    return
  }

  const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize
  const winWidth = Math.min(1400, screenW - 40)
  const winHeight = Math.min(750, screenH - 40)

  // Configure the WhatsApp partition with proper permissions
  const waSession = session.fromPartition('persist:whatsapp')
  waSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(true)
  })
  waSession.setPermissionCheckHandler(() => true)

  // Use a real Chrome user agent (WhatsApp Web blocks non-standard browsers)
  const electronVersion = process.versions.chrome || '131.0.0.0'
  const chromeUA = `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${electronVersion} Safari/537.36`

  // Single container window (no own webContents)
  whatsappBaseWindow = new BaseWindow({
    width: winWidth,
    height: winHeight,
    minWidth: 900,
    minHeight: 500,
    title: 'WhatsApp — Ramppy',
    icon: path.join(__dirname, 'assets', 'icon.png'),
  })

  // --- WhatsApp view (left side) ---
  waView = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, 'whatsapp-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      partition: 'persist:whatsapp',
    },
  })
  whatsappBaseWindow.contentView.addChildView(waView)
  waView.webContents.setUserAgent(chromeUA)
  waView.webContents.loadURL('https://web.whatsapp.com')

  // --- Copilot view (right side, overlaps WhatsApp for rounded corner effect) ---
  copilotView = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      transparent: true,
    },
  })
  copilotView.setBackgroundColor('#00000000')
  whatsappBaseWindow.contentView.addChildView(copilotView)
  copilotView.webContents.loadFile('copilot.html')

  // --- Layout: WhatsApp fills left, copilot fixed 400px right ---
  layoutWhatsAppViews()
  whatsappBaseWindow.on('resize', layoutWhatsAppViews)

  // --- Inject scraper into WhatsApp view ---
  const injectScraper = () => {
    if (!waView || !whatsappBaseWindow || whatsappBaseWindow.isDestroyed()) return
    // Skip re-injection during auto-scan (clicking conversations triggers did-navigate-in-page)
    if (isAutoScanRunning) {
      console.log('[WhatsApp] Skipping scraper re-injection (auto-scan active)')
      return
    }
    const fs = require('fs')
    const scraperPath = path.join(__dirname, 'whatsapp-scraper.js')
    try {
      const scraperCode = fs.readFileSync(scraperPath, 'utf-8')
      waView.webContents.executeJavaScript(scraperCode).catch(err => {
        console.warn('[WhatsApp] Scraper execution warning:', err.message)
      })
      scraperInjected = true
      console.log('[WhatsApp] Scraper injected successfully')
    } catch (err) {
      console.error('[WhatsApp] Failed to inject scraper:', err)
    }
  }

  waView.webContents.on('did-finish-load', injectScraper)
  waView.webContents.on('did-navigate-in-page', injectScraper)

  // Forward WhatsApp WebView console logs to main process (for debugging scraper)
  waView.webContents.on('console-message', (_event, level, message) => {
    if (message.includes('[Ramppy Scraper]') || message.includes('[Ramppy Auto-Scan]')) {
      console.log(`[WA WebView] ${message}`)
    }
  })

  // --- Send initial WhatsApp state to copilot once it loads ---
  copilotView.webContents.on('did-finish-load', () => {
    console.log('[Copilot] View loaded, forwarding initial WhatsApp state:', whatsappContext.active ? whatsappContext.contactName : 'inactive')
    copilotView.webContents.send('whatsapp-state', whatsappContext)
  })

  // --- Periodic state sync: ensure copilot stays in sync with scraper ---
  const stateSyncInterval = setInterval(() => {
    if (!copilotView || copilotView.webContents.isDestroyed()) {
      clearInterval(stateSyncInterval)
      return
    }
    if (whatsappContext.active) {
      copilotView.webContents.send('whatsapp-state', whatsappContext)
    }
  }, 3000)

  // --- F12 for DevTools on both views ---
  waView.webContents.on('before-input-event', (_event, input) => {
    if (input.key === 'F12') {
      waView.webContents.toggleDevTools()
    }
  })
  copilotView.webContents.on('before-input-event', (_event, input) => {
    if (input.key === 'F12') {
      copilotView.webContents.toggleDevTools()
    }
  })

  // --- Desktop WhatsApp heartbeat: report connection status to server ---
  let desktopWaHeartbeatInterval = null
  let desktopWaAuthenticated = false

  const checkWaAuth = async () => {
    if (!waView || waView.webContents.isDestroyed()) return
    try {
      const isAuth = await waView.webContents.executeJavaScript(`
        !!(document.querySelector('[data-testid="chatlist-header"]') ||
           document.querySelector('div[aria-label="Lista de conversas"]') ||
           document.querySelector('div[data-testid="chat-list"]') ||
           document.querySelector('#pane-side'))
      `)
      if (isAuth && !desktopWaAuthenticated) {
        desktopWaAuthenticated = true
        debugLog('[WhatsApp Desktop] User authenticated — starting heartbeats + sync')
        sendDesktopWaHeartbeat('active')
        desktopWaHeartbeatInterval = setInterval(() => sendDesktopWaHeartbeat('active'), 10000)
        startSyncTimer()
        // Auto-scan: wait 2s for sidebar to populate, then scrape changed conversations
        debugLog('[WhatsApp Desktop] Auto-scan scheduled in 2s...')
        setTimeout(() => triggerAutoScan(), 2000)
      } else if (!isAuth && desktopWaAuthenticated) {
        desktopWaAuthenticated = false
        console.log('[WhatsApp Desktop] User logged out — stopping heartbeats + sync')
        if (desktopWaHeartbeatInterval) { clearInterval(desktopWaHeartbeatInterval); desktopWaHeartbeatInterval = null }
        sendDesktopWaHeartbeat('disconnected')
        stopSyncTimer()
      }
    } catch (_) { /* page not ready */ }
  }

  const waAuthCheckInterval = setInterval(checkWaAuth, 3000)
  // First check after WhatsApp Web loads (fast: 2s)
  waView.webContents.on('did-finish-load', () => setTimeout(checkWaAuth, 2000))

  let pendingScrapeResults = []
  let pendingCommandResults = []

  async function sendDesktopWaHeartbeat(status) {
    try {
      // Get auth token from main window
      if (!mainWindow || mainWindow.isDestroyed()) return
      const authData = await mainWindow.webContents.executeJavaScript(`
        (function() {
          try {
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
                const raw = localStorage.getItem(key);
                if (raw) {
                  const parsed = JSON.parse(raw);
                  if (parsed?.access_token) return parsed.access_token;
                }
              }
            }
          } catch(e) {}
          return null;
        })()
      `)
      if (!authData) return

      const url = PLATFORM_URL + '/api/whatsapp/desktop-heartbeat'
      const bodyPayload = { status }
      // Attach pending scrape results if any
      if (pendingScrapeResults.length > 0) {
        bodyPayload.scrapeResults = pendingScrapeResults.splice(0)
      }
      // Attach pending command results if any
      if (pendingCommandResults.length > 0) {
        bodyPayload.commandResults = pendingCommandResults.splice(0)
      }
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authData}`
        },
        body: JSON.stringify(bodyPayload)
      })
      const result = await response.json()
      console.log(`[WhatsApp Desktop] Heartbeat sent: ${status}`, result.ok ? '✓' : result.error)

      // Process scrape commands from server
      if (result.scrapeCommands && result.scrapeCommands.length > 0) {
        debugLog(`[Targeted Scrape] Received ${result.scrapeCommands.length} command(s) from server`)
        for (const cmd of result.scrapeCommands) {
          await executeTargetedScrape(cmd)
        }
        // Send immediate heartbeat to report results
        if (pendingScrapeResults.length > 0) {
          sendDesktopWaHeartbeat('active')
        }
      }

      // Process desktop commands from server (command queue)
      if (result.desktopCommands && result.desktopCommands.length > 0) {
        debugLog(`[Command Queue] Received ${result.desktopCommands.length} command(s)`)
        for (const cmd of result.desktopCommands) {
          await executeDesktopCommand(cmd)
        }
        // Send immediate heartbeat to report command results
        if (pendingCommandResults.length > 0) {
          sendDesktopWaHeartbeat('active')
        }
      }
    } catch (err) {
      console.error('[WhatsApp Desktop] Heartbeat failed:', err.message)
    }
  }

  // --- Desktop Command Executor (command queue) ---
  async function executeDesktopCommand(cmd) {
    const { commandId, type, payload } = cmd
    debugLog(`[Command Queue] Executing: ${type} (${commandId})`)

    if (!waView || waView.webContents.isDestroyed()) {
      pendingCommandResults.push({ commandId, error: 'whatsapp_not_open' })
      return
    }

    try {
      switch (type) {
        case 'send_text': {
          const { contactPhone, contactName, message } = payload
          const target = contactPhone || contactName
          if (!target || !message) {
            pendingCommandResults.push({ commandId, error: 'missing_contact_or_message' })
            return
          }

          // 1. Navigate to the contact
          const navResult = await waView.webContents.executeJavaScript(
            `window.__ramppyNavigateToContact(${JSON.stringify(target)})`
          )
          if (!navResult || !navResult.success) {
            // Try with contactName if phone didn't work
            let retryResult = null
            if (contactName && contactName !== target) {
              retryResult = await waView.webContents.executeJavaScript(
                `window.__ramppyNavigateToContact(${JSON.stringify(contactName)})`
              )
            }
            if (!retryResult || !retryResult.success) {
              pendingCommandResults.push({
                commandId,
                error: `contact_not_found: ${target}`,
              })
              return
            }
          }

          // 2. Small delay to simulate natural typing
          await new Promise(r => setTimeout(r, 500 + Math.random() * 1000))

          // 3. Inject the text
          const injected = await waView.webContents.executeJavaScript(
            `(function() {
              var input = (function trySelect(parent, selectors) {
                var sels = Array.isArray(selectors) ? selectors : [selectors];
                for (var i = 0; i < sels.length; i++) {
                  var el = parent.querySelector(sels[i]);
                  if (el) return el;
                }
                return null;
              })(document, ${JSON.stringify(SELECTORS_FOR_JS.inputField)});
              if (!input) return false;
              input.focus();
              input.textContent = '';
              document.execCommand('insertText', false, ${JSON.stringify(message)});
              input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: ${JSON.stringify(message)} }));
              return true;
            })()`
          )

          if (!injected) {
            pendingCommandResults.push({ commandId, error: 'input_field_not_found' })
            return
          }

          // 4. Small delay then press Enter
          await new Promise(r => setTimeout(r, 300 + Math.random() * 500))

          await waView.webContents.executeJavaScript(
            `window.__ramppySendMessage()`
          )

          debugLog(`[Command Queue] send_text completed: "${message.substring(0, 50)}..." to ${target}`)
          pendingCommandResults.push({ commandId, result: { sent: true, to: target } })
          break
        }

        case 'navigate_to_contact': {
          const target = payload.contactPhone || payload.contactName
          if (!target) {
            pendingCommandResults.push({ commandId, error: 'missing_contact' })
            return
          }
          const navResult = await waView.webContents.executeJavaScript(
            `window.__ramppyNavigateToContact(${JSON.stringify(target)})`
          )
          if (!navResult || !navResult.success) {
            pendingCommandResults.push({ commandId, error: navResult?.error || 'navigation_failed' })
          } else {
            pendingCommandResults.push({ commandId, result: { navigated: true, contactName: navResult.contactName } })
          }
          break
        }

        default:
          debugLog(`[Command Queue] Unknown command type: ${type}`)
          pendingCommandResults.push({ commandId, error: `unknown_command_type: ${type}` })
      }
    } catch (err) {
      debugLog(`[Command Queue] Error executing ${type}: ${err.message}`)
      pendingCommandResults.push({ commandId, error: err.message })
    }
  }

  // Input field selectors (passed to executeJavaScript since scraper context is separate)
  const SELECTORS_FOR_JS = {
    inputField: [
      '#main footer div[contenteditable="true"]',
      '#main [data-testid="conversation-compose-box-input"]',
      '[data-testid="compose-box"] div[contenteditable="true"]',
      'footer div[contenteditable="true"]',
    ],
  }

  // --- Targeted Scrape (on-demand from manager) ---
  async function executeTargetedScrape(cmd) {
    const { requestId, contactName } = cmd
    debugLog(`[Targeted Scrape] Starting for "${contactName}" (request: ${requestId})`)

    if (!waView || waView.webContents.isDestroyed()) {
      pendingScrapeResults.push({ requestId, status: 'failed', error: 'whatsapp_not_open' })
      return
    }

    try {
      // 1. Find conversation in sidebar by name
      const cellInfo = await waView.webContents.executeJavaScript(`
        (function() {
          var targetName = ${JSON.stringify(contactName)};
          var pane = document.getElementById('pane-side');
          if (!pane) return null;
          var spans = pane.querySelectorAll('span[title]');
          var targetCell = null;
          for (var i = 0; i < spans.length; i++) {
            if (spans[i].getAttribute('title') === targetName) {
              var el = spans[i];
              while (el && el !== pane) {
                if (el.getAttribute('role') === 'row' || el.getAttribute('role') === 'listitem' ||
                    (el.dataset && el.dataset.testid === 'cell-frame-container')) {
                  targetCell = el;
                  break;
                }
                el = el.parentElement;
              }
              break;
            }
          }
          if (!targetCell) return null;
          var r = targetCell.getBoundingClientRect();
          if (r.top < 0 || r.bottom > window.innerHeight) {
            targetCell.scrollIntoView({ block: 'center' });
          }
          var clickTarget = targetCell.querySelector('div[tabindex="-1"]') || targetCell.querySelector('div[role="gridcell"]') || targetCell;
          r = clickTarget.getBoundingClientRect();
          return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
        })()
      `)

      if (!cellInfo) {
        debugLog(`[Targeted Scrape] "${contactName}" not found in sidebar`)
        pendingScrapeResults.push({ requestId, status: 'failed', error: 'contact_not_found' })
        return
      }

      // 2. Show fully opaque overlay (hides conversation switch from seller)
      await waView.webContents.executeJavaScript(`
        (function() {
          var existing = document.getElementById('ramppy-scrape-overlay');
          if (existing) existing.remove();
          var overlay = document.createElement('div');
          overlay.id = 'ramppy-scrape-overlay';
          overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:#111b21;z-index:9999;display:flex;align-items:center;justify-content:center;pointer-events:all;';
          document.body.appendChild(overlay);
        })()
      `)

      // 3. Allow click through overlay (pointer-events:none) — overlay stays visible
      await waView.webContents.executeJavaScript(`
        document.getElementById('ramppy-scrape-overlay').style.pointerEvents = 'none';
      `)
      await new Promise(r => setTimeout(r, 50))

      waView.webContents.sendInputEvent({ type: 'mouseDown', x: cellInfo.x, y: cellInfo.y, button: 'left', clickCount: 1 })
      waView.webContents.sendInputEvent({ type: 'mouseUp', x: cellInfo.x, y: cellInfo.y, button: 'left', clickCount: 1 })

      await new Promise(r => setTimeout(r, 50))
      await waView.webContents.executeJavaScript(`
        var ov = document.getElementById('ramppy-scrape-overlay');
        if (ov) ov.style.pointerEvents = 'all';
      `)

      // 4. Wait for #main panel (conversation loaded)
      const mainReady = await waView.webContents.executeJavaScript(`
        new Promise(function(resolve) {
          var checks = 0;
          var iv = setInterval(function() {
            checks++;
            if (document.querySelector('#main') || checks >= 25) {
              clearInterval(iv);
              resolve(!!document.querySelector('#main'));
            }
          }, 200);
        })
      `)

      if (!mainReady) {
        debugLog(`[Targeted Scrape] #main panel not loaded for "${contactName}"`)
        pendingScrapeResults.push({ requestId, status: 'failed', error: 'panel_not_loaded' })
        await waView.webContents.executeJavaScript(`
          var ov = document.getElementById('ramppy-scrape-overlay'); if (ov) ov.remove();
        `).catch(() => {})
        return
      }

      await new Promise(r => setTimeout(r, 500))

      // 5. Extract messages using injected scraper functions
      const data = await waView.webContents.executeJavaScript(`
        (function() {
          var contactName = typeof getContactName === 'function' ? getContactName() : null;
          var contactPhone = typeof getContactPhone === 'function' ? getContactPhone() : null;
          var messages = typeof extractMessages === 'function' ? extractMessages() : [];
          return { contactName: contactName, contactPhone: contactPhone, msgCount: messages.length, messages: messages };
        })()
      `)

      debugLog(`[Targeted Scrape] "${contactName}" → ${data.msgCount} msgs extracted`)

      // 6. Queue for sync and execute immediately
      if (data.contactName && data.msgCount > 0) {
        let syncKey = data.contactName
        if (/^[\d+\s()\-]+$/.test(syncKey.replace(/\s/g, ''))) {
          syncKey = syncKey.replace(/\s/g, '')
        }
        queueForSync(syncKey, data.contactName, data.messages)
        await executeSync()
      }

      // 7. Remove overlay
      await waView.webContents.executeJavaScript(`
        var ov = document.getElementById('ramppy-scrape-overlay'); if (ov) ov.remove();
      `).catch(() => {})

      // 8. Report success
      pendingScrapeResults.push({
        requestId,
        status: 'completed',
        messagesFound: data.msgCount || 0,
      })
      debugLog(`[Targeted Scrape] "${contactName}" completed: ${data.msgCount} msgs`)

    } catch (err) {
      debugLog(`[Targeted Scrape] Error for "${contactName}": ${err.message}`)
      pendingScrapeResults.push({ requestId, status: 'failed', error: err.message })
      // Clean overlay on error
      if (waView && !waView.webContents.isDestroyed()) {
        waView.webContents.executeJavaScript(`
          var ov = document.getElementById('ramppy-scrape-overlay'); if (ov) ov.remove();
        `).catch(() => {})
      }
    }
  }

  // --- Cleanup ---
  whatsappBaseWindow.on('closed', () => {
    clearInterval(stateSyncInterval)
    clearInterval(waAuthCheckInterval)
    if (desktopWaHeartbeatInterval) clearInterval(desktopWaHeartbeatInterval)
    stopSyncTimer()
    // Notify server that desktop WhatsApp is disconnected
    if (desktopWaAuthenticated) {
      sendDesktopWaHeartbeat('disconnected')
      desktopWaAuthenticated = false
    }
    whatsappBaseWindow = null
    waView = null
    copilotView = null
    whatsappContext = { active: false, contactName: null, contactPhone: null, messages: [] }
  })
}

function layoutWhatsAppViews() {
  if (!whatsappBaseWindow || whatsappBaseWindow.isDestroyed()) return
  // Use getContentSize (not getSize) — getSize includes window frame/borders on Windows
  const [w, h] = whatsappBaseWindow.getContentSize()
  const copilotW = copilotExpanded ? COPILOT_WIDTH : COPILOT_COLLAPSED_WIDTH
  const overlap = 16 // copilot overlaps WhatsApp for rounded corner effect
  const waWidth = Math.max(500, w - copilotW + overlap)
  waView.setBounds({ x: 0, y: 0, width: waWidth, height: h })
  copilotView.setBounds({ x: w - copilotW, y: 0, width: copilotW, height: h })
}

// Toggle copilot expand/collapse
ipcMain.on('toggle-copilot', () => {
  copilotExpanded = !copilotExpanded
  layoutWhatsAppViews()
  if (copilotView && !copilotView.webContents.isDestroyed()) {
    copilotView.webContents.send('copilot-toggled', copilotExpanded)
  }
})

// ============================================================
// AUTH TOKEN BRIDGE (main window → bubble window + recording window)
// ============================================================
function startAuthBridge() {
  // Extract Supabase auth token from main window and forward to bubble
  const extractAndForward = async () => {
    if (!mainWindow || mainWindow.isDestroyed() || !bubbleWindow || bubbleWindow.isDestroyed()) {
      debugLog(`[AuthBridge] Skipping — mainWindow=${!!mainWindow && !mainWindow?.isDestroyed()} bubbleWindow=${!!bubbleWindow && !bubbleWindow?.isDestroyed()}`)
      return
    }

    try {
      const authData = await mainWindow.webContents.executeJavaScript(`
        (function() {
          try {
            // Supabase stores session in localStorage with key pattern: sb-<ref>-auth-token
            var keys = [];
            for (var i = 0; i < localStorage.length; i++) {
              keys.push(localStorage.key(i));
            }
            for (var j = 0; j < keys.length; j++) {
              var key = keys[j];
              if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
                var raw = localStorage.getItem(key);
                if (raw) {
                  var parsed = JSON.parse(raw);
                  if (parsed && parsed.access_token) {
                    return JSON.stringify({
                      accessToken: parsed.access_token,
                      userId: parsed.user ? parsed.user.id : null,
                    });
                  }
                }
              }
            }
            return JSON.stringify({ debug: true, totalKeys: keys.length, keyNames: keys.filter(function(k) { return k.startsWith('sb-'); }) });
          } catch(e) {
            return JSON.stringify({ error: e.message });
          }
        })()
      `)

      if (authData) {
        const parsed = JSON.parse(authData)
        if (parsed.debug) {
          if (!hasUserAuth) debugLog(`[AuthBridge] No token found. localStorage keys: ${parsed.totalKeys}, sb-keys: ${JSON.stringify(parsed.keyNames)}`)
          return
        }
        if (parsed.error) {
          debugLog(`[AuthBridge] JS error: ${parsed.error}`)
          return
        }
        if (!hasUserAuth) debugLog(`[AuthBridge] Got auth token! userId: ${parsed.userId}`)
        hasUserAuth = true
        bubbleWindow.webContents.send('auth-token', parsed)
        // Show bubble once user is authenticated
        if (!bubbleWindow.isVisible()) {
          bubbleWindow.show()
          // Re-apply AFTER show() — the 'show' event handler takes care of it
        }
        // Forward to recording window if open
        if (recordingWindow && !recordingWindow.isDestroyed()) {
          recordingWindow.webContents.send('auth-token', parsed)
        }
        // Forward to copilot view if open
        if (copilotView && !copilotView.webContents.isDestroyed()) {
          copilotView.webContents.send('auth-token', parsed)
        }
      }
    } catch (err) {
      // Main window may not be ready yet
      debugLog('[AuthBridge] Error: ' + err.message)
    }
  }

  // Check every 3 seconds
  console.log('[AuthBridge] Starting interval...')
  authTokenInterval = setInterval(extractAndForward, 3000)
  // Also run immediately after a short delay (wait for page to load)
  setTimeout(() => {
    console.log('[AuthBridge] First check... mainWindow:', !!mainWindow, 'bubbleWindow:', !!bubbleWindow)
    extractAndForward()
  }, 2000)
}

// ============================================================
// BUBBLE ANIMATION HELPER
// ============================================================
let bubbleAnimationTimer = null

function animateBubbleTo(targetX, targetY, duration = 200, opts = {}) {
  if (!bubbleWindow || bubbleWindow.isDestroyed()) return

  // Cancel any ongoing animation
  if (bubbleAnimationTimer) {
    clearInterval(bubbleAnimationTimer)
    bubbleAnimationTimer = null
  }

  const bounds = bubbleWindow.getBounds()
  const startX = bounds.x
  const startY = bounds.y
  const startTime = Date.now()
  const fadeOut = opts.fadeOut || false
  const fadeIn = opts.fadeIn || false

  bubbleAnimationTimer = setInterval(() => {
    if (!bubbleWindow || bubbleWindow.isDestroyed()) {
      clearInterval(bubbleAnimationTimer)
      bubbleAnimationTimer = null
      return
    }

    const elapsed = Date.now() - startTime
    const progress = Math.min(elapsed / duration, 1)
    // Ease out cubic for smooth deceleration
    const eased = 1 - Math.pow(1 - progress, 3)

    const x = Math.round(startX + (targetX - startX) * eased)
    const y = Math.round(startY + (targetY - startY) * eased)


    bubbleWindow.setBounds({ x, y, width: bounds.width, height: bounds.height })


    // Subtle opacity during hide/show
    if (fadeOut) {
      bubbleWindow.setOpacity(1 - eased * 0.6) // 1.0 → 0.4
    } else if (fadeIn) {
      bubbleWindow.setOpacity(0.4 + eased * 0.6) // 0.4 → 1.0
    }

    if (progress >= 1) {
      clearInterval(bubbleAnimationTimer)
      bubbleAnimationTimer = null
    }
  }, 16) // ~60fps
}

// ============================================================
// IPC HANDLERS
// ============================================================

// Helper: get the work area of the display the bubble is currently on
function getBubbleDisplay() {
  if (!bubbleWindow) return screen.getPrimaryDisplay().workArea
  const bounds = bubbleWindow.getBounds()
  const display = screen.getDisplayNearestPoint({ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 })
  return display.workArea
}

// Resize bubble window (collapse ↔ expand)
ipcMain.handle('resize-bubble', async (_event, width, height) => {
  if (!bubbleWindow) return

  const bounds = bubbleWindow.getBounds()
  const display = getDisplayAt(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
  const { x: sX, y: sY, width: screenW, height: screenH } = display.workArea

  // Expand: anchor to bottom-right of current bubble position
  let x = bounds.x + bounds.width - width
  let y = bounds.y + bounds.height - height

  // Clamp to current display bounds
  if (x < sX) x = sX
  if (y < sY) y = sY
  if (x + width > sX + screenW) x = sX + screenW - width
  if (y + height > sY + screenH) y = sY + screenH - height

  bubbleWindow.setBounds({ x, y, width, height }, true)
  bubbleWindow.setResizable(width > 100)
})

// Move bubble to absolute screen position (clamped to combined display area)
ipcMain.on('move-bubble', (_event, x, y) => {
  if (!bubbleWindow) return
  const bounds = bubbleWindow.getBounds()
  const all = getAllScreenBounds()

  // Clamp so window stays within multi-monitor area
  if (x < all.x) x = all.x
  if (y < all.y) y = all.y
  if (x + bounds.width > all.maxX) x = all.maxX - bounds.width
  if (y + bounds.height > all.maxY) y = all.maxY - bounds.height

  bubbleWindow.setBounds({ x, y, width: bounds.width, height: bounds.height })
})

// Set bubble bounds (position + size) — used for expand, collapse, and edge resizing
ipcMain.handle('set-bubble-bounds', async (_event, x, y, width, height) => {
  if (!bubbleWindow) return

  const isPanel = width > 200 // panel mode (>=280) vs bubble/bar mode

  // Only enforce min size when resizing the panel, not when collapsing to bubble
  if (isPanel) {
    if (width < 320) width = 320
    if (height < 400) height = 400
  }

  // Clamp to the display where the bubble center lands
  const display = getDisplayAt(x + width / 2, y + height / 2)
  const { x: sX, y: sY, width: screenW, height: screenH } = display.workArea

  if (x < sX) x = sX
  if (y < sY) y = sY
  if (x + width > sX + screenW) x = sX + screenW - width
  if (y + height > sY + screenH) y = sY + screenH - height

  bubbleWindow.setBounds({ x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) })
  bubbleWindow.setResizable(isPanel)
})

// Set bubble window opacity (hide dark flash during resize on Windows)
ipcMain.handle('set-bubble-opacity', async (_event, opacity) => {
  if (!bubbleWindow || bubbleWindow.isDestroyed()) return
  bubbleWindow.setOpacity(opacity)
})

// Get current bubble position
ipcMain.handle('get-bubble-pos', async () => {
  if (!bubbleWindow) return { x: 0, y: 0 }
  const bounds = bubbleWindow.getBounds()
  return { x: bounds.x, y: bounds.y }
})

// Mouse event forwarding — let clicks pass through transparent areas
ipcMain.on('set-ignore-mouse', (_event, ignore) => {
  if (!bubbleWindow) return
  if (ignore) {
    bubbleWindow.setIgnoreMouseEvents(true, { forward: true })
  } else {
    bubbleWindow.setIgnoreMouseEvents(false)
  }
})

// Edge-snap: after drag ends, snap bubble to nearest edge of its current display
ipcMain.on('snap-to-edge', () => {
  if (!bubbleWindow) return
  const bounds = bubbleWindow.getBounds()
  const wa = getBubbleDisplay()

  const centerX = bounds.x + bounds.width / 2
  const displayCenterX = wa.x + wa.width / 2
  const margin = 12

  // Snap to left or right edge of the display the bubble is on
  let targetX
  if (centerX < displayCenterX) {
    targetX = wa.x + margin
  } else {
    targetX = wa.x + wa.width - bounds.width - margin
  }

  // Clamp Y within the display
  let targetY = Math.max(wa.y + margin, Math.min(bounds.y, wa.y + wa.height - bounds.height - margin))

  bubbleWindow.setBounds({ x: targetX, y: targetY, width: bounds.width, height: bounds.height }, true)
})

// Animate bubble to position (allows off-screen for snap-to-edge)
ipcMain.on('snap-bubble', (_event, x, y, duration, opts) => {
  if (!bubbleWindow) return
  animateBubbleTo(x, y, duration || 200, opts || {})
})

// Audio diagnostic: test if audio can play in the renderer
ipcMain.handle('test-audio-diagnostic', async () => {
  if (!mainWindow || mainWindow.isDestroyed()) return { error: 'no window' }
  const muted = mainWindow.webContents.isAudioMuted()
  const audible = mainWindow.webContents.isCurrentlyAudible()
  // Try playing a test tone via the renderer
  const result = await mainWindow.webContents.executeJavaScript(`
    (async () => {
      try {
        const ctx = new AudioContext();
        const state = ctx.state;
        if (ctx.state === 'suspended') await ctx.resume();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 440;
        gain.gain.value = 0.3;
        osc.start();
        await new Promise(r => setTimeout(r, 500));
        osc.stop();
        ctx.close();
        return { success: true, state, sampleRate: ctx.sampleRate, destination: ctx.destination.channelCount };
      } catch (e) {
        return { error: e.message };
      }
    })()
  `)
  console.log('[Audio Diagnostic] muted:', muted, 'audible:', audible, 'test:', JSON.stringify(result))
  return { muted, audible, result }
})

// Get screen work area size (of display where bubble currently is)
ipcMain.handle('get-screen-size', async () => {
  if (bubbleWindow && !bubbleWindow.isDestroyed()) {
    const bounds = bubbleWindow.getBounds()
    const display = getDisplayAt(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
    const adjacent = getAdjacentEdges(display)
    return { width: display.workArea.width, height: display.workArea.height, x: display.workArea.x, y: display.workArea.y, adjacent }
  }
  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  return { width, height, x: 0, y: 0, adjacent: { left: false, right: false, top: false, bottom: false } }
})

// Capture screenshot of primary display for AI vision
ipcMain.handle('capture-screenshot', async () => {
  try {
    if (!hasScreenPermission()) return null
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1280, height: 720 },
    })
    if (!sources.length) return null
    return sources[0].thumbnail.toDataURL()
  } catch (err) {
    console.error('capture-screenshot error:', err)
    return null
  }
})

// Open recording window (called from bubble)
ipcMain.on('open-recording-window', () => {
  createRecordingWindow()
})


// Handle desktopCapturer for Meet feature
ipcMain.handle('get-sources', async () => {
  try {
    if (!hasScreenPermission()) return []
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 0, height: 0 },
    })
    return sources.map(s => ({ id: s.id, name: s.name }))
  } catch (err) {
    console.error('getSources error:', err)
    return []
  }
})

// ============================================================
// WHATSAPP IPC HANDLERS
// ============================================================

// WhatsApp scraper sends context updates → forward to copilot view
ipcMain.on('whatsapp-context-update', (_event, data) => {
  whatsappContext = data
  console.log('[WhatsApp IPC] Context update received:', data.active ? `active, contact: ${data.contactName}, msgs: ${data.messages?.length}` : 'inactive')
  if (copilotView && !copilotView.webContents.isDestroyed()) {
    copilotView.webContents.send('whatsapp-state', data)
  } else {
    console.log('[WhatsApp IPC] copilotView not available to forward')
  }

  // Queue messages for server sync (so manager can view in "Modo Leitura")
  // Use contactName as primary key — contactPhone from scraper is unreliable
  // (can return UI text like "clique para mostrar os dados do contato")
  if (data.active && data.messages?.length > 0 && data.contactName) {
    // Normalize: if name looks like a phone number, strip spaces (matches sidebar scraper)
    let syncKey = data.contactName
    if (/^[\d+\s()-]+$/.test(syncKey.replace(/\s/g, ''))) {
      syncKey = syncKey.replace(/\s/g, '')
    }
    queueForSync(syncKey, data.contactName, data.messages)
    // Ensure sync timer is running (safety net if checkWaAuth didn't start it)
    if (!syncTimer) startSyncTimer()
    // Trigger immediate sync attempt (don't wait for next timer tick)
    executeSync()
  }
})

// WhatsApp scraper sends full conversation list from sidebar → sync to server
ipcMain.on('whatsapp-conversation-list', (_event, list) => {
  if (!list || list.length === 0) return
  lastSidebarList = list  // Store for smart re-sync comparison
  console.log(`[WhatsApp IPC] Conversation list received: ${list.length} conversations`)
  syncConversationList(list)
})

// New messages detected in real time — trigger immediate sync
ipcMain.on('whatsapp-new-messages', (_event, data) => {
  if (!data.contactName || !data.messages?.length) return
  console.log(`[WhatsApp IPC] New messages: ${data.messages.length} from "${data.contactName}"`)
  // Queue for immediate sync
  let syncKey = data.contactName
  if (/^[\d+\s()-]+$/.test(syncKey.replace(/\s/g, ''))) {
    syncKey = syncKey.replace(/\s/g, '')
  }
  queueForSync(syncKey, data.contactName, data.messages)
  executeSync()
})

// Copilot requests text injection into WhatsApp input
ipcMain.on('inject-whatsapp-text', (_event, text) => {
  if (waView && !waView.webContents.isDestroyed()) {
    waView.webContents.send('inject-whatsapp-text', text)
  }
})

// Auto-scan progress reports from scraper
ipcMain.on('auto-scan-progress', (_event, progress) => {
  console.log(`[Auto-Scan] ${progress.scanned}/${progress.total}: ${progress.currentContact}`)
})

// ============================================================
// AUTO-SCAN: Automatically scrape top conversations on WhatsApp connect
// ============================================================

async function triggerAutoScan() {
  if (!waView || waView.webContents.isDestroyed()) return

  const MAX_CONVERSATIONS = 30
  debugLog('[Auto-Scan] Starting...')
  isAutoScanRunning = true

  try {
    // Step 1: Get auth token to fetch stored conversations from API
    if (!mainWindow || mainWindow.isDestroyed()) return
    const authToken = await mainWindow.webContents.executeJavaScript(`
      (function() {
        try {
          for (var i = 0; i < localStorage.length; i++) {
            var key = localStorage.key(i);
            if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
              var raw = localStorage.getItem(key);
              if (raw) { var p = JSON.parse(raw); if (p && p.access_token) return p.access_token; }
            }
          }
        } catch(e) {}
        return null;
      })()
    `)

    // Step 2: Fetch stored conversations from database
    let storedConversations = []
    if (authToken) {
      try {
        const resp = await fetch(PLATFORM_URL + '/api/whatsapp/conversations', {
          headers: { 'Authorization': `Bearer ${authToken}` }
        })
        const result = await resp.json()
        storedConversations = result.conversations || []
      } catch (e) {
        debugLog('[Auto-Scan] Could not fetch stored conversations: ' + e.message)
      }
    }

    // Daily scan: run full scan once per day (persisted to file so it survives app restarts)
    const today = new Date().toDateString()
    if (getLastAutoScanDate() === today) {
      debugLog('[Auto-Scan] Already scanned today, skipping.')
      return
    }

    // Wait for sidebar data
    if (lastSidebarList.length === 0) {
      debugLog('[Auto-Scan] Waiting for sidebar data...')
      await new Promise(r => setTimeout(r, 3000))
    }
    if (lastSidebarList.length === 0) {
      debugLog('[Auto-Scan] No sidebar data available, aborting')
      return
    }

    // Build conversation list: top N from sidebar (deduplicated by name)
    const conversationsToScan = []
    const seenNames = new Set()
    for (let i = 0; i < lastSidebarList.length && conversationsToScan.length < MAX_CONVERSATIONS; i++) {
      const name = lastSidebarList[i].name || lastSidebarList[i].phone
      if (name && !seenNames.has(name)) {
        seenNames.add(name)
        conversationsToScan.push({ name })
      }
    }
    debugLog(`[Auto-Scan] Daily scan: will scan top ${conversationsToScan.length} conversations`)

    // Show fully opaque loading overlay (never flashes — uses pointer-events toggle for clicks)
    await waView.webContents.executeJavaScript(`
      (function() {
        if (document.getElementById('ramppy-scan-overlay')) return;
        var overlay = document.createElement('div');
        overlay.id = 'ramppy-scan-overlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:#111b21;z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:all;';
        overlay.innerHTML = '<div style="text-align:center;color:#e9edef;font-family:Segoe UI,Helvetica,Arial,sans-serif;">'
          + '<div style="width:48px;height:48px;border:3px solid rgba(0,168,132,0.3);border-top-color:#00a884;border-radius:50%;animation:ramppy-spin 1s linear infinite;margin:0 auto 20px;"></div>'
          + '<div style="font-size:16px;font-weight:500;margin-bottom:20px;">Sincronizando conversas</div>'
          + '<div style="width:240px;height:4px;background:rgba(255,255,255,0.08);border-radius:2px;overflow:hidden;">'
          + '<div id="ramppy-scan-bar" style="width:0%;height:100%;background:#00a884;border-radius:2px;transition:width 0.5s ease;"></div>'
          + '</div>'
          + '<div id="ramppy-scan-progress" style="font-size:12px;color:#667781;margin-top:8px;">0%</div>'
          + '</div>';
        var style = document.createElement('style');
        style.textContent = '@keyframes ramppy-spin { to { transform: rotate(360deg); } }';
        document.head.appendChild(style);
        document.body.appendChild(overlay);
      })()
    `)

    // Step 6: Click and scrape each conversation BY NAME (not index)
    // Finding by name avoids WhatsApp's virtualized sidebar reordering issues.
    const total = conversationsToScan.length
    for (let step = 0; step < total; step++) {
      if (!waView || waView.webContents.isDestroyed()) break

      const targetName = conversationsToScan[step].name

      // Find cell by contact name in sidebar (robust against virtualized scrolling)
      const cellInfo = await waView.webContents.executeJavaScript(`
        (function() {
          var targetName = ${JSON.stringify(targetName)};
          var pane = document.getElementById('pane-side');
          if (!pane) return null;

          // Search all span[title] to find the matching contact
          var spans = pane.querySelectorAll('span[title]');
          var targetCell = null;
          for (var i = 0; i < spans.length; i++) {
            if (spans[i].getAttribute('title') === targetName) {
              // Walk up DOM to find the row/listitem container
              var el = spans[i];
              while (el && el !== pane) {
                if (el.getAttribute('role') === 'row' || el.getAttribute('role') === 'listitem' ||
                    (el.dataset && el.dataset.testid === 'cell-frame-container')) {
                  targetCell = el;
                  break;
                }
                el = el.parentElement;
              }
              break;
            }
          }

          if (!targetCell) return null;

          // Scroll into view if off-screen
          var r = targetCell.getBoundingClientRect();
          if (r.top < 0 || r.bottom > window.innerHeight) {
            targetCell.scrollIntoView({ block: 'center' });
          }

          // Get clickable target area
          var clickTarget = targetCell.querySelector('div[tabindex="-1"]') || targetCell.querySelector('div[role="gridcell"]') || targetCell;
          r = clickTarget.getBoundingClientRect();
          return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
        })()
      `)

      if (!cellInfo) {
        debugLog(`[Auto-Scan] ${step + 1}/${total}: "${targetName}" not found in sidebar, skipping`)
        continue
      }

      // Update progress bar
      const pct = Math.round(((step + 1) / total) * 100)
      waView.webContents.executeJavaScript(`
        (function() {
          var bar = document.getElementById('ramppy-scan-bar');
          if (bar) bar.style.width = '${pct}%';
          var el = document.getElementById('ramppy-scan-progress');
          if (el) el.textContent = '${pct}%';
        })()
      `).catch(function() {})

      // Allow click to pass through overlay (pointer-events:none) — overlay stays fully visible
      await waView.webContents.executeJavaScript(`
        document.getElementById('ramppy-scan-overlay').style.pointerEvents = 'none';
      `)
      await new Promise(r => setTimeout(r, 50))

      // Send real mouse click via Chromium input event
      waView.webContents.sendInputEvent({ type: 'mouseDown', x: cellInfo.x, y: cellInfo.y, button: 'left', clickCount: 1 })
      waView.webContents.sendInputEvent({ type: 'mouseUp', x: cellInfo.x, y: cellInfo.y, button: 'left', clickCount: 1 })

      // Block pointer events again
      await new Promise(r => setTimeout(r, 50))
      await waView.webContents.executeJavaScript(`
        document.getElementById('ramppy-scan-overlay').style.pointerEvents = 'all';
      `)

      // Wait for #main panel to appear (poll every 200ms, max 5s)
      const mainReady = await waView.webContents.executeJavaScript(`
        new Promise(function(resolve) {
          var checks = 0;
          var iv = setInterval(function() {
            checks++;
            if (document.querySelector('#main') || checks >= 25) {
              clearInterval(iv);
              resolve(!!document.querySelector('#main'));
            }
          }, 200);
        })
      `)

      if (!mainReady) {
        debugLog(`[Auto-Scan] ${step + 1}/${total}: "${targetName}" → #main not found, skipping`)
        continue
      }

      // Small extra wait for messages to render in DOM
      await new Promise(r => setTimeout(r, 500))

      // Extract messages
      if (!waView || waView.webContents.isDestroyed()) break
      const data = await waView.webContents.executeJavaScript(`
        (function() {
          var contactName = typeof getContactName === 'function' ? getContactName() : null;
          var contactPhone = typeof getContactPhone === 'function' ? getContactPhone() : null;
          var messages = typeof extractMessages === 'function' ? extractMessages() : [];
          return { contactName: contactName, contactPhone: contactPhone, msgCount: messages.length, messages: messages };
        })()
      `)

      debugLog(`[Auto-Scan] ${step + 1}/${total}: "${data.contactName || targetName}" → ${data.msgCount} msgs`)

      // Queue for sync
      if (data.contactName && data.msgCount > 0) {
        let syncKey = data.contactName
        if (/^[\d+\s()-]+$/.test(syncKey.replace(/\s/g, ''))) {
          syncKey = syncKey.replace(/\s/g, '')
        }
        queueForSync(syncKey, data.contactName, data.messages)
      }

      await new Promise(r => setTimeout(r, 500))
    }

    // Flush queued messages
    await executeSync()

    setLastAutoScanDate(new Date().toDateString())
    debugLog(`[Auto-Scan] Complete: scanned ${total} conversations`)
  } catch (err) {
    debugLog('[Auto-Scan] Error: ' + err.message)
  } finally {
    isAutoScanRunning = false
    // Remove loading overlay
    if (waView && !waView.webContents.isDestroyed()) {
      waView.webContents.executeJavaScript(`
        (function() {
          var overlay = document.getElementById('ramppy-scan-overlay');
          if (overlay) overlay.remove();
        })()
      `).catch(function() {})
    }
  }
}

// Open or focus WhatsApp window
ipcMain.on('open-whatsapp', () => {
  createWhatsAppWindow()
})

ipcMain.on('open-screen-permission-settings', () => {
  if (process.platform === 'darwin') {
    shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture')
  }
})

// Bubble asks for current WhatsApp state
ipcMain.handle('get-whatsapp-state', async () => {
  return whatsappContext
})

// Return platform base URL so bubble can build API URLs (dev vs prod)
ipcMain.handle('get-platform-url', () => {
  return PLATFORM_URL
})

// ============================================================
// DESKTOP → SERVER MESSAGE SYNC (for manager "Modo Leitura")
// ============================================================

/**
 * Queue scraped messages for server sync. Filters out already-synced messages
 * and replaces any existing queue entry for the same contact.
 */
function queueForSync(contactPhone, contactName, messages) {
  if (!contactPhone || !messages?.length) {
    console.log('[Desktop Sync] queueForSync skipped: no phone or messages')
    return
  }

  if (!syncedMessageKeys.has(contactPhone)) {
    syncedMessageKeys.set(contactPhone, new Set())
  }
  const syncedKeys = syncedMessageKeys.get(contactPhone)

  // Filter to only new messages (not yet synced)
  const newMessages = messages.filter(msg => {
    const key = `${msg.timestamp}_${msg.fromMe}_${(msg.body || '').substring(0, 50)}`
    return !syncedKeys.has(key)
  })

  if (newMessages.length === 0) {
    console.log(`[Desktop Sync] queueForSync: all ${messages.length} msgs for "${contactName}" already synced`)
    return
  }

  console.log(`[Desktop Sync] queueForSync: ${newMessages.length} new msgs for "${contactName}" (${contactPhone}), queue size: ${syncQueue.length}`)

  // Replace existing queue entry for this contact (latest scrape = most complete)
  const existingIdx = syncQueue.findIndex(q => q.contactPhone === contactPhone)
  if (existingIdx >= 0) {
    syncQueue[existingIdx] = { contactPhone, contactName, messages: newMessages }
  } else {
    syncQueue.push({ contactPhone, contactName, messages: newMessages })
  }
}

/**
 * Process ALL items from the sync queue: POST messages to server API.
 * Called every 10s by syncTimer + immediately on new messages.
 */
async function executeSync() {
  if (isSyncing || syncQueue.length === 0) return
  isSyncing = true

  // Get auth token once for all items
  try {
    if (!mainWindow || mainWindow.isDestroyed()) {
      console.warn('[Desktop Sync] mainWindow not available, skipping')
      isSyncing = false
      return
    }
    const authToken = await mainWindow.webContents.executeJavaScript(`
      (function() {
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
              const raw = localStorage.getItem(key);
              if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed?.access_token) return parsed.access_token;
              }
            }
          }
        } catch(e) {}
        return null;
      })()
    `)

    if (!authToken) {
      console.warn('[Desktop Sync] No auth token found in mainWindow, skipping')
      isSyncing = false
      return
    }

    // Process all items in queue
    const items = [...syncQueue]
    syncQueue = []

    for (const item of items) {
      try {
        const url = PLATFORM_URL + '/api/whatsapp/desktop-sync'
        console.log(`[Desktop Sync] Sending ${item.messages.length} msgs for "${item.contactName}" (${item.contactPhone}) to ${url}`)
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({
            contactPhone: item.contactPhone,
            contactName: item.contactName,
            messages: item.messages
          })
        })

        const result = await response.json()

        if (result.ok) {
          // Mark messages as synced so they won't be re-queued
          const syncedKeys = syncedMessageKeys.get(item.contactPhone) || new Set()
          for (const msg of item.messages) {
            const key = `${msg.timestamp}_${msg.fromMe}_${(msg.body || '').substring(0, 50)}`
            syncedKeys.add(key)
          }
          syncedMessageKeys.set(item.contactPhone, syncedKeys)
          console.log(`[Desktop Sync] ✓ ${item.contactName}: synced=${result.synced}, skipped=${result.skipped}`)
        } else {
          console.warn(`[Desktop Sync] ✗ API error for ${item.contactName}:`, result.error)
          // Re-queue on API error (not network error)
          syncQueue.push(item)
        }
      } catch (err) {
        console.error(`[Desktop Sync] ✗ Network error for ${item.contactName}:`, err.message)
        // Re-queue on network failure
        syncQueue.push(item)
      }
    }
  } catch (err) {
    console.error('[Desktop Sync] Fatal error:', err.message)
  }

  isSyncing = false
}

/** Start the periodic sync timer (called when WhatsApp authenticates) */
function startSyncTimer() {
  if (syncTimer) return
  syncTimer = setInterval(executeSync, 10000)
  console.log('[Desktop Sync] Started sync timer (10s interval)')
}

/** Stop the sync timer and clear state (called on disconnect/close) */
function stopSyncTimer() {
  if (syncTimer) { clearInterval(syncTimer); syncTimer = null }
  syncedMessageKeys.clear()
  syncQueue = []
  isSyncing = false
}

/**
 * Sync the full conversation list from WhatsApp sidebar to server.
 * Creates/updates whatsapp_conversations records for ALL visible conversations,
 * so the manager can see the complete conversation list (not just the open one).
 */
async function syncConversationList(list) {
  try {
    if (!mainWindow || mainWindow.isDestroyed()) return
    const authToken = await mainWindow.webContents.executeJavaScript(`
      (function() {
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
              const raw = localStorage.getItem(key);
              if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed?.access_token) return parsed.access_token;
              }
            }
          }
        } catch(e) {}
        return null;
      })()
    `)
    if (!authToken) {
      console.warn('[Desktop Sync] No auth token for conversation list sync')
      return
    }

    const url = PLATFORM_URL + '/api/whatsapp/desktop-sync'
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ conversationList: list })
    })
    const result = await response.json()
    if (result.ok) {
      console.log(`[Desktop Sync] ✓ Conversation list synced: ${result.upserted} conversations`)
    } else {
      console.warn('[Desktop Sync] ✗ Conversation list error:', result.error)
    }
  } catch (err) {
    console.error('[Desktop Sync] Conversation list sync failed:', err.message)
  }
}

// ============================================================
// BLACKHOLE AUDIO DRIVER — IPC handlers
// ============================================================

ipcMain.handle('check-blackhole', () => {
  return isBlackHoleInstalled()
})

ipcMain.handle('setup-audio-routing', () => {
  return createMultiOutputDevice()
})

ipcMain.handle('teardown-audio-routing', () => {
  return destroyMultiOutputDevice()
})

/**
 * First-launch BlackHole driver installation.
 * Shows a native macOS dialog explaining what it does, then triggers admin password prompt.
 * Only runs once — skips if driver already installed.
 */
async function ensureBlackHoleInstalled() {
  if (process.platform !== 'darwin') return
  if (isBlackHoleInstalled()) {
    console.log('[BlackHole] Driver already installed.')
    return
  }

  // In dev mode: driver is at desktop/drivers/
  // In production: driver is at Resources/drivers/ inside the .app bundle
  const fs = require('fs')
  const devPath = path.join(__dirname, 'drivers', 'BlackHole2ch.driver')
  const prodPath = path.join(process.resourcesPath, 'drivers', 'BlackHole2ch.driver')
  const driverBasePath = fs.existsSync(devPath) ? __dirname : (fs.existsSync(prodPath) ? process.resourcesPath : null)

  if (!driverBasePath) {
    console.log('[BlackHole] Driver bundle not found — skipping installation.')
    console.log('[BlackHole] Checked dev:', devPath)
    console.log('[BlackHole] Checked prod:', prodPath)
    return
  }

  console.log('[BlackHole] Driver found at:', path.join(driverBasePath, 'drivers', 'BlackHole2ch.driver'))

  const result = await dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Configuracao de Audio',
    message: 'O Ramppy precisa instalar um driver de audio para gravar reunioes automaticamente.',
    detail: 'Isso e feito uma unica vez e requer a senha de administrador do Mac. Sem o driver, a gravacao ainda funciona mas mostra um dialogo de permissao a cada vez.',
    buttons: ['Instalar Agora', 'Pular'],
    defaultId: 0,
    cancelId: 1,
  })

  if (result.response === 0) {
    const success = installBlackHoleDriver(driverBasePath)
    if (success) {
      console.log('[BlackHole] Installation complete.')
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Driver Instalado',
        message: 'Driver de audio instalado com sucesso!',
        detail: 'A gravacao de reunioes agora funciona automaticamente sem dialogos de permissao.',
        buttons: ['OK'],
      })
    } else {
      console.warn('[BlackHole] Installation failed or cancelled by user.')
      dialog.showMessageBox(mainWindow, {
        type: 'warning',
        title: 'Instalacao Cancelada',
        message: 'O driver de audio nao foi instalado.',
        detail: 'A gravacao ainda funciona, mas mostrara um dialogo de permissao a cada vez. Voce pode instalar depois reiniciando o app.',
        buttons: ['OK'],
      })
    }
  } else {
    console.log('[BlackHole] User chose to skip driver installation.')
  }
}

// ============================================================
// GOOGLE MEET AUTO-DETECTION
// ============================================================

// Prevent macOS App Nap from throttling timers while recording
function startPowerSaveBlocker() {
  if (powerSaveBlockerId !== null) return
  powerSaveBlockerId = powerSaveBlocker.start('prevent-app-suspension')
  console.log('[Power] App suspension blocker started (id:', powerSaveBlockerId, ')')
}

function stopPowerSaveBlocker() {
  if (powerSaveBlockerId !== null) {
    powerSaveBlocker.stop(powerSaveBlockerId)
    console.log('[Power] App suspension blocker stopped (id:', powerSaveBlockerId, ')')
    powerSaveBlockerId = null
  }
}

// Active meeting titles contain a meeting code (e.g. "Meet: abc-defg-hij 🔊")
// AppleScript: check ALL Chrome tabs for Meet pages that show "left" state
// This detects "Você saiu da reunião" INSTANTLY (desktopCapturer can't see inactive tabs)
function checkChromeMeetState() {
  return new Promise((resolve) => {
    // URL+title based detection — no JS execution (avoids timeout on heavy Meet pages)
    const script = `
tell application "Google Chrome"
  set meetResults to ""
  repeat with w in windows
    repeat with t in tabs of w
      if URL of t contains "meet.google.com/" then
        set meetUrl to URL of t
        set meetTitle to title of t
        set meetResults to meetResults & meetUrl & "|||" & meetTitle & ":::"
      end if
    end repeat
  end repeat
  if meetResults is "" then return "NONE"
  return meetResults
end tell`
    exec(`osascript -e '${script.replace(/'/g, "'\\''")}'`, { timeout: 5000 }, (err, stdout) => {
      if (err) {
        debugLog(`[MeetDetect] AppleScript error: ${err.message}`)
        resolve({ available: false })
        return
      }
      const result = stdout.trim()
      if (result === 'NONE' || !result) {
        resolve({ available: true, hasMeetTab: false, state: 'NONE' })
        return
      }
      // Parse all Meet tabs: url|||title:::
      const tabs = result.split(':::').filter(Boolean).map(entry => {
        const parts = entry.split('|||')
        return { url: parts[0] || '', title: parts[1] || '' }
      })
      debugLog(`[MeetDetect] AppleScript: ${tabs.map(t => `${t.url} "${t.title}"`).join(' | ')}`)

      // Classify tabs by URL and title patterns
      const meetCodeTab = tabs.find(t => MEET_CODE_PATTERN.test(t.url) && !t.url.includes('/landing'))
      const titleLeftTab = tabs.find(t => MEET_LEFT_PATTERNS.some(p => t.title.toLowerCase().includes(p)))
      const landingTab = tabs.find(t => t.url.includes('/landing'))

      // Priority: active meeting > left meeting > landing page
      if (meetCodeTab && !titleLeftTab) {
        resolve({ available: true, hasMeetTab: true, state: 'ACTIVE', url: meetCodeTab.url, title: meetCodeTab.title })
      } else if (titleLeftTab) {
        resolve({ available: true, hasMeetTab: true, state: 'LEFT', url: titleLeftTab.url, title: titleLeftTab.title })
      } else if (landingTab) {
        // Landing page only (no active meeting) — not a meeting
        resolve({ available: true, hasMeetTab: false, state: 'NONE' })
      } else {
        resolve({ available: true, hasMeetTab: tabs.length > 0, state: 'UNKNOWN' })
      }
    })
  })
}

// Track consecutive NO_CONTROLS detections for debounce
let noControlsCount = 0
const NO_CONTROLS_THRESHOLD = 6 // 6 consecutive checks (~9s) = definitive end
let leftDetectionCount = 0      // Debounce LEFT state (desktopCapturer can be flaky on Windows)

// Chrome shows 🔊 when the tab is producing audio (WebRTC call active)
// When user leaves the meeting, 🔊 disappears because audio stops
const MEET_CODE_PATTERN = /[a-z]{3}-[a-z]{4}-[a-z]{3}/
const MEET_LEFT_PATTERNS = [
  'você saiu', 'you left', 'saiu da reunião', 'left the meeting',
  'reunião encerrada', 'meeting ended', 'chamada encerrada', 'call ended',
  'a reunião foi encerrada', 'the meeting has ended',
  'voltar à tela inicial', 'return to home', 'rejoin', 'reentrar',
  'saliste de la reunión', 'ha terminado', // Spanish
  'vous avez quitté', 'réunion terminée', // French
]

function hasMeetCode(title) {
  return MEET_CODE_PATTERN.test(title)
}

function isLeftMeetWindow(title) {
  const lower = title.toLowerCase()
  return MEET_LEFT_PATTERNS.some(p => lower.includes(p))
}

let screenPermissionDenied = false // Set to true after first denial — stops retrying

// Check screen recording permission WITHOUT triggering the popup
function hasScreenPermission() {
  if (process.platform !== 'darwin') return true // Windows/Linux don't need this
  if (screenPermissionDenied) return false
  const status = systemPreferences.getMediaAccessStatus('screen')
  if (status !== 'granted') {
    screenPermissionDenied = true
    debugLog(`[Permission] Screen Recording not granted (${status}) — blocking all desktopCapturer calls`)
    return false
  }
  return true
}

async function checkForMeetWindow() {
  if (!hasUserAuth) {
    if (!checkForMeetWindow._noAuthLog || Date.now() - checkForMeetWindow._noAuthLog > 30000) {
      checkForMeetWindow._noAuthLog = Date.now()
      debugLog('[MeetDetect] Skipping — no auth yet')
    }
    return
  }

  try {
    // ─── PRIMARY: AppleScript-based detection (macOS, no Screen Recording needed) ───
    // Queries Chrome tabs directly for meet.google.com URLs
    if (process.platform === 'darwin') {
      try {
        const chromeState = await checkChromeMeetState()
        if (chromeState.available) {
          await handleMeetState(chromeState)
          return // AppleScript handled it — skip desktopCapturer entirely
        }
      } catch (e) {
        debugLog(`[MeetDetect] AppleScript failed: ${e.message} — falling back to desktopCapturer`)
      }
    }

    // ─── FALLBACK: desktopCapturer-based detection (Windows/Linux, or Chrome not running) ───
    if (!hasScreenPermission()) return

    const sources = await desktopCapturer.getSources({
      types: ['window'],
      thumbnailSize: { width: 0, height: 0 },
    })

    if (!checkForMeetWindow._lastLog || Date.now() - checkForMeetWindow._lastLog > 30000) {
      checkForMeetWindow._lastLog = Date.now()
      debugLog(`[MeetDetect] Scanning ${sources.length} windows (desktopCapturer fallback)`)
    }

    // Categorize Meet windows
    const activeMeet = sources.find(s => hasMeetCode(s.name) && !isLeftMeetWindow(s.name))
    const meetTabAny = sources.find(s => hasMeetCode(s.name))
    const userLeft = sources.some(s => isLeftMeetWindow(s.name))
    const meetWithAudio = sources.find(s => hasMeetCode(s.name) && s.name.includes('🔊'))

    // Build a chromeState-like object from desktopCapturer results
    const dcState = {
      available: true,
      hasMeetTab: !!meetTabAny,
      state: userLeft ? 'LEFT' : (activeMeet ? 'ACTIVE' : (meetTabAny ? 'UNKNOWN' : 'NONE')),
      url: activeMeet?.name || meetTabAny?.name || '',
      title: activeMeet?.name || meetTabAny?.name || '',
      // Extra desktopCapturer-specific data
      _sources: sources,
      _activeMeet: activeMeet,
      _meetTabAny: meetTabAny,
      _meetWithAudio: meetWithAudio,
    }

    await handleMeetState(dcState)

    // Reset when all Meet tabs are closed (allow detecting next meeting)
    if (!meetTabAny && !isRecordingMeet && !userLeft && !pendingMeetConfirmation) {
      lastRecordedMeetCode = null
      declinedMeetCode = null
    }
  } catch (err) {
    console.error('[MeetDetect] Error:', err)
  }
}

// Unified state handler — works with both AppleScript and desktopCapturer results
async function handleMeetState(state) {
  if (!state.available) return

  if (!isRecordingMeet && !pendingMeetConfirmation) {
    // ── NOT RECORDING: detect meeting START ──
    if (state.state === 'ACTIVE' && state.hasMeetTab) {
      const meetCode = (state.url || state.title || '').match(MEET_CODE_PATTERN)?.[0]
      if (meetCode && meetCode === lastRecordedMeetCode) return
      if (meetCode && meetCode === declinedMeetCode) return

      pendingMeetConfirmation = true
      pendingMeetTitle = state.title || state.url || 'Google Meet'

      debugLog(`[MeetDetect] Active meeting detected via ${state._sources ? 'desktopCapturer' : 'AppleScript'}: ${pendingMeetTitle}`)

      if (bubbleWindow && !bubbleWindow.isDestroyed()) {
        bubbleWindow.webContents.send('ask-meeting-start', pendingMeetTitle)
      }
    }
    // Also reset declined/recorded codes when no meet tabs exist
    if (state.state === 'NONE' || !state.hasMeetTab) {
      lastRecordedMeetCode = null
      declinedMeetCode = null
    }
  } else if (pendingMeetConfirmation) {
    // ── WAITING FOR USER CONFIRMATION ──
    if (state.state !== 'ACTIVE' && state.state !== 'UNKNOWN') {
      meetWindowGoneCount++
      if (meetWindowGoneCount >= 2) {
        debugLog('[MeetDetect] Meeting disappeared while waiting for confirmation — cancelling')
        meetWindowGoneCount = 0
        pendingMeetConfirmation = false
        pendingMeetTitle = null
        if (bubbleWindow && !bubbleWindow.isDestroyed()) {
          bubbleWindow.webContents.send('hide-meeting-start')
        }
      }
    } else {
      meetWindowGoneCount = 0
    }
  } else {
    // ── RECORDING: detect meeting END ──

    // Track audio indicator (desktopCapturer only)
    if (state._meetWithAudio) meetHadAudioIndicator = true

    // After user clicked "Ignorar": only resume detection if the meeting
    // becomes ACTIVE again (user re-entered). If they never re-enter, never ask again.
    // User can always stop manually via REC badge or Parar button.
    if (waitingForMeetReactivation) {
      if (state.state === 'ACTIVE') {
        debugLog('[MeetDetect] Meeting active again after dismiss — resuming end detection')
        waitingForMeetReactivation = false
        leftDetectionCount = 0
        noControlsCount = 0
        // Don't fall through — just reset. Next check will handle normally.
      }
      return
    }

    // On Windows, desktopCapturer is unreliable — it frequently misses windows or
    // returns stale titles, causing constant false positives. Therefore:
    // ONLY ask "A reunião acabou?" when the window title EXPLICITLY says the user left.
    // For all other cases (tab gone, unknown state), the user can manually stop via
    // the REC badge or Parar button. This eliminates false positives entirely.

    if (state.state === 'LEFT') {
      leftDetectionCount++
      noControlsCount = 0
      debugLog(`[MeetDetect] LEFT detected (${leftDetectionCount}/3) — title: ${state.title}`)
      // Require 3 consecutive LEFT detections (~4.5s) to confirm it's real
      if (leftDetectionCount >= 3) {
        leftDetectionCount = 0
        if (bubbleWindow && !bubbleWindow.isDestroyed()) {
          bubbleWindow.webContents.send('ask-meeting-ended')
        }
      }
    } else if (state.state === 'ACTIVE' || state.hasMeetTab) {
      // Meeting still present — reset ALL counters
      leftDetectionCount = 0
      noControlsCount = 0
    } else if (state.state === 'NONE' && !state.hasMeetTab) {
      // No Meet window at all — Chrome might be closed
      // Require 7 consecutive checks (~10s) to confirm it's truly gone
      leftDetectionCount = 0
      noControlsCount++
      if (noControlsCount % 3 === 0) {
        debugLog(`[MeetDetect] No Meet window (${noControlsCount}/7)`)
      }
      if (noControlsCount >= 7) {
        debugLog('[MeetDetect] No Meet window for ~10s — asking confirmation')
        noControlsCount = 0
        if (bubbleWindow && !bubbleWindow.isDestroyed()) {
          bubbleWindow.webContents.send('ask-meeting-ended')
        }
      }
    }
  }
}

const MEET_CHECK_IDLE = 3000    // 3s when not recording
const MEET_CHECK_RECORDING = 1500 // 1.5s when recording (faster end detection)
let currentMeetCheckInterval = MEET_CHECK_IDLE

let screenPermissionWarned = false

function checkScreenPermission() {
  if (process.platform !== 'darwin') return true
  const status = systemPreferences.getMediaAccessStatus('screen')
  debugLog(`[MeetDetect] Screen recording permission: ${status}`)
  if (status !== 'granted') {
    if (!screenPermissionWarned) {
      screenPermissionWarned = true
      debugLog('[MeetDetect] Screen recording NOT granted — prompting user')
      // Tell bubble to show permission message
      if (bubbleWindow && !bubbleWindow.isDestroyed()) {
        bubbleWindow.webContents.send('screen-permission-needed')
      }
    }
    return false
  }
  screenPermissionWarned = false
  return true
}

function startMeetDetection() {
  if (meetDetectionInterval) return
  currentMeetCheckInterval = MEET_CHECK_IDLE
  meetDetectionInterval = setInterval(checkForMeetWindow, currentMeetCheckInterval)
  debugLog('[MeetDetect] Started monitoring for Google Meet windows')
}

function setMeetCheckSpeed(fast) {
  if (!meetDetectionInterval) return
  const newInterval = fast ? MEET_CHECK_RECORDING : MEET_CHECK_IDLE
  if (newInterval === currentMeetCheckInterval) return
  clearInterval(meetDetectionInterval)
  currentMeetCheckInterval = newInterval
  meetDetectionInterval = setInterval(checkForMeetWindow, newInterval)
  debugLog(`[MeetDetect] Check interval → ${newInterval}ms (${fast ? 'recording' : 'idle'})`)
}

function stopMeetDetection() {
  if (meetDetectionInterval) {
    clearInterval(meetDetectionInterval)
    meetDetectionInterval = null
  }
}

// ============================================================
// CALENDAR-BASED MEET DETECTION (no Screen Recording needed)
// ============================================================
let calendarCheckInterval = null
let lastCalendarMeetingId = null  // Prevents re-asking for same meeting

async function getAuthToken() {
  if (!mainWindow || mainWindow.isDestroyed()) return null
  try {
    return await mainWindow.webContents.executeJavaScript(`
      (function() {
        try {
          for (var i = 0; i < localStorage.length; i++) {
            var key = localStorage.key(i);
            if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
              var raw = localStorage.getItem(key);
              if (raw) {
                var parsed = JSON.parse(raw);
                if (parsed && parsed.access_token) return parsed.access_token;
              }
            }
          }
        } catch(e) {}
        return null;
      })()
    `)
  } catch { return null }
}

async function checkCalendarForMeeting() {
  if (!hasUserAuth || isRecordingMeet || pendingMeetConfirmation) return

  try {
    const token = await getAuthToken()
    if (!token) return

    const res = await fetch(`${PLATFORM_URL}/api/calendar/next-meeting?minutes=3`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })

    if (!res.ok) return

    const data = await res.json()
    if (!data.meeting) return

    // Don't ask again for same meeting
    if (data.meeting.id === lastCalendarMeetingId) return
    if (data.meeting.id === declinedMeetCode) return

    debugLog(`[CalendarDetect] Meeting starting soon: "${data.meeting.title}" in ${data.meeting.minutesUntil}min`)

    lastCalendarMeetingId = data.meeting.id
    pendingMeetConfirmation = true
    pendingMeetTitle = data.meeting.title

    if (bubbleWindow && !bubbleWindow.isDestroyed()) {
      bubbleWindow.webContents.send('ask-meeting-start', data.meeting.title)
    }
  } catch (err) {
    // Silent — don't spam logs for network errors
  }
}

function startCalendarDetection() {
  if (calendarCheckInterval) return
  // Check every 30s (lightweight API call, no permissions needed)
  calendarCheckInterval = setInterval(checkCalendarForMeeting, 30000)
  // First check after 10s
  setTimeout(checkCalendarForMeeting, 10000)
  debugLog('[CalendarDetect] Started calendar-based meeting detection (every 30s)')
}

function stopCalendarDetection() {
  if (calendarCheckInterval) {
    clearInterval(calendarCheckInterval)
    calendarCheckInterval = null
  }
}

// ============================================================
// MEETING START CONFIRMATION (bubble asks user before recording)
// ============================================================

// Auto-stop meeting recording (no confirmation needed — definitive signal)
function autoStopMeeting() {
  debugLog('[MeetDetect] AUTO-STOP: Meeting ended definitively')
  isRecordingMeet = false
  detectedMeetTitle = null
  meetHadAudioIndicator = false
  noActiveMeetCount = 0
  meetWindowGoneCount = 0
  noControlsCount = 0
  waitingForMeetReactivation = false
  stopPowerSaveBlocker()
  setMeetCheckSpeed(false) // Back to idle speed

  if (recordingWindow && !recordingWindow.isDestroyed()) {
    recordingWindow.webContents.send('auto-stop-recording')
  }
  if (bubbleWindow && !bubbleWindow.isDestroyed()) {
    bubbleWindow.webContents.send('recording-state', false)
  }
}

// User confirmed → start recording
ipcMain.on('confirm-meeting-start', (_event, meetingType) => {
  debugLog(`[MeetDetect] User confirmed → starting recording (type: ${meetingType})`)
  const meetTitle = pendingMeetTitle
  const meetCode = meetTitle && meetTitle.match(MEET_CODE_PATTERN)?.[0]

  pendingMeetConfirmation = false
  pendingMeetTitle = null
  isRecordingMeet = true
  detectedMeetTitle = meetTitle
  lastRecordedMeetCode = meetCode
  declinedMeetCode = null
  noControlsCount = 0
  startPowerSaveBlocker()
  setMeetCheckSpeed(true) // Faster polling during recording

  createRecordingWindow(true, meetingType || 'sales')
  if (bubbleWindow && !bubbleWindow.isDestroyed()) {
    bubbleWindow.webContents.send('recording-state', true)
  }
})

// User declined → skip this meeting
ipcMain.on('dismiss-meeting-start', () => {
  const meetCode = pendingMeetTitle && pendingMeetTitle.match(MEET_CODE_PATTERN)?.[0]
  debugLog('[MeetDetect] User declined recording for:', meetCode)
  pendingMeetConfirmation = false
  pendingMeetTitle = null
  declinedMeetCode = meetCode // Don't ask again for this meeting
})

// ============================================================
// MEETING END CONFIRMATION (bubble asks user)
// ============================================================

// Heuristic signal from recording.js — DISABLED on Windows
// The audio heuristics (silent system audio, no transcription) produce too many false positives,
// especially in solo meetings or when the user mutes. Window-based LEFT detection + manual
// stop via REC badge/Parar button is sufficient and doesn't annoy the user.
ipcMain.on('meeting-maybe-ended', () => {
  debugLog('[MeetDetect] Audio heuristic received — IGNORED (disabled, too many false positives)')
  // Do nothing — user can stop manually via REC badge or Parar button
})

// User confirmed meeting ended → stop recording (fallback path — auto-stop is preferred)
ipcMain.on('confirm-meeting-ended', () => {
  debugLog('[MeetDetect] User confirmed meeting ended → stopping')
  isRecordingMeet = false
  detectedMeetTitle = null
  meetHadAudioIndicator = false
  noActiveMeetCount = 0
  meetWindowGoneCount = 0
  noControlsCount = 0
  waitingForMeetReactivation = false
  stopPowerSaveBlocker()
  setMeetCheckSpeed(false)

  if (recordingWindow && !recordingWindow.isDestroyed()) {
    recordingWindow.webContents.send('auto-stop-recording')
  }
  if (bubbleWindow && !bubbleWindow.isDestroyed()) {
    bubbleWindow.webContents.send('recording-state', false)
  }
})

// User dismissed → meeting still going, wait for Meet to become active again before re-asking
ipcMain.on('dismiss-meeting-ended', () => {
  debugLog('[MeetDetect] User dismissed → waiting for Meet to reactivate + 60s cooldown')
  waitingForMeetReactivation = true
  dismissCooldownUntil = null // Will be set when Meet becomes active again
  meetWindowGoneCount = 0
  noActiveMeetCount = 0
  noControlsCount = 0
  leftDetectionCount = 0
  if (recordingWindow && !recordingWindow.isDestroyed()) {
    recordingWindow.webContents.send('reset-meeting-detection')
  }
})

// Recording error — show native notification so user knows it failed
ipcMain.on('recording-error', (_event, errorMsg) => {
  debugLog('[Recorder] Evaluation error: ' + errorMsg)
  const notification = new Notification({
    title: 'Erro na avaliacao',
    body: errorMsg || 'Ocorreu um erro ao avaliar a reuniao. Tente gravar novamente.',
    icon: path.join(__dirname, 'assets', 'icon.png'),
  })
  notification.show()
})

// Notify main process that recording finished (so we can reset state)
ipcMain.on('recording-finished', () => {
  debugLog('[Recorder] Recording finished — resetting state')
  isRecordingMeet = false
  detectedMeetTitle = null
  meetHadAudioIndicator = false
  noActiveMeetCount = 0
  meetWindowGoneCount = 0
  waitingForMeetReactivation = false
  stopPowerSaveBlocker()
  if (bubbleWindow && !bubbleWindow.isDestroyed()) {
    bubbleWindow.webContents.send('recording-state', false)
  }

  // Show native macOS notification with results
  const notification = new Notification({
    title: 'Gravacao Finalizada',
    body: 'A avaliacao SPIN da reuniao esta pronta. Clique para ver os resultados.',
    icon: path.join(__dirname, 'assets', 'icon.png'),
  })
  notification.on('click', () => {
    // Open meet analysis page in main window
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show()
      mainWindow.focus()
      mainWindow.webContents.loadURL(`${PLATFORM_URL}/meet-analysis`)
    }
  })
  notification.show()

  // Close hidden recording window silently
  if (recordingWindow && !recordingWindow.isDestroyed()) {
    recordingWindow.destroy()
    recordingWindow = null
  }
})

// ============================================================
// COMPUTER SEARCH (find files, folders, installed programs)
// ============================================================

ipcMain.handle('search-computer', async (_event, query) => {
  console.log('[Search Computer]', JSON.stringify(query))
  if (!query || !query.type) return { results: [] }

  const { execFile } = require('child_process')
  const fs = require('fs')
  const os = require('os')

  // Run PowerShell via temp script file (avoids all escaping issues)
  const runPS = (script) => new Promise((resolve) => {
    const tmpFile = path.join(os.tmpdir(), `ramppy_search_${Date.now()}.ps1`)
    fs.writeFileSync(tmpFile, script, 'utf8')
    execFile('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', tmpFile], { timeout: 15000, windowsHide: true }, (err, stdout) => {
      try { fs.unlinkSync(tmpFile) } catch (_) {}
      if (err) { console.error('[Search] PS error:', err.message); resolve('') }
      else { console.log('[Search] PS output:', stdout.substring(0, 200)); resolve(stdout.trim()) }
    })
  })

  try {
    const searchName = (query.name || '').trim()
    if (!searchName) return { results: [] }
    // Sanitize: only allow safe characters
    const safeName = searchName.replace(/['"`;$&|<>]/g, '')

    switch (query.type) {
      case 'installed_apps': {
        const script = `
$results = @()
$regPaths = @(
  'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
  'HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
  'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'
)
foreach ($rp in $regPaths) {
  Get-ItemProperty $rp -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like '*${safeName}*' } | ForEach-Object {
    $loc = $_.InstallLocation
    if (-not $loc) { $loc = Split-Path $_.DisplayIcon -Parent -ErrorAction SilentlyContinue }
    $results += @{ Name = $_.DisplayName; Path = $loc }
  }
}
if ($results.Count -gt 0) {
  $results | Select-Object -First 5 | ConvertTo-Json -Compress
} else {
  Write-Output '[]'
}
`
        const output = await runPS(script)
        if (!output || output === '[]') return { results: [] }
        try {
          let parsed = JSON.parse(output)
          if (!Array.isArray(parsed)) parsed = [parsed]
          return { results: parsed.filter(r => r.Name).map(r => ({ name: r.Name, path: r.Path || '' })) }
        } catch { return { results: [] } }
      }

      case 'find_folder': {
        const script = `
$found = @()
$drives = (Get-PSDrive -PSProvider FileSystem).Root
foreach ($d in $drives) {
  Get-ChildItem -Path $d -Directory -Recurse -Depth 4 -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like '*${safeName}*' } |
    Select-Object -First 3 |
    ForEach-Object { $found += $_.FullName }
  if ($found.Count -ge 5) { break }
}
if ($found.Count -gt 0) {
  $found | Select-Object -First 5 | ConvertTo-Json -Compress
} else {
  Write-Output '[]'
}
`
        const output = await runPS(script)
        if (!output || output === '[]') return { results: [] }
        try {
          let parsed = JSON.parse(output)
          if (!Array.isArray(parsed)) parsed = [parsed]
          return { results: parsed.map(p => ({ path: typeof p === 'string' ? p : p.toString() })) }
        } catch { return { results: [{ path: output }] } }
      }

      case 'find_file': {
        const userHome = os.homedir()
        const script = `
$found = @()
Get-ChildItem -Path '${userHome.replace(/'/g, "''")}' -Recurse -Depth 5 -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -like '*${safeName}*' -and -not $_.PSIsContainer } |
  Select-Object -First 5 |
  ForEach-Object { $found += $_.FullName }
if ($found.Count -gt 0) {
  $found | ConvertTo-Json -Compress
} else {
  Write-Output '[]'
}
`
        const output = await runPS(script)
        if (!output || output === '[]') return { results: [] }
        try {
          let parsed = JSON.parse(output)
          if (!Array.isArray(parsed)) parsed = [parsed]
          return { results: parsed.map(p => ({ path: typeof p === 'string' ? p : p.toString() })) }
        } catch { return { results: [] } }
      }

      default:
        return { results: [] }
    }
  } catch (err) {
    console.error('[Search Computer] Error:', err)
    return { results: [], error: err.message }
  }
})

// ============================================================
// DESKTOP ACTIONS (AI-triggered app/URL/folder opening)
// ============================================================

const APP_REGISTRY = {
  chrome:       'start chrome',
  'google chrome': 'start chrome',
  firefox:      'start firefox',
  edge:         'start msedge',
  'microsoft edge': 'start msedge',
  notepad:      'notepad.exe',
  'bloco de notas': 'notepad.exe',
  calculator:   'calc.exe',
  calc:         'calc.exe',
  calculadora:  'calc.exe',
  explorer:     'explorer.exe',
  'file explorer': 'explorer.exe',
  'explorador de arquivos': 'explorer.exe',
  vscode:       'code',
  'vs code':    'code',
  code:         'code',
  terminal:     'start wt',
  cmd:          'start cmd',
  powershell:   'start powershell',
  paint:        'mspaint.exe',
  mspaint:      'mspaint.exe',
  word:         'start winword',
  'microsoft word': 'start winword',
  excel:        'start excel',
  'microsoft excel': 'start excel',
  powerpoint:   'start powerpnt',
  ppt:          'start powerpnt',
  outlook:      'start outlook',
  email:        'start outlook',
  spotify:      'start spotify:',
  whatsapp:     'start whatsapp:',
}

ipcMain.handle('execute-desktop-action', async (_event, action) => {
  console.log('[Desktop Action]', JSON.stringify(action))

  if (!action || !action.type || !action.target) {
    return { success: false, error: 'Invalid action format' }
  }

  try {
    switch (action.type) {
      case 'open_url': {
        try {
          const url = new URL(action.target)
          if (!['http:', 'https:'].includes(url.protocol)) {
            return { success: false, error: 'Only http/https URLs allowed' }
          }
        } catch {
          return { success: false, error: 'Invalid URL' }
        }
        await shell.openExternal(action.target)
        return { success: true }
      }

      case 'open_path': {
        const fs = require('fs')
        if (!fs.existsSync(action.target)) {
          return { success: false, error: 'Path does not exist' }
        }
        const result = await shell.openPath(action.target)
        return result ? { success: false, error: result } : { success: true }
      }

      case 'open_app': {
        const appKey = action.target.toLowerCase().trim()
        const cmd = APP_REGISTRY[appKey]

        if (!cmd) {
          return { success: false, error: `App "${action.target}" not in whitelist` }
        }

        // Protocol-based apps (spotify:, whatsapp:, etc.)
        if (cmd.startsWith('start ') && cmd.endsWith(':')) {
          const protocol = cmd.replace('start ', '')
          console.log('[Desktop Action] Opening protocol:', protocol)
          await shell.openExternal(protocol)
          return { success: true }
        }

        // Launch app via cmd /c (safe: cmd comes from whitelist, not user input)
        console.log('[Desktop Action] Running command:', cmd)
        const { exec } = require('child_process')
        return new Promise((resolve) => {
          exec(cmd, { timeout: 5000, windowsHide: true }, (err) => {
            if (err) {
              console.error('[Desktop Action] exec error:', err.message)
              // 'start' returns error code 1 sometimes even when app opens fine
              resolve({ success: true })
            } else {
              console.log('[Desktop Action] exec success')
              resolve({ success: true })
            }
          })
        })
      }

      default:
        return { success: false, error: `Unknown action type: ${action.type}` }
    }
  } catch (err) {
    console.error('[Desktop Action] Error:', err)
    return { success: false, error: err.message || 'Unknown error' }
  }
})

// Navigate main window to a platform view (used by Nicole to guide users in-app)
ipcMain.handle('navigate-platform', async (_event, viewPath) => {
  console.log('[Navigate Platform]', viewPath)
  if (!mainWindow || mainWindow.isDestroyed()) {
    return { success: false, error: 'Main window not available' }
  }

  try {
    // Build the full URL: localhost:3000 + view path
    const url = `${PLATFORM_URL}/${viewPath.replace(/^\//, '')}`
    console.log('[Navigate Platform] Loading:', url)

    mainWindow.loadURL(url)

    // Show and focus the main window
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()

    return { success: true }
  } catch (err) {
    console.error('[Navigate Platform] Error:', err)
    return { success: false, error: err.message || 'Unknown error' }
  }
})

// ============================================================
// NOTIFICATION TOAST (separate window — avoids resizing bubble)
// ============================================================

const NOTIF_TOAST_W = 310
const NOTIF_TOAST_H = 82
const NOTIF_GAP = 10

ipcMain.handle('show-notification-toast', async (_event, data) => {
  // Close existing notification window if open
  if (notificationWindow && !notificationWindow.isDestroyed()) {
    notificationWindow.destroy()
    notificationWindow = null
  }

  if (!bubbleWindow || bubbleWindow.isDestroyed()) return

  // Position notification above the bubble, right-aligned
  const bBounds = bubbleWindow.getBounds()
  let nx = bBounds.x + bBounds.width - NOTIF_TOAST_W
  let ny = bBounds.y - NOTIF_GAP - NOTIF_TOAST_H

  // Clamp to display bounds
  const display = getDisplayAt(bBounds.x + bBounds.width / 2, bBounds.y + bBounds.height / 2)
  const wa = display.workArea
  if (nx < wa.x) nx = wa.x
  if (ny < wa.y) ny = wa.y + NOTIF_GAP
  if (nx + NOTIF_TOAST_W > wa.x + wa.width) nx = wa.x + wa.width - NOTIF_TOAST_W

  notificationWindow = new BrowserWindow({
    width: NOTIF_TOAST_W,
    height: NOTIF_TOAST_H,
    x: nx,
    y: ny,
    resizable: false,
    movable: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload-notification.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  notificationWindow.setAlwaysOnTop(true, 'screen-saver')
  notificationWindow.setMenuBarVisibility(false)

  notificationWindow.loadFile('notification-toast.html')

  // Send notification data after page loads
  notificationWindow.webContents.once('did-finish-load', () => {
    if (notificationWindow && !notificationWindow.isDestroyed()) {
      notificationWindow.webContents.send('set-notification-data', data)
    }
  })

  notificationWindow.on('closed', () => { notificationWindow = null })
})

ipcMain.handle('hide-notification-toast', async () => {
  if (notificationWindow && !notificationWindow.isDestroyed()) {
    notificationWindow.destroy()
    notificationWindow = null
  }
})

// Forward click/dismiss from notification window to bubble
ipcMain.on('notification-toast-click', () => {
  if (notificationWindow && !notificationWindow.isDestroyed()) {
    notificationWindow.destroy()
    notificationWindow = null
  }
  if (bubbleWindow && !bubbleWindow.isDestroyed()) {
    bubbleWindow.webContents.send('notification-clicked')
  }
})

ipcMain.on('notification-toast-dismiss', () => {
  if (notificationWindow && !notificationWindow.isDestroyed()) {
    notificationWindow.destroy()
    notificationWindow = null
  }
  if (bubbleWindow && !bubbleWindow.isDestroyed()) {
    bubbleWindow.webContents.send('notification-dismissed')
  }
})

// ============================================================
// SYSTEM TRAY
// ============================================================
function createTray() {
  tray = new Tray(APP_ICON)
  tray.setToolTip('Ramppy')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Abrir Ramppy',
      click: () => {
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore()
          mainWindow.show()
          mainWindow.focus()
        }
      },
    },
    {
      label: 'Abrir WhatsApp',
      click: () => { createWhatsAppWindow() },
    },
    {
      label: 'Gravar Reuniao',
      click: () => { createRecordingWindow() },
    },
    { type: 'separator' },
    {
      label: 'Sair',
      click: () => {
        app.isQuitting = true
        app.quit()
      },
    },
  ])

  tray.setContextMenu(contextMenu)

  // Single-click on tray icon opens the main window (Windows expects single-click)
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
  })

  // Double-click also opens (fallback)
  tray.on('double-click', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
  })
}

// ============================================================
// APP LIFECYCLE
// ============================================================

// Accept ramppy.site certificates
app.on('certificate-error', (event, _webContents, url, _error, _cert, callback) => {
  if (new URL(url).hostname.endsWith(ALLOWED_DOMAIN)) {
    event.preventDefault()
    callback(true)
  } else {
    callback(false)
  }
})

app.whenReady().then(() => {
  console.log('[Main] app.whenReady fired')
  // Grant media permissions
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(true)
  })
  session.defaultSession.setPermissionCheckHandler(() => true)

  // System audio loopback via macOS native ScreenCaptureKit picker
  // Only on macOS — on Windows this can interfere with normal audio playback
  if (process.platform === 'darwin') {
    session.defaultSession.setDisplayMediaRequestHandler(async (_request, callback) => {
      console.log('[AudioLoopback] System picker was cancelled — falling back to manual source')
      try {
        if (!hasScreenPermission()) { callback({}); return }
        const sources = await desktopCapturer.getSources({ types: ['screen'] })
        if (sources.length > 0) {
          callback({ video: sources[0], audio: 'loopback' })
        } else {
          callback({})
        }
      } catch (err) {
        console.error('[AudioLoopback] Fallback error:', err)
        callback({})
      }
    }, { useSystemPicker: true })
  }

  console.log('[Main] Creating main window...')
  createMainWindow()
  console.log('[Main] Main window created')

  // BlackHole driver: prompt installation on first launch (non-blocking)
  console.log('[Main] Checking BlackHole...')
  ensureBlackHoleInstalled().catch(err => {
    console.error('[BlackHole] First-launch check failed:', err)
  })

  // macOS: check permissions early
  if (process.platform === 'darwin') {
    const screenStatus = systemPreferences.getMediaAccessStatus('screen')
    console.log('[Permissions] Screen recording status:', screenStatus)
    const micStatus = systemPreferences.getMediaAccessStatus('microphone')
    console.log('[Permissions] Microphone status:', micStatus)
    if (micStatus !== 'granted') {
      systemPreferences.askForMediaAccess('microphone').then(granted => {
        console.log('[Permissions] Microphone granted:', granted)
      })
    }
  }

  // macOS: temporarily hide dock to become accessory app (LSUIElement)
  // This enables NSWindowCollectionBehaviorFullScreenAuxiliary on the bubble,
  // which is what native overlay apps (CleanShot, Loom) use to float above everything
  if (process.platform === 'darwin') {
    app.dock.hide()
  }

  console.log('[Main] Creating bubble, tray, auth, meet...')
  createBubbleWindow()
  createTray()
  startAuthBridge()
  startMeetDetection()
  startCalendarDetection()
  console.log('[Main] All init complete')

  // macOS: restore dock icon after bubble settings are applied
  if (process.platform === 'darwin') {
    setTimeout(() => { app.dock.show() }, 1500)
  }

  // Global shortcut: Cmd+Shift+Space (macOS) / Ctrl+Shift+Space (others) toggles bubble
  globalShortcut.register('CommandOrControl+Shift+Space', () => {
    if (!bubbleWindow || bubbleWindow.isDestroyed()) return

    // Move bubble to the display where the cursor currently is
    const cursorPos = screen.getCursorScreenPoint()
    const activeDisplay = screen.getDisplayNearestPoint(cursorPos)
    const bubbleBounds = bubbleWindow.getBounds()
    const currentDisplay = screen.getDisplayNearestPoint({
      x: bubbleBounds.x + bubbleBounds.width / 2,
      y: bubbleBounds.y + bubbleBounds.height / 2,
    })

    // If cursor is on a different monitor, move bubble there
    if (activeDisplay.id !== currentDisplay.id) {
      const wa = activeDisplay.workArea
      const margin = 12
  
      bubbleWindow.setBounds({
        x: wa.x + wa.width - bubbleBounds.width - margin,
        y: wa.y + wa.height - bubbleBounds.height - margin,
        width: bubbleBounds.width,
        height: bubbleBounds.height,
      })
  
    }

    bubbleWindow.webContents.send('toggle-bubble')
    if (!bubbleWindow.isVisible()) bubbleWindow.show()
  })

  // Ctrl+Shift+F12 → test Nicole notification (cycles through types)
  globalShortcut.register('CommandOrControl+Shift+F12', () => {
    if (bubbleWindow && !bubbleWindow.isDestroyed()) {
      console.log('[Main] Test notification triggered (Ctrl+Shift+N)')
      bubbleWindow.webContents.send('test-notification')
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
      createBubbleWindow()
      startAuthBridge()
    } else {
      // Restore hidden windows (from close-to-tray)
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.show()
      if (bubbleWindow && !bubbleWindow.isDestroyed()) bubbleWindow.show()
    }
  })
})

app.on('before-quit', () => {
  app.isQuitting = true
  stopPowerSaveBlocker()
  // Emergency cleanup: destroy Multi-Output device if still active
  try { destroyMultiOutputDevice() } catch (_) {}
})

app.on('window-all-closed', () => {
  globalShortcut.unregisterAll()
  if (authTokenInterval) clearInterval(authTokenInterval)
  stopMeetDetection()
  globalShortcut.unregisterAll()
  if (process.platform !== 'darwin') app.quit()
})
