'use client'

import { useEffect, useState } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import RoleplayView from '@/components/RoleplayView'

export default function RoleplayPage() {
  const [activeChallenge, setActiveChallenge] = useState<any>(null)

  useEffect(() => {
    const stored = sessionStorage.getItem('activeChallenge')
    if (stored) {
      try {
        setActiveChallenge(JSON.parse(stored))
        sessionStorage.removeItem('activeChallenge')
      } catch (e) {
        console.error('Error parsing challenge:', e)
      }
    }
  }, [])

  return (
    <DashboardLayout>
      <RoleplayView
        challengeConfig={activeChallenge?.challenge_config}
        challengeId={activeChallenge?.id}
        onChallengeComplete={() => setActiveChallenge(null)}
      />
    </DashboardLayout>
  )
}
