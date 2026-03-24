const { contextBridge, ipcRenderer } = require('electron/renderer')

contextBridge.exposeInMainWorld('electronAPI', {
  getSources: () => ipcRenderer.invoke('get-sources'),
  captureScreenshot: () => ipcRenderer.invoke('capture-screenshot'),
  resizeBubble: (w, h) => ipcRenderer.invoke('resize-bubble', w, h),
  moveBubble: (x, y) => ipcRenderer.send('move-bubble', x, y),
  startDrag: () => ipcRenderer.send('start-drag'),
  stopDrag: () => ipcRenderer.send('stop-drag'),
  setBubbleBounds: (x, y, w, h) => ipcRenderer.invoke('set-bubble-bounds', x, y, w, h),
  setBubbleOpacity: (opacity) => ipcRenderer.invoke('set-bubble-opacity', opacity),
  getBubblePos: () => ipcRenderer.invoke('get-bubble-pos'),
  snapBubble: (x, y, duration, opts) => ipcRenderer.send('snap-bubble', x, y, duration, opts),
  getScreenSize: () => ipcRenderer.invoke('get-screen-size'),
  executeDesktopAction: (action) => ipcRenderer.invoke('execute-desktop-action', action),
  searchComputer: (query) => ipcRenderer.invoke('search-computer', query),
  navigatePlatform: (viewPath) => ipcRenderer.invoke('navigate-platform', viewPath),
  onAuthToken: (callback) => ipcRenderer.on('auth-token', (_event, data) => callback(data)),
  openRecordingWindow: () => ipcRenderer.send('open-recording-window'),
  // Mouse event forwarding (transparent areas pass clicks to apps behind)
  setIgnoreMouse: (ignore) => ipcRenderer.send('set-ignore-mouse', ignore),
  // Edge snapping after drag
  snapToEdge: () => ipcRenderer.send('snap-to-edge'),
  // Global shortcut toggle (Cmd+Shift+Space)
  onToggleBubble: (callback) => ipcRenderer.on('toggle-bubble', () => callback()),
  // Meet auto-detection IPC
  onAutoStart: (callback) => ipcRenderer.on('auto-start-recording', (_event, meetingType) => callback(meetingType)),
  onAutoStop: (callback) => ipcRenderer.on('auto-stop-recording', (_event) => callback()),
  notifyRecordingFinished: () => ipcRenderer.send('recording-finished'),
  notifyRecordingError: (errorMsg) => ipcRenderer.send('recording-error', errorMsg),
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
  // Meeting start confirmation (main ↔ bubble)
  onAskMeetingStart: (callback) => ipcRenderer.on('ask-meeting-start', (_event, meetTitle) => callback(meetTitle)),
  confirmMeetingStart: (meetingType) => ipcRenderer.send('confirm-meeting-start', meetingType),
  dismissMeetingStart: () => ipcRenderer.send('dismiss-meeting-start'),
  onHideMeetingStart: (callback) => ipcRenderer.on('hide-meeting-start', () => callback()),
  // Meeting end confirmation (recorder ↔ main ↔ bubble)
  notifyMeetingMaybeEnded: () => ipcRenderer.send('meeting-maybe-ended'),
  onAskMeetingEnded: (callback) => ipcRenderer.on('ask-meeting-ended', () => callback()),
  confirmMeetingEnded: () => ipcRenderer.send('confirm-meeting-ended'),
  dismissMeetingEnded: () => ipcRenderer.send('dismiss-meeting-ended'),
  onResetMeetingDetection: (callback) => ipcRenderer.on('reset-meeting-detection', () => callback()),
  // Notification system
  onNotificationNudge: (callback) => ipcRenderer.on('notification-nudge', () => callback()),
  onTestNotification: (callback) => ipcRenderer.on('test-notification', () => callback()),
  // Notification toast (separate window — no bubble resize needed)
  showNotificationToast: (data) => ipcRenderer.invoke('show-notification-toast', data),
  hideNotificationToast: () => ipcRenderer.invoke('hide-notification-toast'),
  onNotificationClicked: (callback) => ipcRenderer.on('notification-clicked', () => callback()),
  onNotificationDismissed: (callback) => ipcRenderer.on('notification-dismissed', () => callback()),
  // Screen recording permission
  onScreenPermissionNeeded: (callback) => ipcRenderer.on('screen-permission-needed', () => callback()),
  openScreenPermissionSettings: () => ipcRenderer.send('open-screen-permission-settings'),
  // Audio diagnostic
  testAudio: () => ipcRenderer.invoke('test-audio-diagnostic'),
})
