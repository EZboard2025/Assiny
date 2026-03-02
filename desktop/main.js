const { app, BrowserWindow, BaseWindow, WebContentsView, ipcMain, session, desktopCapturer, shell, screen, Tray, Menu, Notification, globalShortcut, systemPreferences, dialog, powerSaveBlocker } = require('electron')
const path = require('path')
const fs = require('fs')
const { isBlackHoleInstalled, installBlackHoleDriver, createMultiOutputDevice, destroyMultiOutputDevice } = require('./audio-devices')

// File-based logging for auto-scan debugging
const LOG_FILE = '/tmp/electron-debug.log'
function debugLog(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`
  fs.appendFileSync(LOG_FILE, line)
  console.log(msg)
}

debugLog('=== Electron main.js loaded ===')

// System audio loopback is handled via setDisplayMediaRequestHandler (see app.whenReady)

// DEV: use localhost | PROD: use ramppy.site
const IS_DEV = !app.isPackaged
const PLATFORM_URL = IS_DEV ? 'http://localhost:3000' : 'https://ramppy.site'
const ALLOWED_DOMAIN = 'ramppy.site'

let mainWindow = null
let bubbleWindow = null
let recordingWindow = null
let whatsappBaseWindow = null // Single window for WhatsApp + Copilot
let waView = null             // WebContentsView: WhatsApp Web (left)
let copilotView = null        // WebContentsView: Sales Copilot (right)
let isAutoScanRunning = false // Prevents scraper re-injection during auto-scan
let authTokenInterval = null
let tray = null

const COPILOT_WIDTH = 400

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
let powerSaveBlockerId = null // Prevents macOS App Nap during recording

// Single instance lock — prevent duplicate app processes
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    // Focus existing main window when user tries to open a second instance
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
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
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.loadURL(PLATFORM_URL)
  mainWindow.setMenuBarVisibility(false)

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

  // F12 to toggle DevTools
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12') {
      mainWindow.webContents.toggleDevTools()
    }
  })

  // "X" hides to tray instead of quitting
  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault()
      mainWindow.hide()
    }
  })

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
    movable: true,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    show: false,
    title: 'Ramppy Assistant',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    visibleOnAllWorkspaces: true,
    fullscreenable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // Highest window level + relative bump
  bubbleWindow.setAlwaysOnTop(true, 'screen-saver', 1)
  bubbleWindow.setVisibleOnAllWorkspaces(true, {
    visibleOnFullScreen: true,
    skipTransformProcessType: true,
  })

  bubbleWindow.loadFile('bubble.html')
  bubbleWindow.setMenuBarVisibility(false)

  // Forward mouse events through transparent areas
  bubbleWindow.setIgnoreMouseEvents(true, { forward: true })

  // Re-assert on blur (other apps stealing z-order)
  bubbleWindow.on('blur', () => {
    if (bubbleWindow && !bubbleWindow.isDestroyed()) {
      bubbleWindow.setAlwaysOnTop(true, 'screen-saver', 1)
    }
  })

  // Re-assert on show
  bubbleWindow.on('show', () => {
    if (bubbleWindow && !bubbleWindow.isDestroyed()) {
      bubbleWindow.setAlwaysOnTop(true, 'screen-saver', 1)
      bubbleWindow.setVisibleOnAllWorkspaces(true, {
        visibleOnFullScreen: true,
        skipTransformProcessType: true,
      })
    }
  })

  // F12 for DevTools on bubble too
  bubbleWindow.webContents.on('before-input-event', (_event, input) => {
    if (input.key === 'F12') {
      bubbleWindow.webContents.toggleDevTools()
    }
  })

  bubbleWindow.on('closed', () => { bubbleWindow = null })
}

// ============================================================
// RECORDING WINDOW (meeting audio capture)
// ============================================================
function createRecordingWindow(autoStart = false) {
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

  // When BlackHole is installed + auto-start, window can be hidden (no picker needed)
  const canBeHidden = autoStart && isBlackHoleInstalled()

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

  // Forward renderer console logs to main process stdout
  recordingWindow.webContents.on('console-message', (event) => {
    const prefix = ['LOG', 'WARN', 'ERR'][event.level] || 'LOG'
    console.log(`[Recorder:${prefix}] ${event.message}`)
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
                recordingWindow.webContents.send('auto-start-recording')
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

  // --- Copilot view (right side) ---
  copilotView = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
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
    } catch (err) {
      console.error('[WhatsApp Desktop] Heartbeat failed:', err.message)
    }
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
  const [w, h] = whatsappBaseWindow.getSize()
  const waWidth = Math.max(500, w - COPILOT_WIDTH)
  waView.setBounds({ x: 0, y: 0, width: waWidth, height: h })
  copilotView.setBounds({ x: waWidth, y: 0, width: COPILOT_WIDTH, height: h })
}

// ============================================================
// AUTH TOKEN BRIDGE (main window → bubble window + recording window)
// ============================================================
function startAuthBridge() {
  // Extract Supabase auth token from main window and forward to bubble
  const extractAndForward = async () => {
    if (!mainWindow || mainWindow.isDestroyed() || !bubbleWindow || bubbleWindow.isDestroyed()) return

    try {
      const authData = await mainWindow.webContents.executeJavaScript(`
        (function() {
          try {
            // Supabase stores session in localStorage with key pattern: sb-<ref>-auth-token
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

      if (authData) {
        const parsed = JSON.parse(authData)
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
    } catch (_) {
      // Main window may not be ready yet
    }
  }

  // Check every 3 seconds
  authTokenInterval = setInterval(extractAndForward, 3000)
  // Also run immediately after a short delay (wait for page to load)
  setTimeout(extractAndForward, 2000)
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
  const wa = getBubbleDisplay()

  // Expand: anchor to bottom-right of current bubble position
  let x = bounds.x + bounds.width - width
  let y = bounds.y + bounds.height - height

  // Clamp to the display the bubble is on
  if (x < wa.x) x = wa.x
  if (y < wa.y) y = wa.y
  if (x + width > wa.x + wa.width) x = wa.x + wa.width - width
  if (y + height > wa.y + wa.height) y = wa.y + wa.height - height

  bubbleWindow.setBounds({ x, y, width, height }, true)
  bubbleWindow.setResizable(width > 100)
})

// Move bubble to absolute screen position (clamped to current display)
ipcMain.on('move-bubble', (_event, x, y) => {
  if (!bubbleWindow) return
  const bounds = bubbleWindow.getBounds()
  // Don't clamp during drag — allow free movement across monitors
  bubbleWindow.setBounds({ x, y, width: bounds.width, height: bounds.height })
})

// Set bubble bounds (position + size) for edge/corner resizing
ipcMain.on('set-bubble-bounds', (_event, x, y, width, height) => {
  if (!bubbleWindow) return
  const wa = getBubbleDisplay()
  // Enforce min size
  if (width < 320) width = 320
  if (height < 400) height = 400
  // Clamp to the display the bubble is on
  if (x < wa.x) x = wa.x
  if (y < wa.y) y = wa.y
  if (x + width > wa.x + wa.width) width = wa.x + wa.width - x
  if (y + height > wa.y + wa.height) height = wa.y + wa.height - y
  bubbleWindow.setBounds({ x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) })
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

// Capture screenshot of primary display for AI vision
ipcMain.handle('capture-screenshot', async () => {
  try {
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

    // Daily scan: run full scan once per day, skip if already scanned today
    const scannedCount = storedConversations.filter(c => (c.message_count || 0) > 0).length
    const today = new Date().toDateString()
    const lastScanDate = storedConversations.reduce((latest, c) => {
      if (c.updated_at && new Date(c.updated_at) > latest) return new Date(c.updated_at)
      return latest
    }, new Date(0))
    const scannedToday = lastScanDate.toDateString() === today && scannedCount >= Math.floor(MAX_CONVERSATIONS * 0.7)

    debugLog(`[Auto-Scan] ${scannedCount} conversations with messages, scanned today: ${scannedToday}`)

    if (scannedToday) {
      debugLog('[Auto-Scan] Already scanned today, skipping. Manager can use on-demand scrape.')
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
// Chrome shows 🔊 when the tab is producing audio (WebRTC call active)
// When user leaves the meeting, 🔊 disappears because audio stops
const MEET_CODE_PATTERN = /[a-z]{3}-[a-z]{4}-[a-z]{3}/
const MEET_LEFT_PATTERNS = [
  'você saiu', 'you left', 'saiu da reunião', 'left the meeting',
  'reunião encerrada', 'meeting ended', 'chamada encerrada', 'call ended',
  'a reunião foi encerrada', 'the meeting has ended',
]

function hasMeetCode(title) {
  return MEET_CODE_PATTERN.test(title)
}

function isLeftMeetWindow(title) {
  const lower = title.toLowerCase()
  return MEET_LEFT_PATTERNS.some(p => lower.includes(p))
}

async function checkForMeetWindow() {
  if (!hasUserAuth) {
    console.log('[MeetDetect] Skipping — no auth yet')
    return
  }

  try {
    const sources = await desktopCapturer.getSources({
      types: ['window'],
      thumbnailSize: { width: 0, height: 0 },
    })

    // Categorize Meet windows
    // Don't require 🔊 — Chrome hides it when tab is in background or sharing screen
    const activeMeet = sources.find(s => hasMeetCode(s.name) && !isLeftMeetWindow(s.name))
    const meetTabAny = sources.find(s => hasMeetCode(s.name))
    const userLeft = sources.some(s => isLeftMeetWindow(s.name))

    // Debug: log all Meet-related windows and any window containing "meet" or "Meet"
    const meetRelated = sources.filter(s => /meet/i.test(s.name) || hasMeetCode(s.name))
    if (meetRelated.length > 0 || isRecordingMeet) {
      console.log(`[MeetDetect] Windows: ${meetRelated.map(s => `"${s.name}"`).join(', ') || 'none'} | activeMeet=${!!activeMeet} | isRecording=${isRecordingMeet} | lastCode=${lastRecordedMeetCode}`)
    }

    if (!isRecordingMeet) {
      // Not recording — start only when meeting code + 🔊 are present
      if (activeMeet) {
        const meetCode = activeMeet.name.match(MEET_CODE_PATTERN)?.[0]
        if (meetCode && meetCode === lastRecordedMeetCode) return // Already recorded, skip

        isRecordingMeet = true
        detectedMeetTitle = activeMeet.name
        lastRecordedMeetCode = meetCode
        startPowerSaveBlocker()

        console.log('[MeetDetect] Active meeting detected:', activeMeet.name)

        if (Notification.isSupported()) {
          new Notification({
            title: 'Reuniao detectada!',
            body: 'Gravando automaticamente. Feche a aba do Meet ao sair para parar a gravacao.',
            icon: path.join(__dirname, 'assets', 'icon.png'),
            silent: false,
          }).show()
        }

        createRecordingWindow(true)
        // Notify bubble that recording started
        if (bubbleWindow && !bubbleWindow.isDestroyed()) {
          bubbleWindow.webContents.send('recording-state', true)
        }
      }
    } else {
      // Currently recording — stop signals (in priority order):
      // 1. Explicit "you left" / "meeting ended" title → instant stop
      // 2. Meet window disappeared entirely (tab closed) → stop after 10s debounce
      // 3. Multi-signal detector in recording.js (system audio silence + transcript gap)
      if (userLeft) {
        console.log('[MeetDetect] User left the meeting. Stopping recording...')
        meetWindowGoneCount = 0
        isRecordingMeet = false
        detectedMeetTitle = null
        stopPowerSaveBlocker()

        if (recordingWindow && !recordingWindow.isDestroyed()) {
          recordingWindow.webContents.send('auto-stop-recording')
        }
        if (bubbleWindow && !bubbleWindow.isDestroyed()) {
          bubbleWindow.webContents.send('recording-state', false)
        }
      } else if (!meetTabAny) {
        // Meet window gone — user closed the tab or Chrome
        meetWindowGoneCount++
        console.log(`[MeetDetect] Meet window not found (${meetWindowGoneCount}/2)`)
        if (meetWindowGoneCount >= 2) { // 2 × 5s = 10s debounce
          console.log('[MeetDetect] Meet window gone for 10s — stopping recording')
          meetWindowGoneCount = 0
          isRecordingMeet = false
          detectedMeetTitle = null
          stopPowerSaveBlocker()

          if (recordingWindow && !recordingWindow.isDestroyed()) {
            recordingWindow.webContents.send('auto-stop-recording')
          }
          if (bubbleWindow && !bubbleWindow.isDestroyed()) {
            bubbleWindow.webContents.send('recording-state', false)
          }
        }
      } else {
        // Meet tab still exists (might be background/sharing screen) — keep recording
        meetWindowGoneCount = 0
      }
    }

    // Reset when all Meet tabs are closed (allow detecting next meeting)
    if (!meetTabAny && !isRecordingMeet && !userLeft) {
      lastRecordedMeetCode = null
    }
  } catch (err) {
    console.error('[MeetDetect] Error:', err)
  }
}

function startMeetDetection() {
  if (meetDetectionInterval) return
  meetDetectionInterval = setInterval(checkForMeetWindow, 5000) // Check every 5s
  console.log('[MeetDetect] Started monitoring for Google Meet windows')
}

function stopMeetDetection() {
  if (meetDetectionInterval) {
    clearInterval(meetDetectionInterval)
    meetDetectionInterval = null
  }
}

// ============================================================
// MEETING END CONFIRMATION (bubble asks user)
// ============================================================

// Recording detected heuristic signal → ask user via bubble
ipcMain.on('meeting-maybe-ended', () => {
  console.log('[MeetDetect] Heuristic signal: asking user if meeting ended')
  if (bubbleWindow && !bubbleWindow.isDestroyed()) {
    bubbleWindow.webContents.send('ask-meeting-ended')
  }
})

// User confirmed meeting ended → stop recording
ipcMain.on('confirm-meeting-ended', () => {
  console.log('[MeetDetect] User confirmed meeting ended → stopping')
  isRecordingMeet = false
  detectedMeetTitle = null
  stopPowerSaveBlocker()

  if (recordingWindow && !recordingWindow.isDestroyed()) {
    recordingWindow.webContents.send('auto-stop-recording')
  }
  if (bubbleWindow && !bubbleWindow.isDestroyed()) {
    bubbleWindow.webContents.send('recording-state', false)
  }
})

// User dismissed → meeting still going, reset detection
ipcMain.on('dismiss-meeting-ended', () => {
  console.log('[MeetDetect] User dismissed → meeting still going, resetting detection')
  if (recordingWindow && !recordingWindow.isDestroyed()) {
    recordingWindow.webContents.send('reset-meeting-detection')
  }
})

// Notify main process that recording finished (so we can reset state)
ipcMain.on('recording-finished', () => {
  isRecordingMeet = false
  detectedMeetTitle = null
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
// SYSTEM TRAY
// ============================================================
function createTray() {
  tray = new Tray(path.join(__dirname, 'assets', 'icon.png'))
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

  // Double-click on tray icon opens the main window
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
  // Grant media permissions
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(true)
  })
  session.defaultSession.setPermissionCheckHandler(() => true)

  // System audio loopback via macOS native ScreenCaptureKit picker
  // useSystemPicker: true shows macOS native picker which properly initializes
  // audio loopback (avoids the readyState=ended bug with manual source selection).
  // The handler below is only called if the user cancels the system picker.
  session.defaultSession.setDisplayMediaRequestHandler(async (_request, callback) => {
    console.log('[AudioLoopback] System picker was cancelled — falling back to manual source')
    try {
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

  createMainWindow()

  // BlackHole driver: prompt installation on first launch (non-blocking)
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

  createBubbleWindow()
  createTray()
  startAuthBridge()
  startMeetDetection()

  // macOS: restore dock icon after bubble settings are applied
  if (process.platform === 'darwin') {
    setTimeout(() => { app.dock.show() }, 1500)
  }

  // Global shortcut: Cmd+Shift+R (macOS) / Ctrl+Shift+R (others) toggles bubble
  globalShortcut.register('CommandOrControl+Shift+R', () => {
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

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
      createBubbleWindow()
      startAuthBridge()
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
  if (authTokenInterval) clearInterval(authTokenInterval)
  stopMeetDetection()
  globalShortcut.unregisterAll()
  if (process.platform !== 'darwin') app.quit()
})
