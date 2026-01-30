export function getTimeUntilReset(): {
  days: number
  hours: number
  minutes: number
  seconds: number
  nextResetDate: Date
} {
  const now = new Date()

  // Calculate first day of next month at 00:00:00
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0)

  // Calculate difference in milliseconds
  const diff = nextMonth.getTime() - now.getTime()

  // Convert to days, hours, minutes, seconds
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((diff % (1000 * 60)) / 1000)

  return {
    days,
    hours,
    minutes,
    seconds,
    nextResetDate: nextMonth
  }
}

export function formatTimeUntilReset(): string {
  const { days, hours, minutes } = getTimeUntilReset()

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`
  } else {
    return `${minutes}m`
  }
}

// Helper to get the name of next month's first day
export function getNextResetDateFormatted(): string {
  const { nextResetDate } = getTimeUntilReset()
  return nextResetDate.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit'
  })
}
