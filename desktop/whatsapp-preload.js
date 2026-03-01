const { contextBridge, ipcRenderer } = require('electron/renderer')

contextBridge.exposeInMainWorld('ramppy', {
  // Send scraped WhatsApp context to main process
  sendContext: (data) => ipcRenderer.send('whatsapp-context-update', data),
  // Send sidebar conversation list for full sync
  sendConversationList: (data) => ipcRenderer.send('whatsapp-conversation-list', data),
  // Receive text to inject into WhatsApp input
  onInjectText: (callback) => ipcRenderer.on('inject-whatsapp-text', (_event, text) => callback(text)),
})
