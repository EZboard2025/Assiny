'use client'

import { useState, useEffect, useCallback } from 'react'

export interface UserNotification {
  id: string
  user_id: string
  type: string
  title: string
  message: string | null
  data: any
  is_read: boolean
  read_at: string | null
  created_at: string
}

export function useNotifications(userId: string | null) {
  const [notifications, setNotifications] = useState<UserNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  const fetchNotifications = useCallback(async () => {
    if (!userId) return

    try {
      const res = await fetch(`/api/notifications?userId=${userId}`)
      if (!res.ok) return

      const data = await res.json()
      const notifs = data.notifications || []
      setNotifications(notifs)
      setUnreadCount(notifs.length)
    } catch (err) {
      console.error('Error fetching notifications:', err)
    }
  }, [userId])

  const markAsRead = useCallback(async (notificationId: string) => {
    if (!userId) return

    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId, userId })
      })

      setNotifications(prev => prev.filter(n => n.id !== notificationId))
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (err) {
      console.error('Error marking notification as read:', err)
    }
  }, [userId])

  // Poll every 30 seconds
  useEffect(() => {
    if (!userId) return

    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [userId, fetchNotifications])

  return { notifications, unreadCount, markAsRead, refetch: fetchNotifications }
}
