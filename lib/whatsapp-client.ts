// WhatsApp Web.js Client Manager (Singleton)
// Each user gets their own WhatsApp client instance
// Messages are saved to Supabase via event handlers

import { Client, LocalAuth, Message } from 'whatsapp-web.js'
import { createClient } from '@supabase/supabase-js'
import QRCode from 'qrcode'
import OpenAI, { toFile } from 'openai'
import { existsSync, unlinkSync } from 'fs'
import { join } from 'path'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' })

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface ClientState {
  client: Client
  userId: string
  companyId: string | null
  connectionId: string | null
  qrCode: string | null
  status: 'initializing' | 'qr_ready' | 'connecting' | 'connected' | 'disconnected' | 'error'
  syncStatus: 'pending' | 'syncing' | 'synced' | 'error'
  error: string | null
  phoneNumber: string | null
  lastHeartbeat: number
  destroyed: boolean  // Flag to abort running sync when client is destroyed
  healthFailures: number  // Consecutive browser health check failures
}

// Persist singletons across Next.js HMR (dev mode)
// Without this, every file edit clears the Map and kills all WhatsApp connections
const globalForWA = globalThis as unknown as {
  waClients?: Map<string, ClientState>
  waInitializing?: Set<string>
  waLastInit?: Map<string, number>
  waReadyTimeouts?: Map<string, number>
  waContactCache?: Map<string, string>
  waReaperStarted?: boolean
}

const clients = globalForWA.waClients ?? (globalForWA.waClients = new Map<string, ClientState>())
const initializingUsers = globalForWA.waInitializing ?? (globalForWA.waInitializing = new Set<string>())
const lastInitAttempt = globalForWA.waLastInit ?? (globalForWA.waLastInit = new Map<string, number>())
const readyTimeoutCount = globalForWA.waReadyTimeouts ?? (globalForWA.waReadyTimeouts = new Map<string, number>())
const contactPhoneCache = globalForWA.waContactCache ?? (globalForWA.waContactCache = new Map<string, string>())

const INIT_COOLDOWN_MS = 15_000 // Wait 15s between init attempts after failure

function getAuthPath(): string {
  return process.env.WWEBJS_AUTH_PATH || '.wwebjs_auth'
}

// Clean up stale Chromium state left by abrupt process shutdown (PM2 restart)
// This prevents "authenticated but never ready" by removing:
// - SingletonLock (prevents new Chrome from opening profile)
// - Service Worker cache (can intercept requests and cause stuck loading)
// - Disk cache (stale assets)
async function cleanupBrowserState(sessionId: string): Promise<void> {
  try {
    const fs = await import('fs')
    const path = await import('path')
    const sessionDir = path.join(getAuthPath(), `session-${sessionId}`)

    if (!fs.existsSync(sessionDir)) return

    // Remove SingletonLock — left behind after ungraceful Chrome shutdown
    const singletonLock = path.join(sessionDir, 'SingletonLock')
    if (fs.existsSync(singletonLock)) {
      fs.rmSync(singletonLock, { force: true })
      console.log(`[WA] Removed stale SingletonLock for ${sessionId}`)
    }

    // Remove browser cache dirs that cause stuck loading (keep auth session data intact)
    const defaultDir = path.join(sessionDir, 'Default')
    if (fs.existsSync(defaultDir)) {
      const cacheDirs = ['Service Worker', 'Cache', 'Code Cache', 'GPUCache']
      for (const dir of cacheDirs) {
        const cachePath = path.join(defaultDir, dir)
        if (fs.existsSync(cachePath)) {
          fs.rmSync(cachePath, { recursive: true, force: true })
        }
      }
      console.log(`[WA] Cleared browser cache for ${sessionId}`)
    }
  } catch (err) {
    console.error(`[WA] Error cleaning browser state:`, err)
  }
}

const NOTIFICATION_TYPES = new Set([
  'e2e_notification', 'notification', 'notification_template',
  'gp2', 'call_log', 'protocol', 'ciphertext', 'revoked',
  'groups_v4_invite', 'broadcast_notification', 'group_notification', 'pin_in_chat'
])

function isNotificationMessage(msg: Message): boolean {
  if ((msg as any)._data?.isNotification) return true
  if (NOTIFICATION_TYPES.has(msg.type as string)) return true
  return false
}

export function getClientState(userId: string): ClientState | null {
  return clients.get(userId) || null
}

// Clean up orphaned Puppeteer lock files for a session directory
// This prevents "browser is already running" errors after server restarts/HMR
// NOTE: Only removes lock FILES. Does NOT kill Chrome processes (could kill active session).
function cleanupBrowserLockFiles(sessionId: string): void {
  const sessionDir = join(process.cwd(), getAuthPath(), `session-${sessionId}`)
  const lockFiles = ['SingletonLock', 'SingletonCookie', 'SingletonSocket', 'DevToolsActivePort']

  for (const lockFile of lockFiles) {
    const filePath = join(sessionDir, lockFile)
    try {
      if (existsSync(filePath)) {
        unlinkSync(filePath)
        console.log(`[WA] Cleaned up lock file: ${lockFile}`)
      }
    } catch (err) {
      console.warn(`[WA] Failed to remove ${lockFile}:`, err)
    }
  }
}

export async function initializeClient(userId: string, companyId: string | null): Promise<{ qrCode: string | null; status: string }> {
  // Kill any orphan Chromium processes left by previous PM2 crash
  // Only kills processes not owned by any active client in our map
  if (clients.size === 0) {
    try {
      const { execSync } = await import('child_process')
      const result = execSync('pgrep -f "chromium.*--no-sandbox" || true', { encoding: 'utf8' }).trim()
      if (result) {
        console.log(`[WA] Killing orphan Chromium processes: ${result.split('\n').length} found`)
        execSync('pkill -f "chromium.*--no-sandbox" || true')
        await new Promise(resolve => setTimeout(resolve, 1000)) // Let processes die
      }
    } catch {}
  }

  // If client already exists and is connected, return status
  const existing = clients.get(userId)
  if (existing) {
    if (existing.status === 'connected') {
      return { qrCode: null, status: 'connected' }
    }
    if (existing.status === 'qr_ready' || existing.status === 'initializing' || existing.status === 'connecting') {
      return { qrCode: existing.qrCode, status: existing.status }
    }
    // If disconnected or error, destroy and recreate
    try {
      await existing.client.destroy()
    } catch {}
    clients.delete(userId)
  }

  // Prevent concurrent initialization for the same user
  if (initializingUsers.has(userId)) {
    // Safety: if lock exists but no client in Map, the init got stuck (e.g. Chrome killed during HMR)
    const existingState = clients.get(userId)
    if (!existingState || existingState.status === 'error' || existingState.destroyed) {
      console.warn(`[WA] Stale init lock detected for user ${userId}, clearing and re-initializing`)
      initializingUsers.delete(userId)
      lastInitAttempt.delete(userId)
      if (existingState) {
        try { await existingState.client.destroy() } catch {}
        clients.delete(userId)
      }
    } else {
      console.log(`[WA] Already initializing for user ${userId}, waiting...`)
      await new Promise(resolve => setTimeout(resolve, 1000))
      const state = clients.get(userId)
      if (state) {
        return { qrCode: state.qrCode, status: state.status }
      }
      return { qrCode: null, status: 'initializing' }
    }
  }

  // Backoff: prevent rapid re-init loops (init → timeout → destroy → init)
  const lastAttempt = lastInitAttempt.get(userId)
  if (lastAttempt && Date.now() - lastAttempt < INIT_COOLDOWN_MS) {
    const waitSec = Math.ceil((INIT_COOLDOWN_MS - (Date.now() - lastAttempt)) / 1000)
    console.log(`[WA] Init cooldown active for user ${userId}, ${waitSec}s remaining`)
    return { qrCode: null, status: 'initializing' }
  }
  lastInitAttempt.set(userId, Date.now())

  // Mark user as initializing
  initializingUsers.add(userId)
  console.log(`[WA] Starting initialization for user ${userId}`)

  const sessionId = `user_${userId.replace(/-/g, '').substring(0, 16)}`

  // Clean stale browser state left by PM2 restart / ungraceful shutdown
  await cleanupBrowserState(sessionId)

  // Clean up any orphaned browser lock files from previous server restarts
  cleanupBrowserLockFiles(sessionId)

  const client = new Client({
    authStrategy: new LocalAuth({
      clientId: sessionId,
      dataPath: getAuthPath()
    }),
    webVersionCache: {
      type: 'none' // Always load latest WhatsApp Web version (prevents stale version issues)
    },
    puppeteer: {
      headless: true,
      protocolTimeout: 180000, // 180s timeout for slow operations (getChats can be slow under memory pressure)
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--disable-gpu',
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-default-apps',
        '--disable-sync',
        '--disable-translate',
        '--mute-audio',
        '--hide-scrollbars',
        // Memory optimization for multi-user support
        '--js-flags=--max-old-space-size=384',
        '--disable-software-rasterizer',
        '--disable-logging',
        '--disable-breakpad',
        '--disable-component-update',
        '--disable-domain-reliability',
        '--disable-features=AudioServiceOutOfProcess',
        '--renderer-process-limit=1',
        '--disable-hang-monitor',
        '--disable-ipc-flooding-protection',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows'
      ]
    }
  })

  const state: ClientState = {
    client,
    userId,
    companyId,
    connectionId: null,
    qrCode: null,
    status: 'initializing',
    syncStatus: 'pending',
    error: null,
    phoneNumber: null,
    lastHeartbeat: Date.now(),
    destroyed: false,
    healthFailures: 0
  }

  clients.set(userId, state)

  // Auth/ready guards — declared before all event handlers so qr handler can reset them
  let readyTimeout: NodeJS.Timeout | null = null
  let authFired = false
  let readyFired = false

  // QR Code event
  // CRITICAL: QR can fire on an already-connected client when the session expires
  // (e.g. logged out from phone, multi-device limit, server-side invalidation).
  // We MUST reset auth/ready guards so the re-authentication flow works correctly.
  client.on('qr', async (qr: string) => {
    console.log(`[WA] QR code generated for user ${userId}${authFired ? ' (re-auth needed, resetting guards)' : ''}`)

    // Reset guards so authenticated handler will work again
    if (authFired) {
      authFired = false
      readyFired = false
      if (readyTimeout) { clearTimeout(readyTimeout); readyTimeout = null }
    }

    try {
      state.qrCode = await QRCode.toDataURL(qr, { width: 256, margin: 2 })
    } catch {
      state.qrCode = qr
    }
    state.status = 'qr_ready'
  })

  // Authentication event - start a timeout for ready (only once, ignore duplicate fires)
  client.on('authenticated', () => {
    console.log(`[WA] Authenticated for user ${userId}${authFired ? ' (duplicate, ignoring)' : ''}`)
    state.status = 'connecting'

    // Only set timeout on first authenticated event — duplicates should not reset the timer
    if (authFired) return
    authFired = true

    // If ready doesn't fire within 45s, the client is stuck
    // (when it works, ready fires in 2-5s after authenticated)
    readyTimeout = setTimeout(async () => {
      if (state.status === 'connecting') {
        const timeouts = (readyTimeoutCount.get(userId) || 0) + 1
        readyTimeoutCount.set(userId, timeouts)
        console.error(`[WA] Ready timeout (45s) for user ${userId} - attempt #${timeouts}`)

        state.destroyed = true
        initializingUsers.delete(userId)
        lastInitAttempt.delete(userId)
        try { await client.destroy() } catch {}
        clients.delete(userId)

        if (timeouts < 2) {
          // Auto-retry: clear full session cache to force fresh QR
          // If browser cache cleanup wasn't enough, the session itself is corrupted
          console.log(`[WA] Auto-retrying with full session reset for user ${userId}`)
          try {
            const fs = await import('fs')
            const path = await import('path')
            const sessionPath = path.join(getAuthPath(), `session-${sessionId}`)
            if (fs.existsSync(sessionPath)) {
              fs.rmSync(sessionPath, { recursive: true, force: true })
              console.log(`[WA] Cleared full session cache for fresh QR`)
            }
          } catch (e) {
            console.error(`[WA] Error clearing session:`, e)
          }
          try {
            await initializeClient(userId, companyId)
          } catch (retryErr) {
            console.error(`[WA] Auto-retry failed for user ${userId}:`, retryErr)
          }
        } else {
          // Already retried with fresh QR — give up and show error
          console.error(`[WA] Giving up after ${timeouts} timeouts for user ${userId}`)
          readyTimeoutCount.delete(userId)
          // Briefly insert error state so frontend polling can detect it
          const errorState: ClientState = {
            client, userId, companyId, connectionId: null,
            qrCode: null, status: 'error', syncStatus: 'pending',
            error: 'Conexão travou. Tente novamente.', phoneNumber: null,
            lastHeartbeat: 0, destroyed: true, healthFailures: 0
          }
          clients.set(userId, errorState)
          setTimeout(() => {
            const current = clients.get(userId)
            if (current === errorState) clients.delete(userId)
          }, 5000)
        }
      }
    }, 45000)
  })

  // Ready event (fully connected) - guard against duplicate fires
  client.on('ready', async () => {
    if (readyFired || state.destroyed) return
    readyFired = true
    console.log(`[WA] Ready for user ${userId}`)
    if (readyTimeout) { clearTimeout(readyTimeout); readyTimeout = null }
    state.status = 'connected'
    state.qrCode = null
    state.lastHeartbeat = Date.now()
    initializingUsers.delete(userId)
    lastInitAttempt.delete(userId) // Clear backoff on successful connection
    readyTimeoutCount.delete(userId) // Clear timeout counter on success

    const info = client.info
    state.phoneNumber = info?.wid?.user || null

    await upsertConnection(state)

    // Brief wait for Chrome to settle before syncing
    console.log(`[WA] Waiting 3s before sync for user ${userId}...`)
    await new Promise(resolve => setTimeout(resolve, 3000))

    if (state.destroyed) return  // Check again after delay

    // Sync in background (don't block)
    state.syncStatus = 'syncing'
    syncChatHistory(state).then(() => {
      if (!state.destroyed) state.syncStatus = 'synced'
    }).catch(err => {
      console.error('[WA] Sync error:', err)
      if (!state.destroyed) state.syncStatus = 'error'
    })
  })

  // Message received
  client.on('message', async (msg: Message) => {
    // Early filter: skip all notification/system messages at event level
    if (isNotificationMessage(msg)) return
    console.log(`[WA] Message received from ${msg.from}, status=${state.status}, connectionId=${state.connectionId}`)
    if (state.status !== 'connected' || !state.connectionId) {
      console.log(`[WA] Skipping message - not ready`)
      return
    }
    handleIncomingMessage(state, msg, false)
  })

  // Message sent by us
  client.on('message_create', async (msg: Message) => {
    if (!msg.fromMe) return
    if (isNotificationMessage(msg)) return
    console.log(`[WA] Message sent to ${msg.to}, status=${state.status}, connectionId=${state.connectionId}`)
    if (state.status !== 'connected' || !state.connectionId) {
      console.log(`[WA] Skipping outbound message - not ready`)
      return
    }
    handleIncomingMessage(state, msg, true)
  })

  // Disconnected - fully destroy client to prevent stale Puppeteer state
  client.on('disconnected', async (reason: string) => {
    console.log(`[WA] Disconnected for user ${userId}: ${reason}. Destroying client.`)
    state.destroyed = true  // Signal running sync to abort
    initializingUsers.delete(userId)

    if (state.connectionId) {
      await supabaseAdmin
        .from('whatsapp_connections')
        .update({ status: 'disconnected' })
        .eq('id', state.connectionId)
    }

    // Destroy the Puppeteer instance to prevent broken context issues
    try { await client.destroy() } catch {}
    clients.delete(userId)
    console.log(`[WA] Client destroyed and removed for user ${userId}`)
  })

  // Auth failure - session is truly corrupted, clear cache so next attempt gets fresh QR
  client.on('auth_failure', async (msg: string) => {
    console.error(`[WA] Auth failure for user ${userId}: ${msg}`)
    state.status = 'error'
    state.error = msg
    initializingUsers.delete(userId)
    lastInitAttempt.delete(userId)

    // Delete cached session — auth_failure means it's truly corrupted
    try {
      const sessionPath = `${getAuthPath()}/session-user_${userId.replace(/-/g, '').substring(0, 16)}`
      const fs = await import('fs')
      if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true, force: true })
        console.log(`[WA] Cleared corrupted session cache for user ${userId} (auth_failure)`)
      }
    } catch (e) {
      console.error(`[WA] Error clearing session cache:`, e)
    }
  })

  // Initialize the client
  client.initialize().catch((err: Error) => {
    console.error(`[WA] Failed to initialize for user ${userId}:`, err)
    state.status = 'error'
    state.error = err.message
    initializingUsers.delete(userId)
  })

  await new Promise(resolve => setTimeout(resolve, 3000))
  return { qrCode: state.qrCode, status: state.status }
}

export async function disconnectClient(userId: string): Promise<void> {
  const state = clients.get(userId)
  initializingUsers.delete(userId)
  if (!state) return

  // Signal running sync to abort immediately
  state.destroyed = true

  // Remove from map immediately so UI sees disconnected state
  clients.delete(userId)

  // Mark connection as disconnected (NOT delete — preserves messages and FK integrity)
  if (state.connectionId) {
    await supabaseAdmin
      .from('whatsapp_connections')
      .update({ status: 'disconnected' })
      .eq('id', state.connectionId)
  }

  // Cleanup Puppeteer with timeout (logout/destroy can hang on bad browser state)
  const cleanup = async () => {
    try { await state.client.logout() } catch {}
    try { await state.client.destroy() } catch {}
  }
  const timeout = new Promise<void>(resolve => setTimeout(resolve, 10000))
  await Promise.race([cleanup(), timeout])
  console.log(`[WA] Disconnect complete for user ${userId}`)
}

// Soft reap: destroy Puppeteer but preserve session for auto-reconnection
// Used by TTL reaper when browser tab goes inactive — user can come back without re-scanning QR
async function reapClient(userId: string): Promise<void> {
  const state = clients.get(userId)
  if (!state) return

  state.destroyed = true
  clients.delete(userId)
  initializingUsers.delete(userId)

  // Mark connection as disconnected (preserve messages)
  if (state.connectionId) {
    await supabaseAdmin
      .from('whatsapp_connections')
      .update({ status: 'disconnected' })
      .eq('id', state.connectionId)
  }

  // Destroy Puppeteer but do NOT logout — LocalAuth session stays on disk
  try { await state.client.destroy() } catch {}
  console.log(`[WA TTL] Client reaped for user ${userId} (session preserved for reconnection)`)
}

export function getConnectedClient(userId: string): Client | null {
  const state = clients.get(userId)
  if (!state) {
    console.error(`[WA] getConnectedClient: No client in Map for user ${userId}. Map has ${clients.size} entries: [${Array.from(clients.keys()).join(', ')}]`)
    return null
  }
  if (state.status !== 'connected') {
    console.error(`[WA] getConnectedClient: Client exists but status='${state.status}' for user ${userId}`)
    return null
  }
  return state.client
}

export function updateHeartbeat(userId: string): boolean {
  const state = clients.get(userId)
  if (!state) return false
  state.lastHeartbeat = Date.now()

  // Periodic Puppeteer health check (every ~5th heartbeat ≈ every 100s)
  // Detects broken browser contexts that don't fire the 'disconnected' event
  if (state.status === 'connected' && Math.random() < 0.2) {
    checkBrowserHealth(state).catch(() => {})
  }

  return true
}

async function checkBrowserHealth(state: ClientState): Promise<void> {
  try {
    const page = state.client.pupPage
    if (!page || page.isClosed()) {
      throw new Error('Page closed')
    }
    // Simple eval to verify the execution context is alive
    await Promise.race([
      page.evaluate(() => 1),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Health check timeout')), 5000))
    ])
    // Reset failure counter on success
    state.healthFailures = 0
  } catch (err: any) {
    state.healthFailures = (state.healthFailures || 0) + 1
    console.warn(`[WA Health] Check failed for user ${state.userId}: ${err.message} (failure ${state.healthFailures}/3)`)
    // Only reap after 3 consecutive failures to avoid transient issues
    if (state.healthFailures >= 3) {
      console.error(`[WA Health] Browser context broken for user ${state.userId} after 3 failures. Reaping...`)
      try { await reapClient(state.userId) } catch {}
    }
  }
}

// Manual sync trigger (called from API when user clicks "Sync")
export async function triggerSync(userId: string): Promise<{ success: boolean; error?: string }> {
  const state = clients.get(userId)
  if (!state) return { success: false, error: 'Client not connected' }
  if (state.status !== 'connected') return { success: false, error: 'Client not in connected state' }

  // Allow retry even if previous sync is stuck (reset from 'syncing' state)
  // The getChats timeout ensures old syncs won't run forever
  state.syncStatus = 'syncing'
  try {
    await syncChatHistory(state)
    state.syncStatus = 'synced'
    return { success: true }
  } catch (err: any) {
    state.syncStatus = 'error'
    return { success: false, error: err.message || 'Sync failed' }
  }
}

// ============================================
// TTL Reaper: Auto-disconnect stale clients
// ============================================

const TTL_CHECK_INTERVAL_MS = 60_000    // Check every 60s
const TTL_THRESHOLD_MS = 1_200_000     // Disconnect if no heartbeat for 20 min (user requested: only disconnect after 20 min inactivity)

// Only start the reaper once (prevent duplicates on HMR)
if (!globalForWA.waReaperStarted) {
  globalForWA.waReaperStarted = true

  const reaperInterval = setInterval(async () => {
    const now = Date.now()

    for (const [userId, state] of clients.entries()) {
      if (state.status !== 'connected') continue

      const elapsed = now - state.lastHeartbeat

      if (elapsed > TTL_THRESHOLD_MS) {
        console.log(
          `[WA TTL] Client for user ${userId} expired (last heartbeat ${Math.round(elapsed / 1000)}s ago). Reaping (session preserved)...`
        )
        try {
          await reapClient(userId)
        } catch (err) {
          console.error(`[WA TTL] Error reaping user ${userId}:`, err)
          clients.delete(userId)
        }
      }
    }
  }, TTL_CHECK_INTERVAL_MS)

  if (reaperInterval.unref) {
    reaperInterval.unref()
  }
}

// Clean up orphaned DB connections on server restart
;(async () => {
  try {
    const { count } = await supabaseAdmin
      .from('whatsapp_connections')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')

    if (count && count > 0) {
      console.log(`[WA Startup] Found ${count} orphaned active connections, marking as disconnected`)
      await supabaseAdmin
        .from('whatsapp_connections')
        .update({ status: 'disconnected' })
        .eq('status', 'active')
    }
  } catch (err) {
    console.error('[WA Startup] Error cleaning orphaned connections:', err)
  }
})()

// ============================================
// Internal helpers
// ============================================

async function upsertConnection(state: ClientState): Promise<void> {
  // First check if connection exists for this user
  const { data: existing } = await supabaseAdmin
    .from('whatsapp_connections')
    .select('id')
    .eq('user_id', state.userId)
    .single()

  if (existing) {
    const { error: updateError } = await supabaseAdmin
      .from('whatsapp_connections')
      .update({
        status: 'active',
        phone_number_id: state.phoneNumber || 'wwebjs',
        display_phone_number: state.phoneNumber,
        connected_at: new Date().toISOString(),
        last_webhook_at: new Date().toISOString()
      })
      .eq('id', existing.id)

    if (updateError) {
      console.error(`[WA] Failed to update connection:`, updateError)
    }
    state.connectionId = existing.id
    console.log(`[WA] Connection updated: ${state.connectionId}`)
  } else {
    // Check if phone_number_id is already used by another user (and delete if so)
    if (state.phoneNumber) {
      const { data: existingByPhone } = await supabaseAdmin
        .from('whatsapp_connections')
        .select('id, user_id')
        .eq('phone_number_id', state.phoneNumber)
        .single()

      if (existingByPhone && existingByPhone.user_id !== state.userId) {
        console.log(`[WA] Phone ${state.phoneNumber} was connected to another user, cleaning up...`)
        // Delete old connection and related data
        await supabaseAdmin.from('whatsapp_messages').delete().eq('connection_id', existingByPhone.id)
        await supabaseAdmin.from('whatsapp_conversations').delete().eq('connection_id', existingByPhone.id)
        await supabaseAdmin.from('whatsapp_connections').delete().eq('id', existingByPhone.id)
      }
    }

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('whatsapp_connections')
      .insert({
        user_id: state.userId,
        company_id: state.companyId,
        phone_number_id: state.phoneNumber || `wwebjs_${state.userId.substring(0, 8)}`,
        waba_id: 'wwebjs',
        display_phone_number: state.phoneNumber,
        access_token: 'wwebjs_session',
        status: 'active',
        connected_at: new Date().toISOString()
      })
      .select('id')
      .single()

    if (insertError) {
      console.error(`[WA] Failed to insert connection:`, insertError)
      state.connectionId = null
    } else {
      state.connectionId = inserted?.id || null
      console.log(`[WA] Connection created: ${state.connectionId}`)
    }
  }
}

// Helper to ensure connection_id is valid (refreshes from DB if stale)
async function ensureValidConnectionId(state: ClientState): Promise<string | null> {
  if (!state.connectionId) return null

  // Quick check: does the connection record still exist?
  const { data } = await supabaseAdmin
    .from('whatsapp_connections')
    .select('id')
    .eq('id', state.connectionId)
    .single()

  if (data) return state.connectionId

  // Connection was deleted — look up by user_id and re-use or create
  console.warn(`[WA] Connection ${state.connectionId} no longer exists for user ${state.userId}. Refreshing...`)
  const { data: existing } = await supabaseAdmin
    .from('whatsapp_connections')
    .select('id')
    .eq('user_id', state.userId)
    .order('connected_at', { ascending: false })
    .limit(1)
    .single()

  if (existing) {
    state.connectionId = existing.id
    console.log(`[WA] Refreshed connection_id to ${state.connectionId}`)
    return state.connectionId
  }

  // No connection at all — re-create one
  await upsertConnection(state)
  return state.connectionId
}

// Format media type for conversation preview (WhatsApp Web style)
function formatMediaPreview(messageType: string): string {
  const labels: Record<string, string> = {
    image: '📷 Foto',
    video: '🎥 Vídeo',
    audio: '🎵 Áudio',
    ptt: '🎤 Áudio',
    document: '📄 Documento',
    sticker: '🏷️ Figurinha',
    location: '📍 Localização',
    contact: '👤 Contato',
    contacts: '👤 Contato',
  }
  return labels[messageType] || (messageType === 'text' || messageType === 'message' ? '' : `[${messageType}]`)
}

// Helper to extract message content
function extractMessageContent(msg: Message): { messageType: string; content: string; mediaMimeType: string | null } | null {
  // Universal catch-all: whatsapp-web.js marks all system/notification messages
  // (group creation, subject changes, encryption notices, participant changes, etc.)
  if ((msg as any)._data?.isNotification) {
    return null
  }

  let messageType = 'text'
  let mediaMimeType: string | null = null
  let content = msg.body || ''

  if (msg.hasMedia) {
    if (msg.type === 'image') {
      messageType = 'image'
      mediaMimeType = 'image/jpeg'
      content = (msg as any).caption || ''
    } else if (msg.type === 'ptt' || msg.type === 'audio') {
      messageType = 'audio'
      mediaMimeType = 'audio/ogg'
      content = '[Áudio]'
    } else if (msg.type === 'video') {
      messageType = 'video'
      mediaMimeType = 'video/mp4'
      content = (msg as any).caption || ''
    } else if (msg.type === 'document') {
      messageType = 'document'
      content = (msg as any).filename || '[Documento]'
    } else if (msg.type === 'sticker') {
      messageType = 'sticker'
      mediaMimeType = 'image/webp'
      content = '[Sticker]'
    }
  } else if (msg.type === 'location') {
    messageType = 'location'
    const loc = (msg as any).location
    content = loc ? `${loc.latitude},${loc.longitude}${loc.description ? ` - ${loc.description}` : ''}` : '[Localização]'
  } else if (msg.type === 'vcard' || msg.type === 'multi_vcard') {
    messageType = 'contact'
    content = msg.body || '[Contato]'
  } else if (
    msg.type === 'e2e_notification' ||
    (msg.type as string) === 'notification' ||
    (msg.type as string) === 'notification_template' ||
    (msg.type as string) === 'gp2' ||           // Group participant add/remove/promote
    (msg.type as string) === 'call_log' ||
    (msg.type as string) === 'protocol' ||
    (msg.type as string) === 'ciphertext' ||     // Encrypted placeholder (not yet decrypted)
    (msg.type as string) === 'revoked' ||        // Deleted messages
    (msg.type as string) === 'groups_v4_invite' || // Group invite links
    (msg.type as string) === 'broadcast_notification' ||
    (msg.type as string) === 'group_notification' ||
    (msg.type as string) === 'pin_in_chat'
  ) {
    return null
  } else if ((msg.type as string) === 'interactive' || (msg.type as string) === 'button_reply' || (msg.type as string) === 'list_reply') {
    messageType = 'interactive'
    content = msg.body || (msg as any).selectedButtonId || (msg as any).selectedRowId || '[Mensagem interativa]'
  } else if (msg.type === 'chat') {
    content = msg.body || ''
    if (!content && (msg as any)._data?.body) content = (msg as any)._data.body
  } else {
    content = msg.body || ''
    if (!content) return null
  }

  return { messageType, content, mediaMimeType }
}

// Helper to resolve contact phone (with caching)
async function resolveContactPhone(chatId: string, contact: any, state: ClientState): Promise<{ contactPhone: string; isLidContact: boolean } | null> {
  // Check cache first
  const cached = contactPhoneCache.get(chatId)
  if (cached) {
    return { contactPhone: cached, isLidContact: chatId.endsWith('@lid') }
  }

  const isLidContact = chatId.endsWith('@lid')
  let contactPhone: string

  if (isLidContact) {
    const lidNumber = chatId.replace(/@lid$/, '')
    let rawPhone = (contact as any)?.number || ''

    if (!rawPhone && contact?.id?.user && !contact.id._serialized?.endsWith('@lid')) {
      rawPhone = contact.id.user
    }

    if (!rawPhone) {
      try {
        const formattedNumber = await (contact as any).getFormattedNumber?.()
        if (formattedNumber) rawPhone = formattedNumber
      } catch {}
    }

    const normalizedPhone = rawPhone ? String(rawPhone).replace(/[^0-9]/g, '') : ''
    const isValidPhone = normalizedPhone &&
                         normalizedPhone.length >= 8 &&
                         normalizedPhone.length <= 15 &&
                         normalizedPhone !== lidNumber

    contactPhone = isValidPhone ? normalizedPhone : `lid_${lidNumber}`
  } else {
    contactPhone = chatId.replace(/@.*$/, '')
  }

  if (!contactPhone || contactPhone === state.phoneNumber) return null

  contactPhoneCache.set(chatId, contactPhone)
  return { contactPhone, isLidContact }
}

// Process a single chat (for parallel processing)
// cachedConnId: pre-validated connection ID (avoids per-chat DB query during sync)
// skipProfilePic: skip slow Puppeteer profile pic fetch during initial sync
async function processSingleChat(chat: any, state: ClientState, isGroup = false, cachedConnId?: string, skipProfilePic = false): Promise<void> {
  try {
    const chatIdSerialized = chat.id._serialized || ''

    // Skip LID chats in processSingleChat as defense-in-depth
    // (they should already be filtered in syncChatHistory, but just in case)
    if (chatIdSerialized.endsWith('@lid')) {
      return
    }

    let contactPhone: string
    let contactName: string | null
    let profilePicUrl: string | null = null
    let isLidContact = false

    if (isGroup) {
      // For groups: use group ID as contact_phone, group name as contact_name
      contactPhone = chatIdSerialized
      contactName = chat.name || 'Grupo'

      if (!skipProfilePic) {
        try {
          profilePicUrl = await state.client.getProfilePicUrl(chatIdSerialized) || null
        } catch {}
      }
    } else {
      const contact = await chat.getContact()
      contactName = chat.name || contact?.name || contact?.pushname || null

      if (!skipProfilePic) {
        try {
          profilePicUrl = await state.client.getProfilePicUrl(chat.id._serialized) || null
        } catch {}
      }

      const resolved = await resolveContactPhone(chatIdSerialized, contact, state)
      if (!resolved) return

      contactPhone = resolved.contactPhone
      isLidContact = resolved.isLidContact
    }

    // Use cached connection ID if available, otherwise validate per-chat
    const validConnId = cachedConnId || await ensureValidConnectionId(state)
    if (!validConnId) return

    // Fetch only last 15 messages per chat (fast initial sync, reduces memory pressure)
    const messages = await chat.fetchMessages({ limit: 15 })
    if (messages.length === 0) return

    // Get existing message IDs in bulk
    const messageIds = messages.map((m: Message) => m.id._serialized)
    const { data: existingMsgs } = await supabaseAdmin
      .from('whatsapp_messages')
      .select('wa_message_id')
      .in('wa_message_id', messageIds)

    const existingIds = new Set(existingMsgs?.map(m => m.wa_message_id) || [])

    // Prepare batch insert - separate media and non-media messages
    const nonMediaMessages: any[] = []
    const mediaMessages: { msg: any; extracted: { messageType: string; content: string; mediaMimeType: string | null } }[] = []
    let lastMessageAt: Date | null = null
    let lastMessagePreview = ''

    for (const msg of messages) {
      if (msg.from === 'status@broadcast' || msg.to === 'status@broadcast') continue
      if (existingIds.has(msg.id._serialized)) continue

      const extracted = extractMessageContent(msg)
      if (!extracted) continue

      const { messageType, content, mediaMimeType } = extracted
      const msgTimestamp = new Date(msg.timestamp * 1000)

      // For groups, resolve sender name for non-fromMe messages
      let msgContactName = contactName
      if (isGroup && !msg.fromMe) {
        try {
          const senderContact = await msg.getContact()
          const resolvedName = senderContact?.name || senderContact?.pushname || null
          // Don't use raw author IDs (like "2377013243905270lid") as display names
          const authorName = msg.author && !/^\d+(@|$)/.test(msg.author) ? msg.author : null
          msgContactName = resolvedName || authorName || contactName
        } catch {
          const authorName = msg.author && !/^\d+(@|$)/.test(msg.author) ? msg.author : null
          msgContactName = authorName || contactName
        }
      }

      const baseMessage = {
        connection_id: validConnId,
        user_id: state.userId,
        company_id: state.companyId,
        wa_message_id: msg.id._serialized,
        contact_phone: contactPhone,
        contact_name: msgContactName,
        direction: msg.fromMe ? 'outbound' : 'inbound',
        message_type: messageType,
        content,
        media_id: null as string | null,
        media_mime_type: mediaMimeType,
        message_timestamp: msgTimestamp.toISOString(),
        status: msg.fromMe ? 'sent' : 'delivered',
        raw_payload: { type: msg.type, hasMedia: msg.hasMedia, from: msg.from, to: msg.to, original_chat_id: chatIdSerialized, is_lid: isLidContact, is_group: isGroup }
      }

      // Separate media messages for individual processing
      if (msg.hasMedia && ['audio', 'ptt', 'image', 'video', 'document', 'sticker'].includes(messageType)) {
        mediaMessages.push({ msg, extracted })
      } else {
        nonMediaMessages.push(baseMessage)
      }

      if (!lastMessageAt || msgTimestamp > lastMessageAt) {
        lastMessageAt = msgTimestamp
        lastMessagePreview = content?.substring(0, 100) || formatMediaPreview(messageType)
      }
    }

    // Insert all messages in batch (skip media downloads during sync for speed)
    // Media files will be downloaded on-demand when user opens the conversation
    const allInsertMessages = [
      ...nonMediaMessages,
      ...mediaMessages.map(({ msg, extracted }) => {
        let msgContactName = contactName
        if (isGroup && !msg.fromMe) {
          msgContactName = msg.author || contactName
        }
        return {
          connection_id: validConnId,
          user_id: state.userId,
          company_id: state.companyId,
          wa_message_id: msg.id._serialized,
          contact_phone: contactPhone,
          contact_name: msgContactName,
          direction: msg.fromMe ? 'outbound' : 'inbound',
          message_type: extracted.messageType,
          content: extracted.content,
          media_id: null,
          media_mime_type: extracted.mediaMimeType,
          message_timestamp: new Date(msg.timestamp * 1000).toISOString(),
          status: msg.fromMe ? 'sent' : 'delivered',
          raw_payload: { type: msg.type, hasMedia: msg.hasMedia, from: msg.from, to: msg.to, original_chat_id: chatIdSerialized, is_lid: isLidContact, is_group: isGroup }
        }
      })
    ]

    if (allInsertMessages.length > 0) {
      try {
        await supabaseAdmin.from('whatsapp_messages').insert(allInsertMessages)
      } catch {}
    }

    // Upsert conversation — find latest non-notification message for preview
    const latestMsg = messages.reduce((latest: any, msg: any) => {
      if (!latest || msg.timestamp > latest.timestamp) return msg
      return latest
    }, null)
    // Find latest message that has actual content (skip notifications)
    const latestContentMsg = messages
      .filter((msg: any) => extractMessageContent(msg) !== null)
      .reduce((latest: any, msg: any) => {
        if (!latest || msg.timestamp > latest.timestamp) return msg
        return latest
      }, null)

    if (latestMsg) {
      const latestTimestamp = new Date(latestMsg.timestamp * 1000)
      const previewSource = latestContentMsg || latestMsg
      const latestContent = extractMessageContent(previewSource)
      const preview = latestContent?.content?.substring(0, 100) || formatMediaPreview(latestContent?.messageType || 'text')

      await supabaseAdmin
        .from('whatsapp_conversations')
        .upsert({
          connection_id: validConnId,
          user_id: state.userId,
          company_id: state.companyId,
          contact_phone: contactPhone,
          contact_name: contactName,
          profile_pic_url: profilePicUrl,
          last_message_at: latestTimestamp.toISOString(),
          last_message_preview: preview,
          unread_count: 0,
          message_count: nonMediaMessages.length + mediaMessages.length + existingIds.size,
          updated_at: new Date().toISOString()
        }, { onConflict: 'connection_id,contact_phone' })
    }
  } catch (err: any) {
    console.error(`[Sync] Error processing chat:`, err.message || err)
  }
}

async function syncChatHistory(state: ClientState): Promise<void> {
  try {
    if (state.destroyed) { console.log(`[WA] Sync aborted (destroyed) for user ${state.userId}`); return }
    const client = state.client

    // LIGHTWEIGHT APPROACH: Get chat IDs directly from WhatsApp Web store
    // instead of using client.getChats() which serializes every chat + group metadata (very slow)
    console.log(`[WA] Getting chat list (lightweight) for user ${state.userId}`)

    let chatIds: { id: string; name: string; isGroup: boolean }[] = []

    try {
      chatIds = await Promise.race([
        client.pupPage!.evaluate(() => {
          const chats = (window as any).Store.Chat.getModelsArray()
          return chats.map((chat: any) => ({
            id: chat.id._serialized,
            name: chat.formattedTitle || chat.name || chat.id.user || '',
            isGroup: chat.isGroup || chat.id._serialized.endsWith('@g.us')
          }))
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Chat list fetch timed out after 30s')), 30000)
        )
      ])
    } catch (err: any) {
      console.error(`[WA] Failed to get chat list:`, err.message || err)
      throw err
    }

    if (state.destroyed) return

    // Filter OUT @lid chats — getChatById() on LID contacts crashes Puppeteer
    // (causes "Invariant Violation" and "Execution context destroyed" errors)
    // LID contacts still work for real-time messages, just skip them during sync
    const safeChatIds = chatIds.filter(c => !c.id.endsWith('@lid'))
    const skippedLid = chatIds.length - safeChatIds.length

    // Include both individual chats and groups, limit to 40
    const filteredChats = safeChatIds.slice(0, 40)
    const groupCount = filteredChats.filter(c => c.isGroup).length
    console.log(`[WA] Found ${chatIds.length} total chats (${skippedLid} LID skipped, ${groupCount} groups). Syncing ${filteredChats.length}...`)

    if (filteredChats.length === 0) {
      console.log(`[WA] No chats found for user ${state.userId}`)
      return
    }

    // Pre-validate connection ID once (avoids 2 DB queries per chat)
    const cachedConnId = await ensureValidConnectionId(state)
    if (!cachedConnId) {
      console.error(`[WA] No valid connection_id for sync, aborting`)
      return
    }

    // Process chats in parallel batches of 5 (much faster than sequential)
    // Puppeteer can handle ~5 concurrent getChatById calls safely
    const BATCH_SIZE = 5
    let contextDead = false
    let processedCount = 0
    const startTime = Date.now()

    for (let batchStart = 0; batchStart < filteredChats.length; batchStart += BATCH_SIZE) {
      if (state.destroyed || contextDead) { console.log(`[WA] Sync aborted mid-batch for user ${state.userId}`); return }

      const batch = filteredChats.slice(batchStart, batchStart + BATCH_SIZE)

      const results = await Promise.allSettled(
        batch.map(async (chatInfo) => {
          const chat = await Promise.race([
            client.getChatById(chatInfo.id),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error(`getChatById timed out for ${chatInfo.id}`)), 15000)
            )
          ])
          // Skip profile pics during sync (they're slow Puppeteer calls)
          // Profile pics are loaded lazily when conversation list is displayed
          await processSingleChat(chat, state, chatInfo.isGroup, cachedConnId, true)
        })
      )

      for (let j = 0; j < results.length; j++) {
        const result = results[j]
        if (result.status === 'rejected') {
          const errMsg = result.reason?.message || String(result.reason)
          console.error(`[WA] Error processing chat ${batch[j].id}:`, errMsg)

          // If Puppeteer context is dead, stop processing remaining batches
          if (errMsg.includes('Execution context was destroyed') || errMsg.includes('context destroyed') || errMsg.includes('Target closed')) {
            console.error(`[WA] Puppeteer context dead during sync for user ${state.userId}. Stopping sync.`)
            contextDead = true
            break
          }
        } else {
          processedCount++
        }
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(`[WA] Sync complete for user ${state.userId}: ${processedCount}/${filteredChats.length} chats in ${elapsed}s`)

    // Background: fetch profile pics for conversations that don't have one yet
    // This runs after sync is "done" so the UI shows conversations immediately
    if (!state.destroyed) {
      fetchMissingProfilePics(state, cachedConnId).catch(() => {})
    }
  } catch (error) {
    if (state.destroyed) return  // Don't propagate errors for destroyed clients
    console.error('[WA] Error syncing:', error)
    throw error // Re-throw so caller can set syncStatus to 'error'
  }
}

// Background task: fetch profile pics for conversations that don't have one yet
// Runs after initial sync is complete so conversations appear immediately without waiting
async function fetchMissingProfilePics(state: ClientState, connectionId: string): Promise<void> {
  try {
    const { data: convs } = await supabaseAdmin
      .from('whatsapp_conversations')
      .select('contact_phone')
      .eq('connection_id', connectionId)
      .is('profile_pic_url', null)
      .limit(40)

    if (!convs || convs.length === 0) return
    console.log(`[WA] Fetching profile pics for ${convs.length} conversations...`)

    let fetched = 0
    for (const conv of convs) {
      if (state.destroyed) break
      try {
        // For groups, use contact_phone directly (it's the @g.us ID)
        // For individuals, construct the JID
        const jid = conv.contact_phone.includes('@')
          ? conv.contact_phone
          : `${conv.contact_phone.replace(/^lid_/, '')}@c.us`
        const picUrl = await state.client.getProfilePicUrl(jid)
        if (picUrl) {
          await supabaseAdmin
            .from('whatsapp_conversations')
            .update({ profile_pic_url: picUrl })
            .eq('connection_id', connectionId)
            .eq('contact_phone', conv.contact_phone)
          fetched++
        }
      } catch {}
    }
    if (fetched > 0) console.log(`[WA] Fetched ${fetched} profile pics`)
  } catch (err) {
    console.error('[WA] Error fetching profile pics:', err)
  }
}

async function handleIncomingMessage(state: ClientState, msg: Message, fromMe: boolean): Promise<void> {
  try {
    console.log(`[WA] Processing message: type=${msg.type}, fromMe=${fromMe}, body=${msg.body?.substring(0, 50) || '[no body]'}`)
    const chat = await msg.getChat()
    if (msg.from === 'status@broadcast' || msg.to === 'status@broadcast') return

    const isGroup = chat.isGroup || false
    let contactPhone: string
    let contactName: string | null
    let convContactName: string | null  // Name for the conversation record (group name for groups)
    let profilePicUrl: string | null = null
    let isLidContact = false

    if (isGroup) {
      // For groups: use group ID as contact_phone, group name as conversation name
      contactPhone = chat.id._serialized
      convContactName = chat.name || 'Grupo'

      // Fetch group profile picture
      try {
        profilePicUrl = await state.client.getProfilePicUrl(chat.id._serialized) || null
      } catch {}

      // For individual messages, resolve the sender's name
      if (fromMe) {
        contactName = 'Você'
      } else {
        try {
          const senderContact = await msg.getContact()
          const resolvedName = senderContact?.name || senderContact?.pushname || null
          // Don't use raw author IDs (like "2377013243905270lid") as display names
          const author = (msg as any).author
          const authorName = author && !/^\d+(@|$)/.test(author) ? author : null
          contactName = resolvedName || authorName || convContactName
        } catch {
          const author = (msg as any).author
          const authorName = author && !/^\d+(@|$)/.test(author) ? author : null
          contactName = authorName || convContactName
        }
      }
    } else {
      const contact = await chat.getContact()
      contactName = chat.name || contact?.name || contact?.pushname || null
      convContactName = contactName

      if (!fromMe) {
        try {
          profilePicUrl = await state.client.getProfilePicUrl(chat.id._serialized) || null
        } catch {}
      }

      const targetId = fromMe ? (msg.to || '') : (msg.from || '')
      let resolved = contactPhoneCache.get(targetId)
        ? { contactPhone: contactPhoneCache.get(targetId)!, isLidContact: targetId.endsWith('@lid') }
        : await resolveContactPhone(targetId, contact, state)
      if (!resolved) return
      contactPhone = resolved.contactPhone
      isLidContact = resolved.isLidContact

      if (!contactPhone || contactPhone === state.phoneNumber) return
    }

    const extracted = extractMessageContent(msg)
    if (!extracted) return

    const { messageType, content, mediaMimeType } = extracted
    const direction = fromMe ? 'outbound' : 'inbound'
    const msgTimestamp = new Date(msg.timestamp * 1000)

    // Download and save media if present
    let mediaId: string | null = null
    if (msg.hasMedia && (messageType === 'audio' || messageType === 'image' || messageType === 'video' || messageType === 'document' || messageType === 'sticker')) {
      try {
        const media = await msg.downloadMedia()
        if (media?.data) {
          const ext = messageType === 'audio' ? 'ogg' :
                      messageType === 'image' ? 'jpg' :
                      messageType === 'video' ? 'mp4' :
                      messageType === 'sticker' ? 'webp' : 'bin'
          mediaId = `${state.userId}/${Date.now()}_${msg.id._serialized.slice(-8)}.${ext}`

          const buffer = Buffer.from(media.data, 'base64')
          await supabaseAdmin.storage
            .from('whatsapp-media')
            .upload(mediaId, buffer, {
              contentType: media.mimetype || mediaMimeType || 'application/octet-stream',
              upsert: true
            })

          console.log(`[WA] Media saved: ${mediaId}`)

          if (messageType === 'audio') {
            transcribeAudioMessage(buffer, msg.id._serialized, state.userId).catch(() => {})
          }
        }
      } catch (err) {
        console.error('[WA] Failed to download/save media:', err)
      }
    }

    // Ensure connection_id is still valid (prevents FK violations after reconnection)
    const validConnId = await ensureValidConnectionId(state)
    if (!validConnId) {
      console.error(`[WA] No valid connection_id for user ${state.userId}, dropping message`)
      return
    }

    // Insert message and upsert conversation in parallel
    const messageInsert = supabaseAdmin
      .from('whatsapp_messages')
      .insert({
        connection_id: validConnId,
        user_id: state.userId,
        company_id: state.companyId,
        wa_message_id: msg.id._serialized,
        contact_phone: contactPhone,
        contact_name: contactName,
        direction,
        message_type: messageType,
        content,
        media_id: mediaId,
        media_mime_type: mediaMimeType,
        message_timestamp: msgTimestamp.toISOString(),
        status: fromMe ? 'sent' : 'delivered',
        raw_payload: { type: msg.type, hasMedia: msg.hasMedia, from: msg.from, to: msg.to, original_chat_id: chat.id._serialized, is_lid: isLidContact, is_group: isGroup }
      })

    const messagePreview = content?.substring(0, 100) || formatMediaPreview(messageType)
    const convData: any = {
      connection_id: validConnId,
      user_id: state.userId,
      company_id: state.companyId,
      contact_phone: contactPhone,
      contact_name: convContactName,
      last_message_at: msgTimestamp.toISOString(),
      last_message_preview: messagePreview,
      unread_count: direction === 'inbound' ? 1 : 0,
      message_count: 1,
      updated_at: new Date().toISOString()
    }
    if (profilePicUrl) {
      convData.profile_pic_url = profilePicUrl
    }
    const convUpsert = supabaseAdmin
      .from('whatsapp_conversations')
      .upsert(convData, { onConflict: 'connection_id,contact_phone', ignoreDuplicates: false })

    const [msgResult, convResult] = await Promise.allSettled([messageInsert, convUpsert])

    if (msgResult.status === 'rejected') {
      console.error(`[WA] Failed to insert message:`, msgResult.reason)
    }
    if (convResult.status === 'rejected') {
      console.error(`[WA] Failed to upsert conversation:`, convResult.reason)
    }

    console.log(`[WA] Message processed: ${direction} ${messageType} from ${contactPhone}`)

    // === COPILOT AUTO-LEARNING HOOKS (non-blocking, skip groups) ===
    if (messageType === 'text' && content && !isGroup) {
      if (fromMe) {
        // Seller sent a message → track it for outcome analysis
        trackSellerMessage(state, contactPhone, contactName, content, msgTimestamp).catch((err: any) =>
          console.error('[WA] trackSellerMessage error:', err.message || err)
        )
      } else {
        // Client responded → trigger automatic outcome analysis
        triggerOutcomeAnalysis(state, contactPhone, content).catch((err: any) =>
          console.error('[WA] triggerOutcomeAnalysis error:', err.message || err)
        )
      }
    }
  } catch (error) {
    console.error(`[WA] Error handling message:`, error)
  }
}

// === AUDIO TRANSCRIPTION (Whisper) ===

async function transcribeAudioMessage(
  mediaBuffer: Buffer,
  messageId: string,
  userId: string
): Promise<void> {
  try {
    const file = await toFile(mediaBuffer, 'audio.ogg', { type: 'audio/ogg' })

    const transcription = await openai.audio.transcriptions.create({
      model: 'gpt-4o-mini-transcribe',
      file,
      language: 'pt',
      prompt: 'Transcrição de áudio de conversa de vendas no WhatsApp em português brasileiro. Nomes de produtos, empresas e termos comerciais devem ser transcritos com precisão.'
    })

    const text = transcription.text?.trim()
    if (!text) return

    await supabaseAdmin
      .from('whatsapp_messages')
      .update({ transcription: text })
      .eq('wa_message_id', messageId)
      .eq('user_id', userId)

    console.log(`[WA] Transcribed audio ${messageId}: ${text.substring(0, 80)}...`)
  } catch (err: any) {
    console.error(`[WA] Transcription failed for ${messageId}:`, err.message || err)
  }
}

// === COPILOT AUTO-LEARNING FUNCTIONS ===

// Classify a contact as 'client' or 'personal' using GPT-4.1-mini
async function classifyContact(
  userId: string,
  contactPhone: string,
  conversationContext: string
): Promise<'client' | 'personal'> {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        messages: [
          {
            role: 'system',
            content: `Analise esta conversa de WhatsApp entre um vendedor e um contato.
Classifique se o contato é um CLIENTE/LEAD de vendas ou um CONTATO PESSOAL.

Responda APENAS com JSON válido, sem markdown:
{"type": "client", "reason": "explicação curta"}
ou
{"type": "personal", "reason": "explicação curta"}

Critérios:
- client: conversa sobre produtos/serviços, negociações, propostas, follow-up de vendas, agendamento de reuniões de negócio, pedidos, orçamentos, qualquer interação comercial
- personal: conversa informal, assuntos pessoais, colegas de trabalho (sem contexto de venda), família, amigos, conversas internas da empresa`
          },
          {
            role: 'user',
            content: `CONVERSA:\n${conversationContext.slice(0, 3000)}`
          }
        ],
        max_tokens: 100,
        temperature: 0.1
      })
    })

    const data = await response.json()
    const rawContent = data.choices?.[0]?.message?.content || ''

    let classification: { type: string; reason: string }
    try {
      classification = JSON.parse(rawContent.replace(/```json?\n?/g, '').replace(/```/g, '').trim())
    } catch {
      classification = { type: 'client', reason: 'Classification parse error' }
    }

    const contactType = classification.type === 'personal' ? 'personal' : 'client'

    // Save to whatsapp_conversations
    await supabaseAdmin
      .from('whatsapp_conversations')
      .update({ contact_type: contactType })
      .eq('contact_phone', contactPhone)
      .eq('user_id', userId)

    console.log(`[WA] Contact classified: ${contactPhone} → ${contactType} (${classification.reason})`)
    return contactType
  } catch (err: any) {
    console.error(`[WA] classifyContact error for ${contactPhone}:`, err.message || err)
    return 'client' // Default to client on error (safer to track than to miss)
  }
}

async function trackSellerMessage(
  state: ClientState,
  contactPhone: string,
  contactName: string | null,
  content: string,
  msgTimestamp: Date
): Promise<void> {
  // Fetch recent conversation context from DB (including transcriptions for audio)
  const { data: recentMsgs } = await supabaseAdmin
    .from('whatsapp_messages')
    .select('direction, content, message_timestamp, message_type, transcription')
    .eq('contact_phone', contactPhone)
    .eq('user_id', state.userId)
    .order('message_timestamp', { ascending: false })
    .limit(15)

  const context = (recentMsgs || [])
    .reverse()
    .map((m: any) => {
      const sender = m.direction === 'outbound' ? 'Vendedor' : (contactName || 'Cliente')
      const time = new Date(m.message_timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      let msgContent = m.content || ''
      if ((m.message_type === 'audio' || m.message_type === 'ptt') && m.transcription) {
        msgContent = `[Áudio]: ${m.transcription}`
      } else if (!msgContent && m.message_type) {
        msgContent = `[${m.message_type}]`
      }
      return `[${time}] ${sender}: ${msgContent}`
    })
    .join('\n')

  // Check contact type before tracking (auto-classify if unknown)
  const { data: conv } = await supabaseAdmin
    .from('whatsapp_conversations')
    .select('contact_type')
    .eq('contact_phone', contactPhone)
    .eq('user_id', state.userId)
    .limit(1)
    .single()

  let contactType = conv?.contact_type || 'unknown'

  if (contactType === 'unknown') {
    // Classify using the context we already fetched
    contactType = await classifyContact(state.userId, contactPhone, context)
  }

  if (contactType === 'personal') {
    console.log(`[WA] Skipping tracking for personal contact: ${contactPhone}`)
    return
  }

  await supabaseAdmin
    .from('seller_message_tracking')
    .insert({
      user_id: state.userId,
      company_id: state.companyId,
      contact_phone: contactPhone,
      contact_name: contactName,
      seller_message: content.slice(0, 2000),
      conversation_context: context.slice(0, 5000),
      message_timestamp: msgTimestamp.toISOString()
    })

  console.log(`[WA] Tracked seller message to ${contactPhone}`)
}

async function triggerOutcomeAnalysis(
  state: ClientState,
  contactPhone: string,
  clientResponse: string
): Promise<void> {
  // Check contact type before triggering analysis
  const { data: conv } = await supabaseAdmin
    .from('whatsapp_conversations')
    .select('contact_type')
    .eq('contact_phone', contactPhone)
    .eq('user_id', state.userId)
    .limit(1)
    .single()

  const contactType = conv?.contact_type || 'unknown'
  if (contactType !== 'client') {
    console.log(`[WA] Skipping outcome analysis for ${contactType} contact: ${contactPhone}`)
    return
  }

  // Call analyze-outcome API internally (fire-and-forget)
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000'

  await fetch(`${baseUrl}/api/copilot/analyze-outcome`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contactPhone,
      clientResponse: clientResponse.slice(0, 2000),
      companyId: state.companyId,
      userId: state.userId
    })
  })

  console.log(`[WA] Triggered outcome analysis for ${contactPhone}`)
}
