const { contextBridge, ipcRenderer } = require('electron/renderer')

contextBridge.exposeInMainWorld('electronAPI', {
  getSources: () => ipcRenderer.invoke('get-sources'),
  captureScreenshot: () => ipcRenderer.invoke('capture-screenshot'),
  resizeBubble: (w, h) => ipcRenderer.invoke('resize-bubble', w, h),
  moveBubble: (x, y) => ipcRenderer.send('move-bubble', x, y),
  setBubbleBounds: (x, y, w, h) => ipcRenderer.invoke('set-bubble-bounds', x, y, w, h),
  setBubbleOpacity: (opacity) => ipcRenderer.invoke('set-bubble-opacity', opacity),
  getBubblePos: () => ipcRenderer.invoke('get-bubble-pos'),
  snapBubble: (x, y, duration, opts) => ipcRenderer.send('snap-bubble', x, y, duration, opts),
  getScreenSize: () => ipcRenderer.invoke('get-screen-size'),
  executeDesktopAction: (action) => ipcRenderer.invoke('execute-desktop-action', action),
  searchComputer: (query) => ipcRenderer.invoke('search-computer', query),
  navigatePlatform: (viewPath) => ipcRenderer.invoke('navigate-platform', viewPath),
  onAuthToken: (callback) => ipcRenderer.on('auth-token', (_event, data) => callback(data)),
  onNotificationNudge: (callback) => ipcRenderer.on('notification-nudge', () => callback()),
  onTestNotification: (callback) => ipcRenderer.on('test-notification', () => callback()),
  // Notification toast (separate window — no bubble resize needed)
  showNotificationToast: (data) => ipcRenderer.invoke('show-notification-toast', data),
  hideNotificationToast: () => ipcRenderer.invoke('hide-notification-toast'),
  onNotificationClicked: (callback) => ipcRenderer.on('notification-clicked', () => callback()),
  onNotificationDismissed: (callback) => ipcRenderer.on('notification-dismissed', () => callback()),
})
