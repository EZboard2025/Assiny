import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export type CommandType = 'send_text' | 'send_media' | 'navigate_to_contact' | 'press_enter' | 'delete_message' | 'edit_message' | 'forward_message' | 'react_message'

export interface DesktopCommand {
  id: string
  user_id: string
  command_type: CommandType
  payload: Record<string, any>
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  result: Record<string, any> | null
  error_message: string | null
  created_at: string
  completed_at: string | null
  expires_at: string
}

/**
 * Insert a command into the desktop command queue.
 * Returns the command ID for polling.
 */
export async function insertCommand(
  userId: string,
  commandType: CommandType,
  payload: Record<string, any>
): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('desktop_commands')
    .insert({
      user_id: userId,
      command_type: commandType,
      payload,
      status: 'pending',
    })
    .select('id')
    .single()

  if (error || !data) {
    throw new Error(`Failed to insert command: ${error?.message || 'unknown'}`)
  }

  return data.id
}

/**
 * Fetch pending commands for a user (called by desktop heartbeat).
 * Atomically marks them as 'in_progress' to prevent double-execution.
 */
export async function claimPendingCommands(userId: string): Promise<DesktopCommand[]> {
  // Fetch pending non-expired commands
  const { data: pending, error: fetchError } = await supabaseAdmin
    .from('desktop_commands')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: true })
    .limit(10)

  if (fetchError || !pending || pending.length === 0) {
    return []
  }

  // Mark as in_progress atomically
  const ids = pending.map(c => c.id)
  await supabaseAdmin
    .from('desktop_commands')
    .update({ status: 'in_progress' })
    .in('id', ids)

  return pending as DesktopCommand[]
}

/**
 * Report command completion from desktop.
 */
export async function completeCommand(
  commandId: string,
  result: Record<string, any> | null = null,
  errorMessage: string | null = null
): Promise<void> {
  await supabaseAdmin
    .from('desktop_commands')
    .update({
      status: errorMessage ? 'failed' : 'completed',
      result,
      error_message: errorMessage,
      completed_at: new Date().toISOString(),
    })
    .eq('id', commandId)
}

/**
 * Wait for a command to complete (polling).
 * Used by API routes that need to wait for desktop execution.
 */
export async function waitForCommandCompletion(
  commandId: string,
  timeoutMs: number = 30000,
  pollIntervalMs: number = 500
): Promise<{ success: boolean; result?: Record<string, any>; error?: string }> {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    const { data, error } = await supabaseAdmin
      .from('desktop_commands')
      .select('status, result, error_message')
      .eq('id', commandId)
      .single()

    if (error || !data) {
      return { success: false, error: 'Command not found' }
    }

    if (data.status === 'completed') {
      return { success: true, result: data.result }
    }

    if (data.status === 'failed') {
      return { success: false, error: data.error_message || 'Command failed' }
    }

    // Still pending or in_progress — wait and retry
    await new Promise(r => setTimeout(r, pollIntervalMs))
  }

  return { success: false, error: 'Desktop não respondeu a tempo. Verifique se o app está aberto.' }
}

/**
 * Check if a user has an active desktop connection (recent heartbeat).
 */
export async function isDesktopConnected(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('whatsapp_connections')
    .select('id, connected_at')
    .eq('user_id', userId)
    .like('phone_number_id', 'desktop_%')
    .eq('status', 'active')
    .single()

  if (!data) return false

  // Check if heartbeat is recent (within 60s — heartbeat interval is 10s, allow buffer)
  const connectedAt = new Date(data.connected_at).getTime()
  return Date.now() - connectedAt < 60_000
}

/**
 * Cleanup expired and old commands.
 */
export async function cleanupCommands(): Promise<void> {
  await supabaseAdmin.rpc('cleanup_old_desktop_commands')
}
