'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export function useTrainingStreak(userId: string | null) {
  const [streak, setStreak] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const calculateStreak = async () => {
      if (!userId) {
        setLoading(false)
        return
      }

      try {
        // 1. Buscar sessões completadas dos últimos 60 dias
        const { data: sessions, error } = await supabase
          .from('roleplay_sessions')
          .select('created_at')
          .eq('user_id', userId)
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(60)

        if (error) {
          console.error('Error fetching sessions for streak:', error)
          setLoading(false)
          return
        }

        if (!sessions || sessions.length === 0) {
          setStreak(0)
          setLoading(false)
          return
        }

        // 2. Extrair datas únicas (formato YYYY-MM-DD para comparação consistente)
        const uniqueDates = new Set(
          sessions.map(s => {
            const date = new Date(s.created_at)
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
          })
        )

        // 3. Função auxiliar para formatar data
        const formatDate = (date: Date) => {
          return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
        }

        // 4. Contar dias consecutivos
        let count = 0
        const today = new Date()
        let checkDate = new Date(today)

        // Se não treinou hoje, começar de ontem (grace period)
        if (!uniqueDates.has(formatDate(checkDate))) {
          checkDate.setDate(checkDate.getDate() - 1)

          // Se também não treinou ontem, streak é 0
          if (!uniqueDates.has(formatDate(checkDate))) {
            setStreak(0)
            setLoading(false)
            return
          }
        }

        // Contar dias consecutivos para trás
        while (uniqueDates.has(formatDate(checkDate))) {
          count++
          checkDate.setDate(checkDate.getDate() - 1)
        }

        setStreak(count)
      } catch (error) {
        console.error('Error calculating streak:', error)
        setStreak(0)
      } finally {
        setLoading(false)
      }
    }

    calculateStreak()
  }, [userId])

  return { streak, loading }
}
