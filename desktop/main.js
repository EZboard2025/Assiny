const { app, BrowserWindow, ipcMain, session, desktopCapturer, shell, screen, Tray, Menu } = require('electron')
const path = require('path')

const PLATFORM_URL = 'https://assiny.ramppy.site'
const ALLOWED_DOMAIN = 'ramppy.site'

let mainWindow = null
let bubbleWindow = null
let authTokenInterval = null
let tray = null

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
      if (hostname.endsWith(ALLOWED_DOMAIN)) {
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
    show: false, // Start hidden — only show after user logs in
    title: 'Ramppy Assistant',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  bubbleWindow.loadFile('bubble.html')
  bubbleWindow.setMenuBarVisibility(false)

  // F12 for DevTools on bubble too
  bubbleWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12') {
      bubbleWindow.webContents.toggleDevTools()
    }
  })

  bubbleWindow.on('closed', () => { bubbleWindow = null })
}

// ============================================================
// AUTH TOKEN BRIDGE (main window → bubble window)
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
        bubbleWindow.webContents.send('auth-token', JSON.parse(authData))
        // Show bubble once user is authenticated
        if (!bubbleWindow.isVisible()) {
          bubbleWindow.show()
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

// Resize bubble window (collapse ↔ expand)
ipcMain.handle('resize-bubble', async (_event, width, height) => {
  if (!bubbleWindow) return

  const bounds = bubbleWindow.getBounds()
  const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize

  // Expand: anchor to bottom-right of current bubble position
  let x = bounds.x + bounds.width - width
  let y = bounds.y + bounds.height - height

  // Clamp to screen bounds so the panel is always fully visible
  if (x < 0) x = 0
  if (y < 0) y = 0
  if (x + width > screenW) x = screenW - width
  if (y + height > screenH) y = screenH - height

  bubbleWindow.setBounds({ x, y, width, height }, true)
  bubbleWindow.setResizable(width > 100)
})

// Move bubble to absolute screen position (clamped to screen)
ipcMain.on('move-bubble', (_event, x, y) => {
  if (!bubbleWindow) return
  const bounds = bubbleWindow.getBounds()
  const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize

  // Clamp so window stays fully visible
  if (x < 0) x = 0
  if (y < 0) y = 0
  if (x + bounds.width > screenW) x = screenW - bounds.width
  if (y + bounds.height > screenH) y = screenH - bounds.height

  bubbleWindow.setBounds({ x, y, width: bounds.width, height: bounds.height })
})

// Set bubble bounds (position + size) for edge/corner resizing
ipcMain.on('set-bubble-bounds', (_event, x, y, width, height) => {
  if (!bubbleWindow) return
  const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize
  // Enforce min size
  if (width < 320) width = 320
  if (height < 400) height = 400
  // Clamp to screen
  if (x < 0) x = 0
  if (y < 0) y = 0
  if (x + width > screenW) width = screenW - x
  if (y + height > screenH) height = screenH - y
  bubbleWindow.setBounds({ x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) })
})

// Get current bubble position
ipcMain.handle('get-bubble-pos', async () => {
  if (!bubbleWindow) return { x: 0, y: 0 }
  const bounds = bubbleWindow.getBounds()
  return { x: bounds.x, y: bounds.y }
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

  createMainWindow()
  createBubbleWindow()
  createTray()
  startAuthBridge()

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
  if (process.platform !== 'darwin') app.quit()
})
