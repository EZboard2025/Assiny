const { contextBridge, ipcRenderer } = require('electron/renderer')

contextBridge.exposeInMainWorld('ramppy', {
  // Send scraped WhatsApp context to main process
  sendContext: (data) => ipcRenderer.send('whatsapp-context-update', data),
  // Send sidebar conversation list for full sync
  sendConversationList: (data) => ipcRenderer.send('whatsapp-conversation-list', data),
  // Receive text to inject into WhatsApp input
  onInjectText: (callback) => ipcRenderer.on('inject-whatsapp-text', (_event, text) => callback(text)),
  // Report auto-scan progress to main process
  sendAutoScanProgress: (progress) => ipcRenderer.send('auto-scan-progress', progress),
  // Report new messages detected in real time
  sendNewMessages: (data) => ipcRenderer.send('whatsapp-new-messages', data),
  // Report command execution result to main process
  sendCommandResult: (result) => ipcRenderer.send('desktop-command-result', result),
})
