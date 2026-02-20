'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'

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
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

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

  // Supabase Realtime subscription for instant notifications
  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newNotif = payload.new as UserNotification
          if (newNotif && !newNotif.is_read) {
            setNotifications(prev => [newNotif, ...prev])
            setUnreadCount(prev => prev + 1)
          }
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [userId])

  // Polling as fallback (reduced to 60s since Realtime handles instant delivery)
  useEffect(() => {
    if (!userId) return

    fetchNotifications()
    const interval = setInterval(fetchNotifications, 60000)
    return () => clearInterval(interval)
  }, [userId, fetchNotifications])

  return { notifications, unreadCount, markAsRead, refetch: fetchNotifications }
}
