const { contextBridge, ipcRenderer } = require('electron/renderer')

contextBridge.exposeInMainWorld('notifAPI', {
  onData: (callback) => ipcRenderer.on('set-notification-data', (_event, data) => callback(data)),
  click: () => ipcRenderer.send('notification-toast-click'),
  dismiss: () => ipcRenderer.send('notification-toast-dismiss'),
})
