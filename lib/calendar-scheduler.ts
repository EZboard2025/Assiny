/**
 * Background scheduler for auto-sending bots to Google Meet meetings.
 * Uses globalThis to persist across Next.js HMR reloads.
 * Runs every 2 minutes, checks for meetings starting within 5 minutes.
 */

const SCHEDULE_INTERVAL = 2 * 60 * 1000 // 2 minutes
const SYNC_INTERVAL = 15 * 60 * 1000 // 15 minutes

declare global {
  // eslint-disable-next-line no-var
  var calendarSchedulerRunning: boolean | undefined
  // eslint-disable-next-line no-var
  var calendarSchedulerTimer: ReturnType<typeof setInterval> | undefined
  // eslint-disable-next-line no-var
  var calendarSyncTimer: ReturnType<typeof setInterval> | undefined
}

export function startCalendarScheduler() {
  if (process.env.DISABLE_INTERNAL_SCHEDULER === 'true') {
    console.log('[Calendar Scheduler] Disabled via DISABLE_INTERNAL_SCHEDULER — using VPS crontab')
    return
  }

  if (globalThis.calendarSchedulerRunning) {
    return // Already running
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const cronSecret = process.env.CRON_SECRET || ''

  console.log('[Calendar Scheduler] Starting background scheduler...')
  globalThis.calendarSchedulerRunning = true

  // Schedule check every 2 min
  globalThis.calendarSchedulerTimer = setInterval(async () => {
    try {
      const res = await fetch(`${appUrl}/api/calendar/auto-schedule`, {
        method: 'POST',
        headers: {
          'x-cron-secret': cronSecret,
          'Content-Type': 'application/json',
        },
      })
      if (res.ok) {
        const data = await res.json()
        if (data.scheduled > 0) {
          console.log(`[Calendar Scheduler] Auto-scheduled ${data.scheduled} bot(s)`)
        }
      }
    } catch (err: any) {
      // Silent — server might not be ready yet
    }
  }, SCHEDULE_INTERVAL)

  // Sync events every 15 min
  globalThis.calendarSyncTimer = setInterval(async () => {
    try {
      await fetch(`${appUrl}/api/calendar/auto-schedule?action=sync`, {
        method: 'POST',
        headers: {
          'x-cron-secret': cronSecret,
          'Content-Type': 'application/json',
        },
      })
    } catch (err: any) {
      // Silent
    }
  }, SYNC_INTERVAL)
}
