export function getTimeUntilReset(): {
  days: number
  hours: number
  minutes: number
  seconds: number
  nextResetDate: Date
} {
  const now = new Date()
  const nextMonday = new Date(now)

  // Calculate days until next Monday (0 = Sunday, 1 = Monday, etc.)
  const daysUntilMonday = (8 - now.getDay()) % 7

  // If it's Monday, check if it's before or after 00:00
  if (daysUntilMonday === 0) {
    // It's Monday - set to next Monday
    nextMonday.setDate(nextMonday.getDate() + 7)
  } else {
    // Set to next Monday
    nextMonday.setDate(nextMonday.getDate() + daysUntilMonday)
  }

  // Set to 00:00:00.000
  nextMonday.setHours(0, 0, 0, 0)

  // Calculate difference in milliseconds
  const diff = nextMonday.getTime() - now.getTime()

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
    nextResetDate: nextMonday
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