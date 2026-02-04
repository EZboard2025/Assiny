import { Client, LocalAuth, Chat, Message } from 'whatsapp-web.js'
import QRCode from 'qrcode'
import fs from 'fs'
import path from 'path'

// Persist state across HMR reloads in dev mode using globalThis
type StatusCallback = (status: string, data?: any) => void

interface WhatsAppState {
  client: Client | null
  qrCodeData: string | null
  connectionStatus: 'disconnected' | 'qr' | 'connecting' | 'connected'
  lastError: string | null
  statusCallbacks: StatusCallback[]
}

const globalForWA = globalThis as unknown as { __whatsapp_state?: WhatsAppState }

if (!globalForWA.__whatsapp_state) {
  globalForWA.__whatsapp_state = {
    client: null,
    qrCodeData: null,
    connectionStatus: 'disconnected',
    lastError: null,
    statusCallbacks: []
  }
}

const state = globalForWA.__whatsapp_state

export function onStatusChange(callback: StatusCallback) {
  state.statusCallbacks.push(callback)
  return () => {
    state.statusCallbacks = state.statusCallbacks.filter((cb: StatusCallback) => cb !== callback)
  }
}

function notifyStatus(status: string, data?: any) {
  state.statusCallbacks.forEach((cb: StatusCallback) => cb(status, data))
}

export async function initWhatsAppClient(): Promise<{ success: boolean; qrCode?: string; error?: string }> {
  // Se já está conectado, retornar sucesso
  if (state.client && state.connectionStatus === 'connected') {
    return { success: true }
  }

  // Se está aguardando QR code, retornar o QR atual
  if (state.client && state.connectionStatus === 'qr' && state.qrCodeData) {
    return { success: true, qrCode: state.qrCodeData }
  }

  // Se já está inicializando, aguardar
  if (state.client && state.connectionStatus === 'connecting') {
    return { success: false, error: 'Cliente já está inicializando' }
  }

  try {
    state.connectionStatus = 'connecting'
    state.lastError = null

    // Destruir cliente anterior se existir
    if (state.client) {
      try {
        await state.client.destroy()
      } catch (e) {
        console.log('Erro ao destruir cliente anterior:', e)
      }
      state.client = null
    }

    // Remove stale browser lock files to prevent "browser already running" errors
    const sessionPath = path.resolve('./.wwebjs_auth/session')
    for (const lockFile of ['SingletonLock', 'SingletonSocket', 'SingletonCookie']) {
      const lockPath = path.join(sessionPath, lockFile)
      try {
        if (fs.existsSync(lockPath)) {
          fs.unlinkSync(lockPath)
          console.log(`Removed stale lock file: ${lockFile}`)
        }
      } catch (e) {
        // ignore
      }
    }

    // Criar novo cliente
    state.client = new Client({
      authStrategy: new LocalAuth({
        dataPath: './.wwebjs_auth'
      }),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      }
    })

    // Evento: QR Code gerado
    state.client.on('qr', async (qr: string) => {
      console.log('📱 QR Code recebido')
      state.connectionStatus = 'qr'

      // Gerar QR code como imagem base64
      state.qrCodeData = await QRCode.toDataURL(qr, {
        width: 256,
        margin: 2
      })

      notifyStatus('qr', { qrCode: state.qrCodeData })
    })

    // Evento: Autenticado
    state.client.on('authenticated', () => {
      console.log('✅ WhatsApp autenticado')
      state.connectionStatus = 'connecting'
      state.qrCodeData = null
      notifyStatus('authenticated')
    })

    // Evento: Pronto
    state.client.on('ready', () => {
      console.log('✅ WhatsApp pronto')
      state.connectionStatus = 'connected'
      state.qrCodeData = null
      notifyStatus('ready')
    })

    // Evento: Desconectado
    state.client.on('disconnected', (reason: string) => {
      console.log('❌ WhatsApp desconectado:', reason)
      state.connectionStatus = 'disconnected'
      state.lastError = reason
      state.client = null
      notifyStatus('disconnected', { reason })
    })

    // Evento: Falha na autenticação
    state.client.on('auth_failure', (msg: string) => {
      console.log('❌ Falha na autenticação:', msg)
      state.connectionStatus = 'disconnected'
      state.lastError = msg
      notifyStatus('auth_failure', { message: msg })
    })

    // Inicializar cliente
    await state.client.initialize()

    // Aguardar um pouco para o QR code ser gerado
    await new Promise(resolve => setTimeout(resolve, 2000))

    if (state.qrCodeData) {
      return { success: true, qrCode: state.qrCodeData }
    }

    // Status may have changed to 'connected' via the 'ready' event during initialize()
    const currentStatus = state.connectionStatus as string
    if (currentStatus === 'connected') {
      return { success: true }
    }

    return { success: true }

  } catch (error: any) {
    console.error('❌ Erro ao inicializar WhatsApp:', error)
    state.connectionStatus = 'disconnected'
    state.lastError = error.message
    return { success: false, error: error.message }
  }
}

export function getConnectionStatus() {
  return {
    status: state.connectionStatus,
    qrCode: state.qrCodeData,
    error: state.lastError
  }
}

export async function disconnectWhatsApp(): Promise<void> {
  if (state.client) {
    try {
      await state.client.logout()
      await state.client.destroy()
    } catch (e) {
      console.log('Erro ao desconectar:', e)
    }
    state.client = null
    state.connectionStatus = 'disconnected'
    state.qrCodeData = null
  }
}

export async function getChats(): Promise<any[]> {
  if (!state.client || state.connectionStatus !== 'connected') {
    throw new Error('WhatsApp não está conectado')
  }

  const chats = await state.client.getChats()

  // Filtrar apenas conversas individuais (não grupos) e com mensagens
  const individualChats = chats.filter((chat: any) => !chat.isGroup && chat.lastMessage)

  // Mapear para formato simplificado
  return individualChats.slice(0, 50).map((chat: any) => ({
    id: chat.id._serialized,
    name: chat.name,
    lastMessage: chat.lastMessage?.body?.substring(0, 100) || '',
    lastMessageTime: chat.lastMessage?.timestamp ? new Date(chat.lastMessage.timestamp * 1000).toISOString() : null,
    unreadCount: chat.unreadCount || 0
  }))
}

export async function getChatMessages(chatId: string, limit: number = 50): Promise<any[]> {
  if (!state.client || state.connectionStatus !== 'connected') {
    throw new Error('WhatsApp não está conectado')
  }

  const chat = await state.client.getChatById(chatId)
  const messages = await chat.fetchMessages({ limit })

  return messages.map((msg: any) => ({
    id: msg.id._serialized,
    body: msg.body,
    fromMe: msg.fromMe,
    timestamp: new Date(msg.timestamp * 1000).toISOString(),
    type: msg.type,
    hasMedia: msg.hasMedia
  }))
}

export async function sendMessage(chatId: string, message: string): Promise<any> {
  if (!state.client || state.connectionStatus !== 'connected') {
    throw new Error('WhatsApp não está conectado')
  }

  const chat = await state.client.getChatById(chatId)
  const sentMsg = await chat.sendMessage(message)

  return {
    id: sentMsg.id._serialized,
    body: sentMsg.body,
    fromMe: true,
    timestamp: new Date(sentMsg.timestamp * 1000).toISOString(),
    type: sentMsg.type,
    hasMedia: false
  }
}

export async function formatChatForAnalysis(chatId: string, sellerName: string = 'Vendedor'): Promise<string> {
  const messages = await getChatMessages(chatId, 100)
  const chat = await state.client!.getChatById(chatId)
  const contactName = chat.name || 'Cliente'

  const lines = messages.map((msg: any) => {
    const sender = msg.fromMe ? sellerName : contactName
    const time = new Date(msg.timestamp).toLocaleString('pt-BR')
    const content = msg.body || `[${msg.type}]`
    return `[${time}] ${sender}: ${content}`
  })

  return lines.join('\n')
}
