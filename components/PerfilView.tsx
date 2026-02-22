'use client'

import { useState, useEffect, useMemo } from 'react'
import { getAllUserRoleplaySessions, getUserMeetEvaluations, type RoleplaySession } from '@/lib/roleplay'
import { supabase } from '@/lib/supabase'
import { getFollowUpAnalyses, getFollowUpStats } from '@/lib/followup'

import PerfilHeader from './perfil/PerfilHeader'
import PerfilTabs, { type PerfilTabKey } from './perfil/PerfilTabs'
import OverviewTab from './perfil/OverviewTab'
import SpinTab from './perfil/SpinTab'
import PersonasTab from './perfil/PersonasTab'
import ObjectionsTab from './perfil/ObjectionsTab'

interface PerfilViewProps {
  onViewChange?: (view: 'home' | 'chat' | 'roleplay' | 'pdi' | 'historico' | 'perfil' | 'roleplay-links') => void | Promise<void>
}

// Tipos para as estatísticas
interface PersonaStats {
  persona: any
  count: number
  scores: number[]
  average: number
  lastPractice: string
}

interface ObjectionStats {
  name: string
  count: number
  scores: number[]
  average: number
  bestScore: number
}

export interface ChartDataPoint {
  label: string
  roleplay: number | null
  meet: number | null
}

export default function PerfilView({ onViewChange }: PerfilViewProps = {}) {
  const [mounted, setMounted] = useState(false)
  const [spinAverages, setSpinAverages] = useState({ S: 0, P: 0, I: 0, N: 0 })
  const [loading, setLoading] = useState(true)
  const [userEmail, setUserEmail] = useState('')
  const [userName, setUserName] = useState('')
  const [evolutionData, setEvolutionData] = useState<Array<{ label: string; score: number; date: string }>>([])
  const [latestSession, setLatestSession] = useState<{ label: string; score: number; improvement: number } | null>(null)
  const [overallAverage, setOverallAverage] = useState(0)
  const [totalSessions, setTotalSessions] = useState(0)
  const [sessions, setSessions] = useState<RoleplaySession[]>([])

  const [multiSeriesData, setMultiSeriesData] = useState<ChartDataPoint[]>([])
  const [activeTab, setActiveTab] = useState<PerfilTabKey>('geral')
  const [personaStats, setPersonaStats] = useState<Map<string, PersonaStats>>(new Map())
  const [objectionStats, setObjectionStats] = useState<Map<string, ObjectionStats>>(new Map())

  // ===== DATA LOADING =====

  useEffect(() => {
    let isMounted = true

    const loadAllData = async () => {
      setMounted(true)
      loadUserData()

      try {
        setLoading(true)
        const allSessions = await getAllUserRoleplaySessions(1000)
        if (!isMounted) return

        setSessions(allSessions)

        const completedSessions = allSessions.filter(
          (session) => session.status === 'completed' && (session as any).evaluation
        )

        // SPIN totals
        const totals = { S: 0, P: 0, I: 0, N: 0 }
        const counts = { S: 0, P: 0, I: 0, N: 0 }

        // Evolution data
        const evolutionPoints: Array<{ label: string; score: number; date: string; timestamp: number }> = []
        let totalOverallScore = 0
        let countOverallScore = 0

        completedSessions.forEach((session) => {
          let evaluation = (session as any).evaluation
          if (evaluation && typeof evaluation === 'object' && 'output' in evaluation) {
            try { evaluation = JSON.parse(evaluation.output) } catch { return }
          }

          if (evaluation?.spin_evaluation) {
            const spin = evaluation.spin_evaluation
            if (spin.S?.final_score !== undefined) { totals.S += spin.S.final_score; counts.S++ }
            if (spin.P?.final_score !== undefined) { totals.P += spin.P.final_score; counts.P++ }
            if (spin.I?.final_score !== undefined) { totals.I += spin.I.final_score; counts.I++ }
            if (spin.N?.final_score !== undefined) { totals.N += spin.N.final_score; counts.N++ }
          }

          if (evaluation?.overall_score !== undefined) {
            let scoreValue = parseFloat(evaluation.overall_score)
            if (scoreValue > 10) scoreValue = scoreValue / 10

            totalOverallScore += scoreValue
            countOverallScore++

            const sessionDate = new Date(session.created_at)
            evolutionPoints.push({
              label: sessionDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
              score: scoreValue,
              date: sessionDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
              timestamp: sessionDate.getTime(),
            })
          }
        })

        if (!isMounted) return

        setSpinAverages({
          S: counts.S > 0 ? totals.S / counts.S : 0,
          P: counts.P > 0 ? totals.P / counts.P : 0,
          I: counts.I > 0 ? totals.I / counts.I : 0,
          N: counts.N > 0 ? totals.N / counts.N : 0,
        })

        const avgOverall = countOverallScore > 0 ? totalOverallScore / countOverallScore : 0
        setOverallAverage(avgOverall)
        setTotalSessions(countOverallScore)

        const orderedData = evolutionPoints
          .sort((a, b) => a.timestamp - b.timestamp)
          .map(({ timestamp, ...rest }) => rest)

        setEvolutionData(orderedData)

        if (orderedData.length > 0) {
          const latest = orderedData[orderedData.length - 1]
          const previous = orderedData.length > 1 ? orderedData[orderedData.length - 2] : null
          setLatestSession({
            label: latest.label,
            score: latest.score,
            improvement: previous ? latest.score - previous.score : 0,
          })
        }

        // Build multi-series chart data (roleplay vs meet — 2 lines)
        const multiSeries: (ChartDataPoint & { timestamp: number })[] = []

        completedSessions.forEach((session) => {
          let eval2 = (session as any).evaluation
          if (eval2 && typeof eval2 === 'object' && 'output' in eval2) {
            try { eval2 = JSON.parse(eval2.output) } catch { return }
          }
          if (!eval2?.overall_score) return

          let overall = parseFloat(eval2.overall_score)
          if (overall > 10) overall = overall / 10

          multiSeries.push({
            label: new Date(session.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
            roleplay: overall,
            meet: null,
            timestamp: new Date(session.created_at).getTime(),
          })
        })

        // Load meet evaluations
        try {
          const meetEvals = await getUserMeetEvaluations(100)
          meetEvals.forEach((me) => {
            const meetScore = me.overall_score ? me.overall_score / 10 : null
            if (!meetScore) return

            multiSeries.push({
              label: new Date(me.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
              roleplay: null,
              meet: meetScore,
              timestamp: new Date(me.created_at).getTime(),
            })
          })
        } catch {}

        multiSeries.sort((a, b) => a.timestamp - b.timestamp)
        if (isMounted) setMultiSeriesData(multiSeries.map(({ timestamp, ...rest }) => rest))

        processPersonaStats(completedSessions)
        processObjectionStats(completedSessions)

        if (isMounted) setLoading(false)
      } catch (error) {
        console.error('Erro ao carregar dados do perfil:', error)
        if (isMounted) setLoading(false)
      }

      // Update performance summary in background
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          fetch('/api/performance-summary/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id }),
          }).catch(() => {})
        }
      } catch {}
    }

    loadAllData()
    return () => { isMounted = false }
  }, [])

  const loadUserData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserEmail(user.email || '')
        setUserName(user.user_metadata?.name || user.email?.split('@')[0] || 'Usuário')
      }
    } catch (error) {
      console.error('Erro ao carregar dados do usuário:', error)
    }
  }

  // ===== PROCESS PERSONA STATS =====

  const processPersonaStats = (completedSessions: RoleplaySession[]) => {
    const stats = new Map<string, PersonaStats>()

    completedSessions.forEach((session) => {
      const config = (session as any).config
      let persona = config?.persona || config?.selectedPersona
      let personaId = persona?.id || persona?.persona_id

      if (!persona && config?.segment) {
        persona = { id: `segment-${config.segment}`, cargo: config.segment, tipo_empresa_faturamento: 'Sessão Antiga (Segment)' }
        personaId = persona.id
      }

      if (!personaId || !persona) return

      let evaluation = (session as any).evaluation
      if (evaluation && typeof evaluation === 'object' && 'output' in evaluation) {
        try { evaluation = JSON.parse(evaluation.output) } catch { return }
      }
      if (!evaluation?.overall_score) return

      let score = evaluation.overall_score
      if (score > 10) score = score / 10

      if (!stats.has(personaId)) {
        stats.set(personaId, { persona, count: 0, scores: [], average: 0, lastPractice: session.created_at })
      }

      const stat = stats.get(personaId)!
      stat.count++
      stat.scores.push(score)
      if (new Date(session.created_at) > new Date(stat.lastPractice)) {
        stat.lastPractice = session.created_at
      }
    })

    stats.forEach((stat) => {
      stat.average = stat.scores.length > 0 ? stat.scores.reduce((a, b) => a + b, 0) / stat.scores.length : 0
    })

    setPersonaStats(stats)
  }

  // ===== PROCESS OBJECTION STATS =====

  const processObjectionStats = (completedSessions: RoleplaySession[]) => {
    const stats = new Map<string, ObjectionStats>()

    completedSessions.forEach((session) => {
      const config = (session as any).config
      let evaluation = (session as any).evaluation
      if (evaluation && typeof evaluation === 'object' && 'output' in evaluation) {
        try { evaluation = JSON.parse(evaluation.output) } catch { return }
      }

      let objectionsToAnalyze = evaluation?.objections_analysis
      if (!objectionsToAnalyze && config?.objections && Array.isArray(config.objections)) {
        objectionsToAnalyze = config.objections.map((obj: any, objIdx: number) => ({
          objection: obj.name || obj.objection || `Objeção #${objIdx + 1}`,
          handling_score: 5,
        }))
      }
      if (!objectionsToAnalyze || !Array.isArray(objectionsToAnalyze)) return

      objectionsToAnalyze.forEach((obj: any) => {
        let objId = obj.objection_id || obj.id || null
        if (!objId || objId === 'não-configurada') return

        let objName = ''
        if (config?.objections) {
          const configuredObj = config.objections.find((o: any) => {
            if (typeof o === 'object' && o.id === objId) return true
            if (objId.startsWith('legacy-')) {
              const index = parseInt(objId.replace('legacy-', ''))
              return config.objections.indexOf(o) === index
            }
            return false
          })
          if (configuredObj) {
            objName = typeof configuredObj === 'string' ? configuredObj : (configuredObj.name || '')
          }
        }
        if (!objName) {
          objName = obj.objection_text || obj.objection || obj.name || `Objeção ${objId}`
        }

        const handlingScore = obj.handling_score || obj.score || 5

        if (!stats.has(objName)) {
          stats.set(objName, { name: objName, count: 0, scores: [], average: 0, bestScore: 0 })
        }

        const stat = stats.get(objName)!
        stat.count++
        stat.scores.push(handlingScore)
        stat.bestScore = Math.max(stat.bestScore, handlingScore)
      })
    })

    stats.forEach((stat) => {
      stat.average = stat.scores.length > 0 ? stat.scores.reduce((a, b) => a + b, 0) / stat.scores.length : 0
    })

    setObjectionStats(stats)
  }

  // ===== COMPUTED DATA =====

  // Best score across all sessions
  const bestScore = useMemo(() => {
    if (evolutionData.length === 0) return 0
    return Math.max(...evolutionData.map((d) => d.score))
  }, [evolutionData])

  // Trend (latest vs previous)
  const trend = useMemo(() => {
    return latestSession?.improvement ?? 0
  }, [latestSession])

  // SPIN trends (last 2 sessions comparison per pillar)
  const spinTrends = useMemo(() => {
    const completedSessions = sessions
      .filter((s) => s.status === 'completed' && (s as any).evaluation)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

    if (completedSessions.length < 2) return { S: null, P: null, I: null, N: null }

    const getSpinScores = (session: RoleplaySession) => {
      let evaluation = (session as any).evaluation
      if (evaluation && typeof evaluation === 'object' && 'output' in evaluation) {
        try { evaluation = JSON.parse(evaluation.output) } catch { return null }
      }
      const spin = evaluation?.spin_evaluation
      if (!spin) return null
      return {
        S: spin.S?.final_score ?? null,
        P: spin.P?.final_score ?? null,
        I: spin.I?.final_score ?? null,
        N: spin.N?.final_score ?? null,
      }
    }

    const latest = getSpinScores(completedSessions[completedSessions.length - 1])
    const previous = getSpinScores(completedSessions[completedSessions.length - 2])

    if (!latest || !previous) return { S: null, P: null, I: null, N: null }

    return {
      S: latest.S !== null && previous.S !== null ? latest.S - previous.S : null,
      P: latest.P !== null && previous.P !== null ? latest.P - previous.P : null,
      I: latest.I !== null && previous.I !== null ? latest.I - previous.I : null,
      N: latest.N !== null && previous.N !== null ? latest.N - previous.N : null,
    }
  }, [sessions])

  // Auto-computed summary data (replaces modal trigger)
  const summaryData = useMemo(() => {
    const completedSessions = sessions.filter(
      (s) => s.status === 'completed' && (s as any).evaluation
    )

    interface SessionEval {
      evaluation: any
      created_at: string
    }

    const evaluations: SessionEval[] = []
    completedSessions.forEach((session) => {
      let evaluation = (session as any).evaluation
      if (evaluation && typeof evaluation === 'object' && 'output' in evaluation) {
        try { evaluation = JSON.parse(evaluation.output) } catch { return }
      }
      if (!evaluation) return
      evaluations.push({ evaluation, created_at: session.created_at })
    })

    evaluations.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

    if (evaluations.length === 0) return null

    const last5 = evaluations.slice(-5)
    const totalCount = evaluations.length

    const allStrengths: Array<{ text: string; sessionNum: number }> = []
    const allGaps: Array<{ text: string; sessionNum: number }> = []
    const allImprovements: any[] = []

    last5.forEach((e, idx) => {
      const sessionNum = totalCount - last5.length + idx + 1
      const evalData = e.evaluation
      if (evalData?.top_strengths) {
        evalData.top_strengths.forEach((s: string) => allStrengths.push({ text: s, sessionNum }))
      }
      if (evalData?.critical_gaps) {
        evalData.critical_gaps.forEach((g: string) => allGaps.push({ text: g, sessionNum }))
      }
      if (evalData?.priority_improvements) {
        evalData.priority_improvements.forEach((imp: any) => allImprovements.push({ ...imp, sessionNum }))
      }
    })

    // Group by text
    const strengthMap: Record<string, number[]> = {}
    const gapMap: Record<string, number[]> = {}

    allStrengths.forEach(({ text, sessionNum }) => {
      if (!strengthMap[text]) strengthMap[text] = []
      strengthMap[text].push(sessionNum)
    })

    allGaps.forEach(({ text, sessionNum }) => {
      if (!gapMap[text]) gapMap[text] = []
      gapMap[text].push(sessionNum)
    })

    const topStrengths = Object.entries(strengthMap)
      .sort(([, a], [, b]) => b.length - a.length)
      .slice(0, 5)
      .map(([text, sess]) => ({ text, count: sess.length, sessions: sess }))

    const topGaps = Object.entries(gapMap)
      .sort(([, a], [, b]) => b.length - a.length)
      .slice(0, 5)
      .map(([text, sess]) => ({ text, count: sess.length, sessions: sess }))

    return {
      topStrengths,
      topGaps,
      allImprovements: allImprovements.slice(0, 10),
    }
  }, [sessions])

  // ===== RENDER =====

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6">
      <div className="max-w-6xl">
        <PerfilHeader
          userName={userName}
          userEmail={userEmail}
          overallAverage={overallAverage}
          totalSessions={totalSessions}
          bestScore={bestScore}
          trend={trend}
          onViewHistory={() => onViewChange?.('historico')}
          mounted={mounted}
        />

        <PerfilTabs activeTab={activeTab} onTabChange={setActiveTab} mounted={mounted} />

        {activeTab === 'geral' && (
          <OverviewTab
            evolutionData={evolutionData}
            multiSeriesData={multiSeriesData}
            latestSession={latestSession}
            loading={loading}
            overallAverage={overallAverage}
            totalSessions={totalSessions}
            bestScore={bestScore}
            trend={trend}
            spinAverages={spinAverages}
          />
        )}

        {activeTab === 'spin' && (
          <SpinTab
            spinAverages={spinAverages}
            spinTrends={spinTrends}
            summaryData={summaryData}
            loading={loading}
          />
        )}

        {activeTab === 'personas' && (
          <PersonasTab personaStats={personaStats} loading={loading} />
        )}

        {activeTab === 'objecoes' && (
          <ObjectionsTab objectionStats={objectionStats} loading={loading} />
        )}
      </div>
    </div>
  )
}
