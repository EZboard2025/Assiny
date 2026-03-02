const { contextBridge, ipcRenderer } = require('electron/renderer')

contextBridge.exposeInMainWorld('electronAPI', {
  getSources: () => ipcRenderer.invoke('get-sources'),
  captureScreenshot: () => ipcRenderer.invoke('capture-screenshot'),
  resizeBubble: (w, h) => ipcRenderer.invoke('resize-bubble', w, h),
  moveBubble: (x, y) => ipcRenderer.send('move-bubble', x, y),
  setBubbleBounds: (x, y, w, h) => ipcRenderer.send('set-bubble-bounds', x, y, w, h),
  getBubblePos: () => ipcRenderer.invoke('get-bubble-pos'),
  onAuthToken: (callback) => ipcRenderer.on('auth-token', (_event, data) => callback(data)),
  openRecordingWindow: () => ipcRenderer.send('open-recording-window'),
  // Mouse event forwarding (transparent areas pass clicks to apps behind)
  setIgnoreMouse: (ignore) => ipcRenderer.send('set-ignore-mouse', ignore),
  // Edge snapping after drag
  snapToEdge: () => ipcRenderer.send('snap-to-edge'),
  // Global shortcut toggle (Cmd+Shift+R)
  onToggleBubble: (callback) => ipcRenderer.on('toggle-bubble', () => callback()),
  // Meet auto-detection IPC
  onAutoStart: (callback) => ipcRenderer.on('auto-start-recording', (_event) => callback()),
  onAutoStop: (callback) => ipcRenderer.on('auto-stop-recording', (_event) => callback()),
  notifyRecordingFinished: () => ipcRenderer.send('recording-finished'),
  // Recording state (bubble indicator)
  onRecordingState: (callback) => ipcRenderer.on('recording-state', (_event, isRecording) => callback(isRecording)),
  // WhatsApp copilot IPC
  onWhatsAppState: (callback) => ipcRenderer.on('whatsapp-state', (_event, data) => callback(data)),
  getWhatsAppState: () => ipcRenderer.invoke('get-whatsapp-state'),
  injectWhatsAppText: (text) => ipcRenderer.send('inject-whatsapp-text', text),
  openWhatsApp: () => ipcRenderer.send('open-whatsapp'),
  // Copilot toggle (minimize/expand)
  toggleCopilot: () => ipcRenderer.send('toggle-copilot'),
  onCopilotToggled: (callback) => ipcRenderer.on('copilot-toggled', (_event, isOpen) => callback(isOpen)),
  // Platform URL (dev vs prod)
  getPlatformUrl: () => ipcRenderer.invoke('get-platform-url'),
  // BlackHole audio driver (seamless system audio capture)
  checkBlackHole: () => ipcRenderer.invoke('check-blackhole'),
  setupAudioRouting: () => ipcRenderer.invoke('setup-audio-routing'),
  teardownAudioRouting: () => ipcRenderer.invoke('teardown-audio-routing'),
  // Meeting end confirmation (recorder ↔ main ↔ bubble)
  notifyMeetingMaybeEnded: () => ipcRenderer.send('meeting-maybe-ended'),
  onAskMeetingEnded: (callback) => ipcRenderer.on('ask-meeting-ended', () => callback()),
  confirmMeetingEnded: () => ipcRenderer.send('confirm-meeting-ended'),
  dismissMeetingEnded: () => ipcRenderer.send('dismiss-meeting-ended'),
  onResetMeetingDetection: (callback) => ipcRenderer.on('reset-meeting-detection', () => callback()),
})
