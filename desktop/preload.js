const { contextBridge, ipcRenderer } = require('electron/renderer')

contextBridge.exposeInMainWorld('electronAPI', {
  getSources: () => ipcRenderer.invoke('get-sources'),
  captureScreenshot: () => ipcRenderer.invoke('capture-screenshot'),
  resizeBubble: (w, h) => ipcRenderer.invoke('resize-bubble', w, h),
  moveBubble: (x, y) => ipcRenderer.send('move-bubble', x, y),
  setBubbleBounds: (x, y, w, h) => ipcRenderer.send('set-bubble-bounds', x, y, w, h),
  getBubblePos: () => ipcRenderer.invoke('get-bubble-pos'),
  onAuthToken: (callback) => ipcRenderer.on('auth-token', (_event, data) => callback(data)),
})
