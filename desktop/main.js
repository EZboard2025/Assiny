const { app, BrowserWindow, ipcMain, session, desktopCapturer, shell, screen, Tray, Menu, nativeImage, globalShortcut } = require('electron')
const path = require('path')

const PLATFORM_URL = 'http://localhost:3000'
const ALLOWED_DOMAIN = 'localhost'

const iconFile = process.platform === 'win32' ? 'icon.ico' : 'icon.png'
const ICON_PATH = path.join(__dirname, 'assets', iconFile)
const APP_ICON = nativeImage.createFromPath(ICON_PATH)

// Force Windows taskbar to use our icon instead of default Electron icon
app.setAppUserModelId('com.ramppy.app')

// Allow audio autoplay without user gesture (needed for TTS in bubble window)
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')

let mainWindow = null
let bubbleWindow = null
let notificationWindow = null
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
    icon: APP_ICON,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.loadURL(PLATFORM_URL)
  mainWindow.webContents.setZoomFactor(1.2)
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
    }
  })

  // Nudge bubble to check notifications when user returns to app
  mainWindow.on('focus', () => {
    if (bubbleWindow && !bubbleWindow.isDestroyed()) {
      bubbleWindow.webContents.send('notification-nudge')
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
    title: 'Ramppy Assistant',
    icon: APP_ICON,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  bubbleWindow.loadFile('bubble.html')
  bubbleWindow.setMenuBarVisibility(false)

  // Force highest always-on-top level so it stays above all windows
  bubbleWindow.setAlwaysOnTop(true, 'screen-saver')

  // Re-apply always-on-top periodically (some Windows apps can steal it)
  setInterval(() => {
    if (bubbleWindow && !bubbleWindow.isDestroyed()) {
      bubbleWindow.setAlwaysOnTop(true, 'screen-saver')
    }
  }, 3000)

  // F12 for DevTools on bubble too
  bubbleWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12') {
      bubbleWindow.webContents.toggleDevTools()
    }
  })

  // Block OS-level window dragging entirely — all moves are handled via IPC setBounds/moveBubble
  bubbleWindow.on('will-move', (e) => {
    e.preventDefault()
  })

  // Forward console.log from bubble renderer to main process stdout (for debugging)
  bubbleWindow.webContents.on('console-message', (_event, _level, message) => {
    if (message.startsWith('[Bubble]') || message.startsWith('[Nicole]')) {
      console.log('[Bubble]', message)
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

  const isPanel = width > 200 // panel mode (≥280) vs bubble/bar mode

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

// Animate bubble to position (allows off-screen for snap-to-edge)
ipcMain.on('snap-bubble', (_event, x, y, duration, opts) => {
  if (!bubbleWindow) return
  animateBubbleTo(x, y, duration || 200, opts || {})
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

  // Ctrl+Shift+N → test Nicole notification (cycles through types)
  globalShortcut.register('CommandOrControl+Shift+N', () => {
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
    }
  })
})

app.on('before-quit', () => {
  app.isQuitting = true
})

app.on('window-all-closed', () => {
  globalShortcut.unregisterAll()
  if (authTokenInterval) clearInterval(authTokenInterval)
  if (process.platform !== 'darwin') app.quit()
})
