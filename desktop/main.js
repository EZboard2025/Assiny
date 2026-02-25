const { app, BrowserWindow, ipcMain, session, desktopCapturer, shell, screen, Tray, Menu, Notification, globalShortcut, systemPreferences } = require('electron')
const path = require('path')

// System audio loopback is handled via setDisplayMediaRequestHandler (see app.whenReady)

// DEV: use localhost | PROD: use ramppy.site
const IS_DEV = !app.isPackaged
const PLATFORM_URL = IS_DEV ? 'http://localhost:3000' : 'https://ramppy.site'
const ALLOWED_DOMAIN = 'ramppy.site'

let mainWindow = null
let bubbleWindow = null
let recordingWindow = null
let authTokenInterval = null
let tray = null

// Meet auto-detection state
let meetDetectionInterval = null
let isRecordingMeet = false
let detectedMeetTitle = null
let hasUserAuth = false
let lastRecordedMeetCode = null // Prevents re-recording same meeting after user leaves
let meetNoAudioSince = null // Timestamp when 🔊 disappeared from tab title

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
    show: !autoStart, // Hidden in auto mode (runs silently in background)
    title: 'Ramppy Recorder',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
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
    }
    // Always notify bubble that recording stopped
    if (bubbleWindow && !bubbleWindow.isDestroyed()) {
      bubbleWindow.webContents.send('recording-state', false)
    }
  })
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
// GOOGLE MEET AUTO-DETECTION
// ============================================================

// Active meeting titles contain a meeting code (e.g. "Meet: abc-defg-hij 🔊")
// Chrome shows 🔊 when the tab is producing audio (WebRTC call active)
// When user leaves the meeting, 🔊 disappears because audio stops
const MEET_CODE_PATTERN = /[a-z]{3}-[a-z]{4}-[a-z]{3}/
const MEET_AUDIO_INDICATOR = /🔊|🔈/
const MEET_NO_AUDIO_TIMEOUT = 20_000 // 20s without 🔊 = meeting ended
const MEET_LEFT_PATTERNS = [
  'você saiu', 'you left', 'saiu da reunião', 'left the meeting',
  'reunião encerrada', 'meeting ended', 'chamada encerrada', 'call ended',
  'a reunião foi encerrada', 'the meeting has ended',
]

function hasMeetCode(title) {
  return MEET_CODE_PATTERN.test(title)
}

function hasMeetAudio(title) {
  return MEET_AUDIO_INDICATOR.test(title)
}

function isLeftMeetWindow(title) {
  const lower = title.toLowerCase()
  return MEET_LEFT_PATTERNS.some(p => lower.includes(p))
}

async function checkForMeetWindow() {
  if (!hasUserAuth) return

  try {
    const sources = await desktopCapturer.getSources({
      types: ['window'],
      thumbnailSize: { width: 0, height: 0 },
    })

    // Categorize Meet windows
    const meetWithAudio = sources.find(s => hasMeetCode(s.name) && hasMeetAudio(s.name) && !isLeftMeetWindow(s.name))
    const meetTabAny = sources.find(s => hasMeetCode(s.name))
    const userLeft = sources.some(s => isLeftMeetWindow(s.name))

    // Debug: log Meet window titles while recording
    if (isRecordingMeet) {
      const meetTitles = sources.filter(s => hasMeetCode(s.name)).map(s => `"${s.name}"`)
      console.log(`[MeetDetect] Check: ${meetTitles.join(', ')} | hasAudio=${!!meetWithAudio} | userLeft=${userLeft}`)
    }

    if (!isRecordingMeet) {
      // Not recording — start only when meeting code + 🔊 are present
      if (meetWithAudio) {
        const meetCode = meetWithAudio.name.match(MEET_CODE_PATTERN)?.[0]
        if (meetCode && meetCode === lastRecordedMeetCode) return // Already recorded, skip

        isRecordingMeet = true
        detectedMeetTitle = meetWithAudio.name
        lastRecordedMeetCode = meetCode
        meetNoAudioSince = null
        console.log('[MeetDetect] Active meeting detected:', meetWithAudio.name)

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
      // Currently recording — check if meeting ended
      if (meetWithAudio) {
        // 🔊 still present — meeting is active
        meetNoAudioSince = null
      } else if (userLeft || !meetTabAny) {
        // User explicitly left (title text) or tab was closed — stop immediately
        const reason = userLeft ? 'User left meeting' : 'Meet window closed'
        console.log(`[MeetDetect] Meeting ended (${reason}). Stopping recording...`)
        meetNoAudioSince = null
        isRecordingMeet = false
        detectedMeetTitle = null

        if (recordingWindow && !recordingWindow.isDestroyed()) {
          recordingWindow.webContents.send('auto-stop-recording')
        }
        if (bubbleWindow && !bubbleWindow.isDestroyed()) {
          bubbleWindow.webContents.send('recording-state', false)
        }
      } else if (meetTabAny) {
        // Tab open with meeting code but NO 🔊 — user likely left
        if (!meetNoAudioSince) {
          meetNoAudioSince = Date.now()
          console.log('[MeetDetect] Audio indicator (🔊) gone. Starting 20s grace period...')
        } else if (Date.now() - meetNoAudioSince > MEET_NO_AUDIO_TIMEOUT) {
          console.log('[MeetDetect] No audio indicator for 20s — meeting ended. Stopping recording.')
          meetNoAudioSince = null
          isRecordingMeet = false
          detectedMeetTitle = null

          if (recordingWindow && !recordingWindow.isDestroyed()) {
            recordingWindow.webContents.send('auto-stop-recording')
          }
          if (bubbleWindow && !bubbleWindow.isDestroyed()) {
            bubbleWindow.webContents.send('recording-state', false)
          }
        }
      }
    }

    // Reset when all Meet tabs are closed (allow detecting next meeting)
    if (!meetTabAny && !isRecordingMeet && !userLeft) {
      lastRecordedMeetCode = null
      meetNoAudioSince = null
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

// Notify main process that recording finished (so we can reset state)
ipcMain.on('recording-finished', () => {
  isRecordingMeet = false
  detectedMeetTitle = null
  if (bubbleWindow && !bubbleWindow.isDestroyed()) {
    bubbleWindow.webContents.send('recording-state', false)
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

  // System audio loopback: auto-select primary screen + capture ALL system audio
  // This uses macOS ScreenCaptureKit (13+) to capture Chrome/Meet audio without a picker
  session.defaultSession.setDisplayMediaRequestHandler(async (_request, callback) => {
    try {
      const sources = await desktopCapturer.getSources({ types: ['screen'] })
      if (sources.length > 0) {
        console.log('[AudioLoopback] Granting screen + system audio loopback:', sources[0].name)
        callback({ video: sources[0], audio: 'loopback' })
      } else {
        console.error('[AudioLoopback] No screen sources found')
        callback({})
      }
    } catch (err) {
      console.error('[AudioLoopback] Error getting sources:', err)
      callback({})
    }
  })

  createMainWindow()

  // macOS: request microphone permission early (avoids hang during recording)
  if (process.platform === 'darwin') {
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
})

app.on('window-all-closed', () => {
  if (authTokenInterval) clearInterval(authTokenInterval)
  stopMeetDetection()
  globalShortcut.unregisterAll()
  if (process.platform !== 'darwin') app.quit()
})
