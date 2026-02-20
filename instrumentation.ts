export async function register() {
  // Only run on the server (not edge)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startCalendarScheduler } = await import('./lib/calendar-scheduler')
    // Delay start to ensure server is ready
    setTimeout(() => {
      startCalendarScheduler()
    }, 10000) // 10s after server boot
  }
}
