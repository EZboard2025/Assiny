'use client'

import { useEffect, useState } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import RoleplayView from '@/components/RoleplayView'

export default function RoleplayPage() {
  const [activeChallenge, setActiveChallenge] = useState<any>(null)
  const [meetSimulation, setMeetSimulation] = useState<any>(null)

  useEffect(() => {
    const storedChallenge = sessionStorage.getItem('activeChallenge')
    if (storedChallenge) {
      try {
        setActiveChallenge(JSON.parse(storedChallenge))
        sessionStorage.removeItem('activeChallenge')
      } catch (e) {
        console.error('Error parsing challenge:', e)
      }
    }

    const storedSimulation = sessionStorage.getItem('meetSimulation')
    if (storedSimulation) {
      try {
        setMeetSimulation(JSON.parse(storedSimulation))
        sessionStorage.removeItem('meetSimulation')
      } catch (e) {
        console.error('Error parsing meet simulation:', e)
      }
    }
  }, [])

  return (
    <DashboardLayout>
      <RoleplayView
        challengeConfig={activeChallenge?.challenge_config}
        challengeId={activeChallenge?.id}
        onChallengeComplete={() => setActiveChallenge(null)}
        meetSimulationConfig={meetSimulation?.simulation_config}
        meetSimulationId={meetSimulation?.simulation_id}
      />
    </DashboardLayout>
  )
}
