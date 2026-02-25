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
})
