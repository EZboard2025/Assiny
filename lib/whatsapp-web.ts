import { Client, LocalAuth, Chat, Message } from 'whatsapp-web.js'
import QRCode from 'qrcode'

// Singleton para o cliente WhatsApp
let client: Client | null = null
let qrCodeData: string | null = null
let connectionStatus: 'disconnected' | 'qr' | 'connecting' | 'connected' = 'disconnected'
let lastError: string | null = null

// Callbacks para eventos
type StatusCallback = (status: string, data?: any) => void
let statusCallbacks: StatusCallback[] = []

export function onStatusChange(callback: StatusCallback) {
  statusCallbacks.push(callback)
  return () => {
    statusCallbacks = statusCallbacks.filter(cb => cb !== callback)
  }
}

function notifyStatus(status: string, data?: any) {
  statusCallbacks.forEach(cb => cb(status, data))
}

export async function initWhatsAppClient(): Promise<{ success: boolean; qrCode?: string; error?: string }> {
  // Se já está conectado, retornar sucesso
  if (client && connectionStatus === 'connected') {
    return { success: true }
  }

  // Se está aguardando QR code, retornar o QR atual
  if (client && connectionStatus === 'qr' && qrCodeData) {
    return { success: true, qrCode: qrCodeData }
  }

  // Se já está inicializando, aguardar
  if (client && connectionStatus === 'connecting') {
    return { success: false, error: 'Cliente já está inicializando' }
  }

  try {
    connectionStatus = 'connecting'
    lastError = null

    // Destruir cliente anterior se existir
    if (client) {
      try {
        await client.destroy()
      } catch (e) {
        console.log('Erro ao destruir cliente anterior:', e)
      }
    }

    // Criar novo cliente
    client = new Client({
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
    client.on('qr', async (qr) => {
      console.log('📱 QR Code recebido')
      connectionStatus = 'qr'

      // Gerar QR code como imagem base64
      qrCodeData = await QRCode.toDataURL(qr, {
        width: 256,
        margin: 2
      })

      notifyStatus('qr', { qrCode: qrCodeData })
    })

    // Evento: Autenticado
    client.on('authenticated', () => {
      console.log('✅ WhatsApp autenticado')
      connectionStatus = 'connecting'
      qrCodeData = null
      notifyStatus('authenticated')
    })

    // Evento: Pronto
    client.on('ready', () => {
      console.log('✅ WhatsApp pronto')
      connectionStatus = 'connected'
      qrCodeData = null
      notifyStatus('ready')
    })

    // Evento: Desconectado
    client.on('disconnected', (reason) => {
      console.log('❌ WhatsApp desconectado:', reason)
      connectionStatus = 'disconnected'
      lastError = reason
      client = null
      notifyStatus('disconnected', { reason })
    })

    // Evento: Falha na autenticação
    client.on('auth_failure', (msg) => {
      console.log('❌ Falha na autenticação:', msg)
      connectionStatus = 'disconnected'
      lastError = msg
      notifyStatus('auth_failure', { message: msg })
    })

    // Inicializar cliente
    await client.initialize()

    // Aguardar um pouco para o QR code ser gerado
    await new Promise(resolve => setTimeout(resolve, 2000))

    if (qrCodeData) {
      return { success: true, qrCode: qrCodeData }
    }

    if (connectionStatus === 'connected') {
      return { success: true }
    }

    return { success: true }

  } catch (error: any) {
    console.error('❌ Erro ao inicializar WhatsApp:', error)
    connectionStatus = 'disconnected'
    lastError = error.message
    return { success: false, error: error.message }
  }
}

export function getConnectionStatus() {
  return {
    status: connectionStatus,
    qrCode: qrCodeData,
    error: lastError
  }
}

export async function disconnectWhatsApp(): Promise<void> {
  if (client) {
    try {
      await client.logout()
      await client.destroy()
    } catch (e) {
      console.log('Erro ao desconectar:', e)
    }
    client = null
    connectionStatus = 'disconnected'
    qrCodeData = null
  }
}

export async function getChats(): Promise<any[]> {
  if (!client || connectionStatus !== 'connected') {
    throw new Error('WhatsApp não está conectado')
  }

  const chats = await client.getChats()

  // Filtrar apenas conversas individuais (não grupos) e com mensagens
  const individualChats = chats.filter(chat => !chat.isGroup && chat.lastMessage)

  // Mapear para formato simplificado
  return individualChats.slice(0, 50).map(chat => ({
    id: chat.id._serialized,
    name: chat.name,
    lastMessage: chat.lastMessage?.body?.substring(0, 100) || '',
    lastMessageTime: chat.lastMessage?.timestamp ? new Date(chat.lastMessage.timestamp * 1000).toISOString() : null,
    unreadCount: chat.unreadCount || 0
  }))
}

export async function getChatMessages(chatId: string, limit: number = 50): Promise<any[]> {
  if (!client || connectionStatus !== 'connected') {
    throw new Error('WhatsApp não está conectado')
  }

  const chat = await client.getChatById(chatId)
  const messages = await chat.fetchMessages({ limit })

  return messages.map(msg => ({
    id: msg.id._serialized,
    body: msg.body,
    fromMe: msg.fromMe,
    timestamp: new Date(msg.timestamp * 1000).toISOString(),
    type: msg.type,
    hasMedia: msg.hasMedia
  }))
}

export async function formatChatForAnalysis(chatId: string, sellerName: string = 'Vendedor'): Promise<string> {
  const messages = await getChatMessages(chatId, 100)
  const chat = await client!.getChatById(chatId)
  const contactName = chat.name || 'Cliente'

  const lines = messages.map(msg => {
    const sender = msg.fromMe ? sellerName : contactName
    const time = new Date(msg.timestamp).toLocaleString('pt-BR')
    const content = msg.body || `[${msg.type}]`
    return `[${time}] ${sender}: ${content}`
  })

  return lines.join('\n')
}
