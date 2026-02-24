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
  lastAutopilotScan: number  // Timestamp of last autopilot scan (prevents duplicate scans)
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
  waAutopilotSentMsgIds?: Set<string>  // Track messages sent by autopilot to prevent complement loops
}

const clients = globalForWA.waClients ?? (globalForWA.waClients = new Map<string, ClientState>())
const initializingUsers = globalForWA.waInitializing ?? (globalForWA.waInitializing = new Set<string>())
const lastInitAttempt = globalForWA.waLastInit ?? (globalForWA.waLastInit = new Map<string, number>())
const readyTimeoutCount = globalForWA.waReadyTimeouts ?? (globalForWA.waReadyTimeouts = new Map<string, number>())
const contactPhoneCache = globalForWA.waContactCache ?? (globalForWA.waContactCache = new Map<string, string>())
const autopilotSentMsgIds = globalForWA.waAutopilotSentMsgIds ?? (globalForWA.waAutopilotSentMsgIds = new Set<string>())

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

export function getAllConnectedClients(): { userId: string; phone: string | null }[] {
  const result: { userId: string; phone: string | null }[] = []
  for (const [userId, state] of clients.entries()) {
    if (state.status === 'connected') {
      result.push({ userId, phone: state.phoneNumber })
    }
  }
  return result
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
    healthFailures: 0,
    lastAutopilotScan: 0
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

    // Only process first authenticated event — duplicates MUST NOT reset status
    // (duplicate auth events can fire AFTER ready, resetting 'connected' → 'connecting')
    if (authFired) return
    authFired = true
    state.status = 'connecting'

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
            lastHeartbeat: 0, destroyed: true, healthFailures: 0, lastAutopilotScan: 0
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

    // Wait for WhatsApp to sync offline chats from server before reading chat list
    // 8s gives enough time for chat metadata to load (especially for offline conversations)
    console.log(`[WA] Waiting 8s before sync for user ${userId}...`)
    await new Promise(resolve => setTimeout(resolve, 8000))

    if (state.destroyed) return  // Check again after delay

    // Sync in background (don't block)
    state.syncStatus = 'syncing'
    syncChatHistory(state).then(() => {
      if (!state.destroyed) {
        state.syncStatus = 'synced'
        // After sync, scan autopilot contacts for pending messages
        scanAutopilotPendingMessages(state).catch(err =>
          console.error('[WA Autopilot] Scan on connect error:', err)
        )
      }
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

  // Autopilot scan fallback: if connected + synced but no scan has run yet (or >5min ago),
  // trigger a scan. Covers HMR scenarios where ready event already fired before code update.
  if (state.status === 'connected' && state.syncStatus === 'synced' && state.companyId) {
    const lastScan = state.lastAutopilotScan || 0 // Handle undefined for pre-existing states
    const timeSinceLastScan = Date.now() - lastScan
    if (timeSinceLastScan > 5 * 60 * 1000) { // 5 minutes
      console.log(`[WA Autopilot] Heartbeat scan trigger (last scan: ${lastScan === 0 ? 'never' : Math.round(timeSinceLastScan / 1000) + 's ago'})`)
      scanAutopilotPendingMessages(state).catch(err =>
        console.error('[WA Autopilot] Heartbeat scan error:', err)
      )
    }
  }

  // Periodic profile pic refresh (~every 30th heartbeat ≈ every 10 min)
  // Retries contacts that were previously unavailable (privacy changed, new pic added)
  // Also fills in any remaining null pics (new conversations created since last sync)
  if (state.status === 'connected' && state.syncStatus === 'synced' && state.connectionId && Math.random() < 0.033) {
    fetchMissingProfilePics(state, state.connectionId).catch(() => {})
    refreshProfilePics(state, state.connectionId).catch(() => {})
  }

  return true
}

// Exported function to trigger autopilot scan from API routes (e.g. when adding a contact)
export function triggerAutopilotScan(userId: string, specificPhone?: string): void {
  const state = clients.get(userId)
  if (!state || state.status !== 'connected' || !state.companyId) return
  scanAutopilotPendingMessages(state, specificPhone).catch(err =>
    console.error('[WA Autopilot] External scan trigger error:', err)
  )
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

// NOTE: No startup cleanup — DB status is preserved across restarts.
// The /api/whatsapp/status endpoint cleans up stale records when users access FollowUpView.
// The TTL reaper handles in-memory client cleanup for active sessions.

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
    // Allow same phone number on multiple accounts (simultaneous connections)
    if (state.phoneNumber) {
      const { data: existingByPhone } = await supabaseAdmin
        .from('whatsapp_connections')
        .select('id, user_id')
        .eq('phone_number_id', state.phoneNumber)
        .neq('user_id', state.userId)

      if (existingByPhone && existingByPhone.length > 0) {
        console.log(`[WA] Phone ${state.phoneNumber} also connected to ${existingByPhone.length} other user(s) — keeping all`)
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

    // LID chats are now processed normally — resolveContactPhone() handles
    // mapping LID contacts to their real phone numbers

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

    console.log(`[WA] Getting chat list for user ${state.userId}`)

    // Pre-validate connection ID once
    const cachedConnId = await ensureValidConnectionId(state)
    if (!cachedConnId) {
      console.error(`[WA] No valid connection_id for sync, aborting`)
      return
    }

    // Strategy 1: Try fast lightweight sync via page.evaluate()
    // Gets chat metadata directly from WhatsApp's internal store — no serialization overhead
    let usedFastSync = false
    try {
      const page = (client as any).pupPage
      if (page) {
        const lightChats: Array<{
          id: string; name: string | null; isGroup: boolean;
          lastMsgBody: string | null; lastMsgTimestamp: number | null; lastMsgFromMe: boolean;
          unreadCount: number
        }> = await Promise.race([
          page.evaluate(() => {
            try {
              const chats = (window as any).Store?.Chat?.getModelsArray?.() || []
              return chats
                .filter((c: any) => !c.id?._serialized?.includes('status@broadcast'))
                .sort((a: any, b: any) => (b.t || 0) - (a.t || 0))
                .slice(0, 50)
                .map((c: any) => ({
                  id: c.id?._serialized || '',
                  name: c.name || c.formattedTitle || c.contact?.pushname || c.contact?.name || null,
                  isGroup: c.isGroup || false,
                  lastMsgBody: c.lastReceivedKey?.fromMe !== undefined
                    ? (c.msgs?.getModelsArray?.()?.slice(-1)?.[0]?.body || null)
                    : null,
                  lastMsgTimestamp: c.t ? c.t * 1000 : null,
                  lastMsgFromMe: c.lastReceivedKey?.fromMe || false,
                  unreadCount: c.unreadCount || 0
                }))
            } catch { return [] }
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('fast sync timed out')), 15000)
          )
        ])

        if (lightChats.length > 0 && !state.destroyed) {
          console.log(`[WA] Fast sync: ${lightChats.length} chats from Store`)
          let savedCount = 0

          for (const chat of lightChats) {
            if (state.destroyed) break
            try {
              const isGroup = chat.isGroup || chat.id.endsWith('@g.us')
              const isLid = chat.id.endsWith('@lid')
              let contactPhone: string

              if (isGroup) {
                contactPhone = chat.id
              } else if (isLid) {
                contactPhone = `lid_${chat.id.replace('@lid', '')}`
              } else {
                contactPhone = chat.id.replace('@c.us', '')
              }

              await supabaseAdmin
                .from('whatsapp_conversations')
                .upsert({
                  connection_id: cachedConnId,
                  user_id: state.userId,
                  company_id: state.companyId,
                  contact_phone: contactPhone,
                  contact_name: chat.name,
                  last_message_at: chat.lastMsgTimestamp ? new Date(chat.lastMsgTimestamp).toISOString() : null,
                  last_message_preview: chat.lastMsgBody?.substring(0, 200) || null,
                  unread_count: chat.unreadCount,
                  updated_at: new Date().toISOString()
                }, { onConflict: 'connection_id,contact_phone' })

              savedCount++
            } catch (err: any) {
              // Skip individual chat errors silently
            }
          }

          console.log(`[WA] Fast sync saved ${savedCount}/${lightChats.length} conversations for user ${state.userId}`)
          usedFastSync = true

          // Background: fetch profile pics
          if (!state.destroyed) {
            fetchMissingProfilePics(state, cachedConnId).catch(() => {})
          }
        }
      }
    } catch (err: any) {
      console.log(`[WA] Fast sync failed: ${err.message}. Falling back to getChats...`)
    }

    // Strategy 2: Full sync with getChats() — gets messages too
    // If fast sync worked, run this in background for message history
    // If fast sync failed, this is the only sync
    if (!state.destroyed) {
      try {
        const allChats = await Promise.race([
          client.getChats(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('getChats timed out after 60s')), 60000)
          )
        ])

        if (state.destroyed) return

        const filteredChats = allChats
          .filter((c: any) => {
            const id = c.id?._serialized || ''
            return !id.includes('status@broadcast')
          })
          .slice(0, 40)

        const groupCount = filteredChats.filter((c: any) => c.isGroup).length
        const lidCount = filteredChats.filter((c: any) => (c.id?._serialized || '').endsWith('@lid')).length
        console.log(`[WA] Found ${allChats.length} total chats. Syncing ${filteredChats.length} (${groupCount} groups, ${lidCount} LID)...`)

        if (filteredChats.length === 0) return

        // Process chats in parallel batches of 5
        const BATCH_SIZE = 5
        let contextDead = false
        let processedCount = 0
        const startTime = Date.now()

        for (let batchStart = 0; batchStart < filteredChats.length; batchStart += BATCH_SIZE) {
          if (state.destroyed || contextDead) break

          const batch = filteredChats.slice(batchStart, batchStart + BATCH_SIZE)
          const results = await Promise.allSettled(
            batch.map(async (chat: any) => {
              const isGroup = chat.isGroup || (chat.id?._serialized || '').endsWith('@g.us')
              await processSingleChat(chat, state, isGroup, cachedConnId, true)
            })
          )

          for (let j = 0; j < results.length; j++) {
            const result = results[j]
            if (result.status === 'rejected') {
              const errMsg = result.reason?.message || String(result.reason)
              if (errMsg.includes('Execution context was destroyed') || errMsg.includes('context destroyed') || errMsg.includes('Target closed')) {
                contextDead = true
                break
              }
            } else {
              processedCount++
            }
          }
        }

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
        console.log(`[WA] Full sync complete for user ${state.userId}: ${processedCount}/${filteredChats.length} chats in ${elapsed}s`)

        if (!state.destroyed && !usedFastSync) {
          fetchMissingProfilePics(state, cachedConnId).catch(() => {})
        }
      } catch (err: any) {
        // If fast sync already populated conversations, don't throw — just log
        if (usedFastSync) {
          console.log(`[WA] getChats failed but fast sync already loaded conversations: ${err.message}`)
          return
        }
        throw err
      }
    }
  } catch (error) {
    if (state.destroyed) return
    console.error('[WA] Error syncing:', error)
    throw error
  }
}

// Background task: fetch profile pics for conversations that don't have one yet
// Runs after initial sync and periodically via heartbeat to fill in missing pics
// Uses empty string '' to mark contacts where pic is unavailable (privacy/no pic)
// so they're not retried endlessly — null = never attempted, '' = attempted but unavailable
async function fetchMissingProfilePics(state: ClientState, connectionId: string): Promise<void> {
  try {
    // Fetch ALL conversations without profile pic (null = never attempted)
    const { data: convs } = await supabaseAdmin
      .from('whatsapp_conversations')
      .select('contact_phone')
      .eq('connection_id', connectionId)
      .is('profile_pic_url', null)

    if (!convs || convs.length === 0) return
    console.log(`[WA] Fetching profile pics for ${convs.length} conversations...`)

    let fetched = 0
    let unavailable = 0
    for (let i = 0; i < convs.length; i++) {
      if (state.destroyed) break
      const conv = convs[i]
      try {
        let picUrl: string | undefined
        if (conv.contact_phone.includes('@')) {
          picUrl = await state.client.getProfilePicUrl(conv.contact_phone)
        } else if (conv.contact_phone.startsWith('lid_')) {
          const lidNum = conv.contact_phone.replace(/^lid_/, '')
          try { picUrl = await state.client.getProfilePicUrl(`${lidNum}@lid`) } catch {}
          if (!picUrl) {
            try { picUrl = await state.client.getProfilePicUrl(`${lidNum}@c.us`) } catch {}
          }
        } else {
          picUrl = await state.client.getProfilePicUrl(`${conv.contact_phone}@c.us`)
        }

        // Save pic URL or mark as '' (unavailable) to avoid re-fetching
        await supabaseAdmin
          .from('whatsapp_conversations')
          .update({ profile_pic_url: picUrl || '' })
          .eq('connection_id', connectionId)
          .eq('contact_phone', conv.contact_phone)

        if (picUrl) fetched++
        else unavailable++
      } catch {
        // On error, mark as '' so we don't retry endlessly
        try {
          await supabaseAdmin
            .from('whatsapp_conversations')
            .update({ profile_pic_url: '' })
            .eq('connection_id', connectionId)
            .eq('contact_phone', conv.contact_phone)
        } catch {}
        unavailable++
      }

      // Small delay every 3 contacts to avoid WhatsApp rate limiting
      if (i % 3 === 2) await new Promise(r => setTimeout(r, 200))
    }
    console.log(`[WA] Profile pics done: ${fetched} fetched, ${unavailable} unavailable, ${convs.length} total`)
  } catch (err) {
    console.error('[WA] Error fetching profile pics:', err)
  }
}

// Periodic refresh: retry contacts marked as '' (unavailable) in case they updated their pic
// Also refreshes stale URLs (WhatsApp CDN URLs expire). Runs every ~10 min via heartbeat.
async function refreshProfilePics(state: ClientState, connectionId: string): Promise<void> {
  try {
    // Get conversations with empty string (previously unavailable) — retry them
    const { data: convs } = await supabaseAdmin
      .from('whatsapp_conversations')
      .select('contact_phone')
      .eq('connection_id', connectionId)
      .eq('profile_pic_url', '')
      .limit(20)

    if (!convs || convs.length === 0) return
    console.log(`[WA] Refreshing profile pics for ${convs.length} previously-unavailable contacts...`)

    let updated = 0
    for (const conv of convs) {
      if (state.destroyed) break
      try {
        let picUrl: string | undefined
        if (conv.contact_phone.includes('@')) {
          picUrl = await state.client.getProfilePicUrl(conv.contact_phone)
        } else if (conv.contact_phone.startsWith('lid_')) {
          const lidNum = conv.contact_phone.replace(/^lid_/, '')
          try { picUrl = await state.client.getProfilePicUrl(`${lidNum}@lid`) } catch {}
          if (!picUrl) {
            try { picUrl = await state.client.getProfilePicUrl(`${lidNum}@c.us`) } catch {}
          }
        } else {
          picUrl = await state.client.getProfilePicUrl(`${conv.contact_phone}@c.us`)
        }
        if (picUrl) {
          await supabaseAdmin
            .from('whatsapp_conversations')
            .update({ profile_pic_url: picUrl })
            .eq('connection_id', connectionId)
            .eq('contact_phone', conv.contact_phone)
          updated++
        }
      } catch {}
      await new Promise(r => setTimeout(r, 200))
    }
    if (updated > 0) console.log(`[WA] Refreshed ${updated} profile pics`)
  } catch (err) {
    console.error('[WA] Error refreshing profile pics:', err)
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

      // Always try to fetch profile pic (for both inbound and outbound messages)
      try {
        profilePicUrl = await state.client.getProfilePicUrl(chat.id._serialized) || null
      } catch {}

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
            transcribeAudioMessage(buffer, msg.id._serialized, state.userId, {
              state, contactPhone, contactName, fromMe, isGroup
            }).catch(() => {})
          }
        }
      } catch (err) {
        console.error('[WA] Failed to download/save media:', err)
      }
    }

    // Extract quoted message info if present
    let quotedMsgData: { body: string; fromMe: boolean; type: string; contactName?: string | null } | null = null
    try {
      if (msg.hasQuotedMsg) {
        const quotedMsg = await msg.getQuotedMessage()
        if (quotedMsg) {
          quotedMsgData = {
            body: quotedMsg.body || '',
            fromMe: quotedMsg.fromMe,
            type: quotedMsg.type || 'text',
            contactName: null
          }
          // Try to get quoted message sender name (for group chats)
          try {
            const qContact = await quotedMsg.getContact()
            quotedMsgData.contactName = qContact?.name || qContact?.pushname || null
          } catch {}
        }
      }
    } catch (err) {
      console.error('[WA] Failed to get quoted message:', err)
    }

    // Ensure connection_id is still valid (prevents FK violations after reconnection)
    const validConnId = await ensureValidConnectionId(state)
    if (!validConnId) {
      console.error(`[WA] No valid connection_id for user ${state.userId}, dropping message`)
      return
    }

    // Insert message and upsert conversation in parallel
    const rawPayload: any = { type: msg.type, hasMedia: msg.hasMedia, from: msg.from, to: msg.to, original_chat_id: chat.id._serialized, is_lid: isLidContact, is_group: isGroup }
    if (quotedMsgData) {
      rawPayload.quotedMsg = quotedMsgData
    }

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
        raw_payload: rawPayload
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
    // NOTE: This fires for ALL outbound messages including autopilot.
    // Autopilot messages are detected via autopilotSentMsgIds and flagged is_autopilot=true
    // in seller_message_tracking. This feeds the shared RAG pipeline for both copilot and autopilot.
    if (messageType === 'text' && content && !isGroup) {
      if (fromMe) {
        // Detect if this is an autopilot-sent message
        const isAutopilotMsg = autopilotSentMsgIds.has(msg.id._serialized)
        // Track for outcome analysis (both seller and autopilot messages)
        trackSellerMessage(state, contactPhone, contactName, content, msgTimestamp, isAutopilotMsg).catch((err: any) =>
          console.error('[WA] trackSellerMessage error:', err.message || err)
        )
      } else {
        // Client responded → trigger automatic outcome analysis
        triggerOutcomeAnalysis(state, contactPhone, content).catch((err: any) =>
          console.error('[WA] triggerOutcomeAnalysis error:', err.message || err)
        )
      }
    }

    // === AUTOPILOT HOOKS (non-blocking, text only, skip groups) ===
    if (messageType === 'text' && content && !isGroup) {
      // Skip autopilot-sent messages to prevent complement loops
      const msgSerializedId = msg.id._serialized
      if (fromMe && autopilotSentMsgIds.has(msgSerializedId)) {
        console.log(`[WA Autopilot] Skipping own autopilot message ${msgSerializedId} — no complement loop`)
      } else if (!fromMe) {
        // Lead sent a message → debounce and respond
        console.log(`[WA Autopilot] Hook triggered for ${contactPhone} (${contactName}): "${content.slice(0, 50)}"`)
        pushAutopilotEvent('message_detected', state.userId, contactPhone, contactName, `Lead: "${content.slice(0, 80)}"`)
        debounceAutopilotResponse(state, contactPhone, contactName, content)
      } else {
        // Seller sent a message — but check if autopilot recently responded (race condition guard)
        const pSuffix = contactPhone.replace(/\D/g, '').slice(-9)
        const recentKey = `${state.userId}:${pSuffix}`
        const lastAutoResp = autopilotRecentResponses.get(recentKey)
        if (lastAutoResp && Date.now() - lastAutoResp < 120_000) {
          console.log(`[WA Autopilot] Skipping complement for ${contactPhone}: autopilot responded ${Math.round((Date.now() - lastAutoResp) / 1000)}s ago (likely autopilot's own msg)`)
        } else {
          // Seller sent a message (NOT from autopilot) → check if complement needed
          console.log(`[WA Autopilot Complement] Seller msg detected for ${contactPhone}, checking in 10s`)
          pushAutopilotEvent('complement_detected', state.userId, contactPhone, contactName, `Vendedor enviou msg, checando complemento em 10s`)
          setTimeout(() => {
            triggerAutopilotResponse(state, contactPhone, contactName, content, 'complement').catch((err: any) =>
              console.error('[WA Autopilot Complement] error:', err.message || err)
            )
          }, 10_000)
        }
      }
    } else if (!fromMe && !isGroup) {
      console.log(`[WA Autopilot] Hook skipped: messageType=${messageType}, hasContent=${!!content}`)
    }
  } catch (error) {
    console.error(`[WA] Error handling message:`, error)
  }
}

// === AUTOPILOT ===

// Cache autopilot config in globalThis to survive HMR
export interface AutopilotEvent {
  id: string
  type: 'message_detected' | 'debounce_started' | 'debounce_reset' | 'debounce_fired' |
        'complement_detected' | 'processing' | 'waiting_delay' | 'response_sent' |
        'response_skipped' | 'flagged_human' | 'objective_reached'
  contactPhone: string
  contactName: string | null
  detail: string
  timestamp: number
  userId: string
}

const AUTOPILOT_MAX_EVENTS = 100

const globalForAutopilot = globalThis as unknown as {
  autopilotConfigCache?: Map<string, { config: any; fetchedAt: number }>
  autopilotDebounceTimers?: Map<string, NodeJS.Timeout>
  autopilotPendingMessages?: Map<string, string[]>
  autopilotEvents?: AutopilotEvent[]
  autopilotInFlight?: Set<string>  // Per-contact lock to prevent concurrent responses
  autopilotRecentResponses?: Map<string, number>  // Tracks when a contact was last responded to
}
if (!globalForAutopilot.autopilotConfigCache) {
  globalForAutopilot.autopilotConfigCache = new Map()
}
if (!globalForAutopilot.autopilotDebounceTimers) {
  globalForAutopilot.autopilotDebounceTimers = new Map()
}
if (!globalForAutopilot.autopilotPendingMessages) {
  globalForAutopilot.autopilotPendingMessages = new Map()
}
if (!globalForAutopilot.autopilotEvents) {
  globalForAutopilot.autopilotEvents = []
}
if (!globalForAutopilot.autopilotInFlight) {
  globalForAutopilot.autopilotInFlight = new Set()
}
if (!globalForAutopilot.autopilotRecentResponses) {
  globalForAutopilot.autopilotRecentResponses = new Map()
}
const autopilotEvents = globalForAutopilot.autopilotEvents
const autopilotInFlight = globalForAutopilot.autopilotInFlight
const autopilotRecentResponses = globalForAutopilot.autopilotRecentResponses

export function pushAutopilotEvent(
  type: AutopilotEvent['type'],
  userId: string,
  contactPhone: string,
  contactName: string | null,
  detail: string
): void {
  const event: AutopilotEvent = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    type,
    contactPhone,
    contactName,
    detail,
    timestamp: Date.now(),
    userId
  }
  autopilotEvents.push(event)
  // Prune old events
  if (autopilotEvents.length > AUTOPILOT_MAX_EVENTS) {
    autopilotEvents.splice(0, autopilotEvents.length - AUTOPILOT_MAX_EVENTS)
  }
}

export function getAutopilotEvents(userId: string, since?: number): AutopilotEvent[] {
  return autopilotEvents.filter(e =>
    e.userId === userId && (!since || e.timestamp > since)
  )
}
const autopilotCache = globalForAutopilot.autopilotConfigCache
const autopilotTimers = globalForAutopilot.autopilotDebounceTimers
const autopilotPendingMsgs = globalForAutopilot.autopilotPendingMessages

async function getAutopilotConfig(userId: string): Promise<any | null> {
  const cached = autopilotCache.get(userId)
  if (cached && Date.now() - cached.fetchedAt < 30000) {
    console.log(`[WA Autopilot] Config from cache for ${userId}: enabled=${cached.config?.enabled}`)
    return cached.config
  }

  const { data: configs, error } = await supabaseAdmin
    .from('autopilot_config')
    .select('*')
    .eq('user_id', userId)
    .limit(1)

  if (error) {
    console.error(`[WA Autopilot] Config query error:`, error.message)
    return null
  }

  const config = configs?.[0] || null
  console.log(`[WA Autopilot] Config loaded for ${userId}: enabled=${config?.enabled}, has_instructions=${!!config?.custom_instructions}`)
  autopilotCache.set(userId, { config, fetchedAt: Date.now() })
  return config
}

const AUTOPILOT_DEBOUNCE_MS = 5_000 // 5s — short window to group rapid messages (e.g. "oi" + "tudo bem?")

function debounceAutopilotResponse(
  state: ClientState,
  contactPhone: string,
  contactName: string | null,
  incomingMessage: string
): void {
  const key = `${state.userId}:${contactPhone}`

  // Accumulate messages
  const pending = autopilotPendingMsgs.get(key) || []
  pending.push(incomingMessage)
  autopilotPendingMsgs.set(key, pending)

  // Clear existing timer (reset countdown)
  const existingTimer = autopilotTimers.get(key)
  if (existingTimer) {
    clearTimeout(existingTimer)
    console.log(`[WA Autopilot] Debounce reset for ${contactPhone} (${pending.length} msgs accumulated)`)
    pushAutopilotEvent('debounce_reset', state.userId, contactPhone, contactName, `Timer resetado — ${pending.length} msg(s) acumuladas`)
  } else {
    pushAutopilotEvent('debounce_started', state.userId, contactPhone, contactName, `Timer de 5s iniciado`)
  }

  // Set new timer — fires after 5s of no new messages
  const timer = setTimeout(() => {
    autopilotTimers.delete(key)
    const messages = autopilotPendingMsgs.get(key) || []
    autopilotPendingMsgs.delete(key)

    // No recently-responded check here — if the lead sent NEW messages after a response,
    // the debounce accumulated them and they MUST be processed. The in-flight lock in
    // triggerAutopilotResponse prevents true concurrent duplicates.

    // Join all accumulated messages into one block
    const combinedMessage = messages.join('\n')
    console.log(`[WA Autopilot] Debounce fired for ${contactPhone}: ${messages.length} msg(s) combined`)
    pushAutopilotEvent('debounce_fired', state.userId, contactPhone, contactName, `Debounce disparou — ${messages.length} msg(s), processando...`)

    triggerAutopilotResponse(state, contactPhone, contactName, combinedMessage).catch((err: any) =>
      console.error('[WA Autopilot] error:', err.message || err)
    )
  }, AUTOPILOT_DEBOUNCE_MS)

  autopilotTimers.set(key, timer)
  console.log(`[WA Autopilot] Debounce set for ${contactPhone}: will fire in ${AUTOPILOT_DEBOUNCE_MS / 1000}s (${pending.length} msg(s) queued)`)
}

async function triggerAutopilotResponse(
  state: ClientState,
  contactPhone: string,
  contactName: string | null,
  incomingMessage: string,
  mode: 'respond' | 'complement' = 'respond'
): Promise<void> {
  // 0. Per-contact deduplication: prevent concurrent and duplicate responses
  const phoneSuffix = contactPhone.replace(/\D/g, '').slice(-9)
  const lockKey = `${state.userId}:${phoneSuffix}`

  // Check if already processing this contact (in-flight lock)
  if (autopilotInFlight.has(lockKey)) {
    console.log(`[WA Autopilot] Skipping ${contactPhone} (${mode}): already in-flight`)
    pushAutopilotEvent('response_skipped', state.userId, contactPhone, contactName, `Já em processamento (in-flight lock)`)
    return
  }

  // Check if recently responded to this contact (within 15s — only to prevent true duplicate triggers)
  const lastResponse = autopilotRecentResponses.get(lockKey)
  if (lastResponse && Date.now() - lastResponse < 15_000) {
    console.log(`[WA Autopilot] Skipping ${contactPhone} (${mode}): responded ${Math.round((Date.now() - lastResponse) / 1000)}s ago`)
    pushAutopilotEvent('response_skipped', state.userId, contactPhone, contactName, `Respondido há ${Math.round((Date.now() - lastResponse) / 1000)}s — ignorando duplicata`)
    return
  }

  // Acquire in-flight lock
  autopilotInFlight.add(lockKey)

  try {
    // 1. Quick check: is autopilot enabled?
    const config = await getAutopilotConfig(state.userId)
    if (!config?.enabled) {
      console.log(`[WA Autopilot] Skipped: config not enabled (config=${JSON.stringify(config ? { enabled: config.enabled } : null)})`)
      pushAutopilotEvent('response_skipped', state.userId, contactPhone, contactName, 'Config desativada')
      return
    }
    console.log(`[WA Autopilot] Config enabled, companyId=${state.companyId}`)

    if (!state.companyId) {
      console.error(`[WA Autopilot] No companyId in state for user ${state.userId}`)
      pushAutopilotEvent('response_skipped', state.userId, contactPhone, contactName, 'Sem companyId')
      return
    }

    // 2. Is this contact monitored?
    const { data: contacts, error: contactsErr } = await supabaseAdmin
      .from('autopilot_contacts')
      .select('contact_phone, enabled, needs_human, objective_reached')
      .eq('user_id', state.userId)

    if (contactsErr) {
      console.error(`[WA Autopilot] Contacts query error:`, contactsErr.message)
      return
    }
    console.log(`[WA Autopilot] Found ${contacts?.length || 0} monitored contacts. Phone: ${contactPhone}, suffix: ${phoneSuffix}`)

    const contact = contacts?.find(c => {
      const cSuffix = c.contact_phone.replace(/@.*$/, '').replace(/\D/g, '').slice(-9)
      return cSuffix === phoneSuffix
    })

    if (!contact?.enabled) {
      if (!contact) {
        console.log(`[WA Autopilot] Contact ${contactPhone} NOT matched to any monitored contact`)
        pushAutopilotEvent('response_skipped', state.userId, contactPhone, contactName, 'Contato não monitorado')
      } else {
        console.log(`[WA Autopilot] Contact ${contactPhone} is disabled`)
        pushAutopilotEvent('response_skipped', state.userId, contactPhone, contactName, 'Contato desativado')
      }
      return
    }
    if (contact.objective_reached) {
      console.log(`[WA Autopilot] Contact ${contactPhone} objective already reached — skipping`)
      pushAutopilotEvent('response_skipped', state.userId, contactPhone, contactName, 'Objetivo já alcançado')
      return
    }
    // Auto-clear needs_human when the LEAD sends a new message (context changed, AI should re-evaluate)
    // But still skip complements for needs_human contacts (seller should handle manually)
    if (contact.needs_human && mode === 'respond') {
      console.log(`[WA Autopilot] Contact ${contactPhone} was needs_human, but lead sent new msg — auto-clearing and re-evaluating`)
      pushAutopilotEvent('message_detected', state.userId, contactPhone, contactName, 'Lead enviou nova msg — needs_human limpo automaticamente')
      Promise.resolve(
        supabaseAdmin
          .from('autopilot_contacts')
          .update({ needs_human: false, needs_human_reason: null, needs_human_at: null })
          .eq('user_id', state.userId)
          .eq('contact_phone', contact.contact_phone)
      ).catch(err => console.error(`[WA Autopilot] Failed to clear needs_human:`, err))
      // Also clear the conversation indicator
      Promise.resolve(
        supabaseAdmin
          .from('whatsapp_conversations')
          .update({ autopilot_needs_human: false })
          .like('contact_phone', `%${phoneSuffix}`)
      ).catch(() => {})
    } else if (contact.needs_human) {
      console.log(`[WA Autopilot] Contact ${contactPhone} flagged as needs_human — skipping complement`)
      return
    }
    console.log(`[WA Autopilot] Contact ${contactPhone} matched to monitored: ${contact.contact_phone}`)

    // 3. Apply random delay for natural feel (capped at 30s to prevent excessive waits)
    const settings = config.settings || {}
    const delayMin = Math.min((settings.response_delay_min || 20), 30) * 1000
    const delayMax = Math.min((settings.response_delay_max || 15), 30) * 1000
    const delay = delayMin + Math.random() * (delayMax - delayMin)
    const delaySec = Math.round(delay / 1000)
    console.log(`[WA Autopilot] Waiting ${delaySec}s before responding to ${contactPhone}`)
    pushAutopilotEvent('waiting_delay', state.userId, contactPhone, contactName, `Aguardando ${delaySec}s antes de responder`)
    await new Promise(resolve => setTimeout(resolve, delay))

    // Re-check: another trigger might have responded during the delay
    const lastResponseAfterDelay = autopilotRecentResponses.get(lockKey)
    if (lastResponseAfterDelay && Date.now() - lastResponseAfterDelay < 15_000) {
      console.log(`[WA Autopilot] Skipping ${contactPhone} (${mode}): another trigger responded during delay (${Math.round((Date.now() - lastResponseAfterDelay) / 1000)}s ago)`)
      pushAutopilotEvent('response_skipped', state.userId, contactPhone, contactName, 'Já respondido por outro trigger')
      return
    }

    pushAutopilotEvent('processing', state.userId, contactPhone, null, `Enviando para IA processar (${mode})`)

    // Pre-mark as recently responded BEFORE the API call.
    // This prevents message_create events (fired during sendMessage) from triggering
    // complement checks — the autopilot's own outbound messages would otherwise be
    // mistaken for seller messages due to a race condition with autopilotSentMsgIds.
    autopilotRecentResponses.set(lockKey, Date.now())
    setTimeout(() => autopilotRecentResponses.delete(lockKey), 60_000)

    // 4. Call the autopilot respond API (always use localhost for internal server-to-server call)
    const port = process.env.PORT || 3000
    const baseUrl = `http://localhost:${port}`
    const response = await fetch(`${baseUrl}/api/autopilot/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: state.userId,
        contactPhone,
        contactName,
        incomingMessage: incomingMessage.slice(0, 2000),
        companyId: state.companyId,
        mode
      })
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      console.error(`[WA Autopilot] API responded ${response.status}: ${errText.slice(0, 300)}`)
      pushAutopilotEvent('response_skipped', state.userId, contactPhone, contactName, `Erro API: ${response.status}`)
      return
    }
    const result = await response.json()
    console.log(`[WA Autopilot] ${contactPhone}: action=${result.action}, reason=${result.reason || 'n/a'}`)

    // Refresh the recently-responded timestamp after success
    if (result.action === 'responded' || result.action === 'complemented' || result.action === 'objective_reached') {
      autopilotRecentResponses.set(lockKey, Date.now())
    }
  } catch (err: any) {
    console.error(`[WA Autopilot] API call failed:`, err.message || err)
    pushAutopilotEvent('response_skipped', state.userId, contactPhone, contactName, `Erro: ${(err as any).message?.slice(0, 80) || 'unknown'}`)
  } finally {
    // Always release the in-flight lock
    autopilotInFlight.delete(lockKey)
  }
}

// Scan all monitored contacts for pending messages (inbound without response, outbound without complement)
// Called on WhatsApp connect and can be triggered externally
async function scanAutopilotPendingMessages(state: ClientState, specificPhone?: string): Promise<void> {
  const { userId, companyId } = state
  if (!companyId) {
    console.log(`[WA Autopilot Scan] No companyId for user ${userId}, skipping`)
    return
  }

  // Check if autopilot is enabled
  const config = await getAutopilotConfig(userId)
  if (!config?.enabled) {
    console.log(`[WA Autopilot Scan] Autopilot not enabled for user ${userId}`)
    return
  }

  // Mark scan timestamp to prevent duplicate scans
  state.lastAutopilotScan = Date.now()

  pushAutopilotEvent('processing', userId, specificPhone || '', null, specificPhone ? `Escaneando contato ${specificPhone}...` : 'Escaneando conversas pendentes...')

  // Get monitored contacts (optionally filtered to a specific phone)
  let query = supabaseAdmin
    .from('autopilot_contacts')
    .select('contact_phone, contact_name, enabled, needs_human, objective_reached')
    .eq('user_id', userId)
    .eq('enabled', true)

  if (specificPhone) {
    query = query.eq('contact_phone', specificPhone)
  }

  const { data: contacts, error } = await query

  if (error || !contacts || contacts.length === 0) {
    console.log(`[WA Autopilot Scan] No monitored contacts for user ${userId}${specificPhone ? ` (phone: ${specificPhone})` : ''}`)
    return
  }

  // Include needs_human contacts — they'll be auto-cleared if last msg is inbound (lead sent new msg)
  // Only skip objective_reached contacts
  const activeContacts = contacts.filter(c => !c.objective_reached)
  console.log(`[WA Autopilot Scan] Checking ${activeContacts.length} contacts for pending messages`)

  for (const contact of activeContacts) {
    try {
      const phoneSuffix = contact.contact_phone.replace(/@.*$/, '').replace(/\D/g, '').slice(-9)
      const lockKey = `${userId}:${phoneSuffix}`

      // Skip if already being processed by another trigger
      if (autopilotInFlight.has(lockKey)) {
        console.log(`[WA Autopilot Scan] Skipping ${contact.contact_phone}: already in-flight`)
        continue
      }

      // Skip if recently responded (within 2 minutes)
      const lastResp = autopilotRecentResponses.get(lockKey)
      if (lastResp && Date.now() - lastResp < 120_000) {
        console.log(`[WA Autopilot Scan] Skipping ${contact.contact_phone}: responded ${Math.round((Date.now() - lastResp) / 1000)}s ago`)
        continue
      }

      // Skip if debounce timer already active for this contact
      const debounceKey = `${userId}:${contact.contact_phone}`
      if (autopilotTimers.has(debounceKey)) {
        console.log(`[WA Autopilot Scan] Skipping ${contact.contact_phone}: debounce timer already active`)
        continue
      }

      // Get last message for this contact
      const { data: lastMsgs } = await supabaseAdmin
        .from('whatsapp_messages')
        .select('direction, content, message_timestamp')
        .eq('user_id', userId)
        .like('contact_phone', `%${phoneSuffix}`)
        .order('message_timestamp', { ascending: false })
        .limit(1)

      const lastMsg = lastMsgs?.[0]
      if (!lastMsg || !lastMsg.content) continue

      if (lastMsg.direction === 'inbound') {
        // Lead sent message, no response yet → trigger autopilot respond
        console.log(`[WA Autopilot Scan] ${contact.contact_phone}: last msg is INBOUND, triggering respond`)
        pushAutopilotEvent('message_detected', userId, contact.contact_phone, contact.contact_name, `Scan: msg pendente do lead detectada`)
        // Use debounce to respect the normal flow
        debounceAutopilotResponse(state, contact.contact_phone, contact.contact_name, lastMsg.content)
      } else if (lastMsg.direction === 'outbound' && !contact.needs_human) {
        // Seller sent message → check if complement needed (skip if needs_human — seller should handle)
        console.log(`[WA Autopilot Scan] ${contact.contact_phone}: last msg is OUTBOUND, triggering complement check`)
        pushAutopilotEvent('complement_detected', userId, contact.contact_phone, contact.contact_name, `Scan: checando complemento`)
        triggerAutopilotResponse(state, contact.contact_phone, contact.contact_name, lastMsg.content, 'complement').catch(err =>
          console.error(`[WA Autopilot Scan] Complement error for ${contact.contact_phone}:`, err)
        )
      }

      // Small delay between contacts to not overload
      await new Promise(r => setTimeout(r, 1000))
    } catch (err) {
      console.error(`[WA Autopilot Scan] Error checking ${contact.contact_phone}:`, err)
    }
  }

  console.log(`[WA Autopilot Scan] Scan complete for user ${userId}`)
}

// Send a message from the autopilot (called by /api/autopilot/respond)
export async function sendAutopilotMessage(
  userId: string,
  contactPhone: string,
  message: string
): Promise<{ success: boolean; messageId?: string }> {
  const client = getConnectedClient(userId)
  if (!client) {
    console.error(`[WA Autopilot] No connected client for user ${userId}`)
    return { success: false }
  }

  try {
    // Resolve chat ID
    let chatId: string

    if (contactPhone.startsWith('lid_')) {
      chatId = `${contactPhone.replace('lid_', '')}@lid`
    } else if (contactPhone.includes('@')) {
      chatId = contactPhone
    } else {
      // Try to find original chat ID from recent message
      const { data: recentMessage } = await supabaseAdmin
        .from('whatsapp_messages')
        .select('raw_payload')
        .eq('user_id', userId)
        .eq('contact_phone', contactPhone)
        .order('message_timestamp', { ascending: false })
        .limit(1)
        .single()

      if (recentMessage?.raw_payload?.original_chat_id) {
        chatId = recentMessage.raw_payload.original_chat_id
      } else {
        const digits = contactPhone.replace(/[^0-9]/g, '')
        // Try getNumberId for proper resolution
        try {
          const numberId = await client.getNumberId(`${digits}@c.us`)
          chatId = numberId ? numberId._serialized : `${digits}@c.us`
        } catch {
          chatId = `${digits}@c.us`
        }
      }
    }

    // Anti-ban: typing simulation
    try {
      const chat = await client.getChatById(chatId)
      await chat.sendStateTyping()
    } catch {}

    const typingDelay = 2000 + Math.random() * 2000
    await new Promise(resolve => setTimeout(resolve, typingDelay))

    // Send with timeout
    const sentMsg = await Promise.race([
      client.sendMessage(chatId, message),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('sendMessage timeout (15s)')), 15000))
    ])

    const msgId = sentMsg.id._serialized
    console.log(`[WA Autopilot] Message sent to ${contactPhone}, ID: ${msgId}`)

    // Track this message ID so the message_create event won't trigger another complement
    autopilotSentMsgIds.add(msgId)
    // Auto-clean after 2 minutes to prevent memory leak
    setTimeout(() => autopilotSentMsgIds.delete(msgId), 120_000)

    return { success: true, messageId: msgId }
  } catch (err: any) {
    console.error(`[WA Autopilot] Send failed:`, err.message || err)
    return { success: false }
  }
}

// === AUDIO TRANSCRIPTION (Whisper) ===

async function transcribeAudioMessage(
  mediaBuffer: Buffer,
  messageId: string,
  userId: string,
  autopilotCtx?: { state: ClientState; contactPhone: string; contactName: string | null; fromMe: boolean; isGroup: boolean }
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

    // Trigger autopilot for incoming audio messages after transcription
    if (autopilotCtx && !autopilotCtx.fromMe && !autopilotCtx.isGroup) {
      console.log(`[WA Autopilot] Audio transcribed for ${autopilotCtx.contactPhone}: "${text.slice(0, 50)}"`)
      pushAutopilotEvent('message_detected', autopilotCtx.state.userId, autopilotCtx.contactPhone, autopilotCtx.contactName, `Lead (áudio): "${text.slice(0, 80)}"`)
      debounceAutopilotResponse(autopilotCtx.state, autopilotCtx.contactPhone, autopilotCtx.contactName, text)
    }
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
  msgTimestamp: Date,
  isAutopilot: boolean = false
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
      message_timestamp: msgTimestamp.toISOString(),
      is_autopilot: isAutopilot
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
