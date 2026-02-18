'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Play, Video, Target, User, AlertTriangle, Lightbulb, X, CheckCircle, Eye, List } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface SavedSimulationCardProps {
  userId: string
}

function cleanGptText(text: string): string {
  return text
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/\s*—\s*/g, ': ')
    .replace(/\s*–\s*/g, ': ')
    .replace(/^Tecnica:\s*/i, '')
    .trim()
}

// Normaliza nomes de áreas SPIN que podem vir sem acento do banco
function fixAreaAccent(area: string): string {
  const map: Record<string, string> = {
    'Implicacao': 'Implicação',
    'Situacao': 'Situação',
    'Necessidade': 'Necessidade',
    'Problema': 'Problema',
  }
  return map[area] || area
}

export default function SavedSimulationCard({ userId }: SavedSimulationCardProps) {
  const router = useRouter()
  const [simulations, setSimulations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSim, setSelectedSim] = useState<any>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [showList, setShowList] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('saved_simulations')
          .select('*')
          .eq('user_id', userId)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })

        if (!error && data && data.length > 0) {
          setSimulations(data)
        }
      } catch (e) {
        console.error('Error loading saved simulations:', e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [userId])

  const handleStart = async (sim: any) => {
    if (!sim) return
    sessionStorage.setItem('meetSimulation', JSON.stringify({
      simulation_config: sim.simulation_config,
    }))

    try {
      await supabase
        .from('saved_simulations')
        .delete()
        .eq('id', sim.id)
    } catch (e) {
      console.error('Error deleting saved simulation:', e)
    }

    setSimulations(prev => prev.filter(s => s.id !== sim.id))
    setShowDetails(false)
    setShowList(false)
    router.push('/roleplay')
  }

  const openDetails = (sim: any) => {
    setSelectedSim(sim)
    setShowList(false)
    setShowDetails(true)
  }

  if (loading || simulations.length === 0) return null

  const latest = simulations[0]
  const latestConfig = latest.simulation_config
  const latestCoaching = latestConfig?.coaching_focus || []
  const latestMainArea = latestCoaching[0]?.area || null
  const totalPending = simulations.length

  // For detail modal
  const sim = selectedSim || latest
  const config = sim.simulation_config
  const coaching = config?.coaching_focus || []
  const justification = sim.simulation_justification || config?.simulation_justification || null

  return (
    <>
      <div className="mt-6 bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="p-4 flex items-start gap-3">
          <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center flex-shrink-0">
            <Video className="w-5 h-5 text-green-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h3 className="text-sm font-semibold text-gray-900">Prática Direcionada</h3>
              <span className="px-2 py-0.5 bg-amber-50 text-amber-600 text-[10px] font-medium rounded border border-amber-100">
                Pendente
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {latestMainArea && (
                <span className="text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-100">
                  {fixAreaAccent(latestMainArea)}
                </span>
              )}
              {latestCoaching.length > 1 && latestCoaching.slice(1).map((c: any, i: number) => (
                <span key={i} className="text-xs font-medium text-gray-500 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                  {fixAreaAccent(c.area)}
                </span>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={() => openDetails(latest)}
            className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700 font-medium transition-colors flex-shrink-0"
          >
            <Eye className="w-3.5 h-3.5" />
            Ver detalhes
          </button>
        </div>

        {/* Action button */}
        <div className="p-4 pt-0">
          <button
            type="button"
            onClick={() => openDetails(latest)}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-green-50 hover:bg-green-100 text-green-700 text-sm font-medium rounded-lg transition-colors border border-green-200"
          >
            <Play className="w-4 h-4" />
            Iniciar Simulação
          </button>
        </div>

        {/* Multiple simulations banner */}
        {totalPending > 1 && (
          <div className="px-4 pb-4">
            <button
              type="button"
              onClick={() => setShowList(true)}
              className="w-full flex items-center justify-center gap-2 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-medium rounded-lg transition-colors border border-amber-200"
            >
              <List className="w-3.5 h-3.5" />
              Voce tem {totalPending} simulaçoes pendentes — Ver todas
            </button>
          </div>
        )}
      </div>

      {/* List Modal - All pending simulations */}
      {showList && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowList(false)}>
          <div
            className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white rounded-t-2xl border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                  <Video className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Simulaçoes Pendentes</h3>
                  <p className="text-sm text-gray-500">{totalPending} simulaçoes salvas para praticar</p>
                </div>
              </div>
              <button
                onClick={() => setShowList(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              {simulations.map((s) => {
                const sConfig = s.simulation_config
                const sCoaching = sConfig?.coaching_focus || []
                const sPersona = sConfig?.persona?.cargo || sConfig?.persona?.profissao || 'Cliente'
                const sJustification = s.simulation_justification || sConfig?.simulation_justification || ''
                const sDate = new Date(s.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

                return (
                  <div key={s.id} className="bg-gray-50 rounded-xl border border-gray-200 p-4">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-semibold text-gray-900 line-clamp-1">{sPersona}</p>
                          <span className="text-[10px] text-gray-400">{sDate}</span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap mb-2">
                          {sCoaching.map((c: any, i: number) => {
                            const sevColor = c.severity === 'critical' ? 'bg-red-100 text-red-700' : c.severity === 'high' ? 'bg-amber-100 text-amber-700' : 'bg-yellow-100 text-yellow-700'
                            return (
                              <span key={i} className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${sevColor}`}>
                                {fixAreaAccent(c.area)} {c.spin_score !== undefined ? `${c.spin_score.toFixed(1)}` : ''}
                              </span>
                            )
                          })}
                        </div>
                        {sJustification && (
                          <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                            {sJustification}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleStart(s)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition-colors"
                      >
                        <Play className="w-3.5 h-3.5" />
                        Iniciar
                      </button>
                      <button
                        type="button"
                        onClick={() => openDetails(s)}
                        className="flex items-center justify-center gap-1.5 px-4 py-2 bg-white hover:bg-gray-50 text-gray-600 text-xs font-medium rounded-lg transition-colors border border-gray-200"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Detalhes
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetails && (
        <div className="fixed inset-0 xl:right-80 bg-black/50 z-30 flex items-center justify-center p-4 animate-[fadeIn_200ms_ease-out]" onClick={() => setShowDetails(false)}>
          <div
            className="bg-gray-50 rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto animate-[modalSlideUp_300ms_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="sticky top-0 bg-white rounded-t-2xl border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                  <Target className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Prática Direcionada</h3>
                  <p className="text-sm text-gray-500">Baseada nos erros identificados na reunião</p>
                </div>
              </div>
              <button
                onClick={() => setShowDetails(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Meeting Context */}
              {config?.meeting_context && (
                <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                  <p className="text-sm text-gray-700 italic">{config.meeting_context}</p>
                </div>
              )}

              {/* Justification Banner */}
              {justification && (
                <div className="bg-green-50 rounded-xl p-4 border-l-4 border-green-500 border-t border-r border-b border-t-green-200 border-r-green-200 border-b-green-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="w-4 h-4 text-green-600" />
                    <h4 className="text-sm font-bold text-gray-900">Por que esta prática?</h4>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">{justification}</p>
                </div>
              )}

              {/* Persona Header */}
              <div className="flex items-center gap-3">
                <User className="w-4 h-4 text-green-600" />
                <h4 className="text-sm font-bold text-gray-900">Persona do Cliente</h4>
                {config?.age && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                    {config.age} anos
                  </span>
                )}
                {config?.temperament && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                    {config.temperament}
                  </span>
                )}
              </div>

              {/* Persona Fields */}
              <div className="grid grid-cols-2 gap-3">
                {config?.persona?.business_type === 'B2B' ? (<>
                  {config.persona.cargo && (
                    <div className="bg-white rounded-xl p-4 border border-gray-200">
                      <p className="text-[10px] text-green-600 font-semibold uppercase tracking-wide mb-1.5">Cargo</p>
                      <p className="text-sm text-gray-700 leading-relaxed">{config.persona.cargo}</p>
                    </div>
                  )}
                  {config.persona.tipo_empresa_faturamento && (
                    <div className="bg-white rounded-xl p-4 border border-gray-200">
                      <p className="text-[10px] text-green-600 font-semibold uppercase tracking-wide mb-1.5">Empresa</p>
                      <p className="text-sm text-gray-700 leading-relaxed">{config.persona.tipo_empresa_faturamento}</p>
                    </div>
                  )}
                  {config.persona.contexto && (
                    <div className="bg-white rounded-xl p-4 border border-gray-200 col-span-2">
                      <p className="text-[10px] text-green-600 font-semibold uppercase tracking-wide mb-1.5">Contexto</p>
                      <p className="text-sm text-gray-700 leading-relaxed">{config.persona.contexto}</p>
                    </div>
                  )}
                  {config.persona.busca && (
                    <div className="bg-white rounded-xl p-4 border border-gray-200">
                      <p className="text-[10px] text-green-600 font-semibold uppercase tracking-wide mb-1.5">O que busca</p>
                      <p className="text-sm text-gray-700 leading-relaxed">{config.persona.busca}</p>
                    </div>
                  )}
                  {config.persona.dores && (
                    <div className="bg-white rounded-xl p-4 border border-gray-200">
                      <p className="text-[10px] text-red-500 font-semibold uppercase tracking-wide mb-1.5">Dores</p>
                      <p className="text-sm text-gray-700 leading-relaxed">{config.persona.dores}</p>
                    </div>
                  )}
                </>) : (<>
                  {config?.persona?.profissao && (
                    <div className="bg-white rounded-xl p-4 border border-gray-200">
                      <p className="text-[10px] text-green-600 font-semibold uppercase tracking-wide mb-1.5">Perfil</p>
                      <p className="text-sm text-gray-700 leading-relaxed">{config.persona.profissao}</p>
                    </div>
                  )}
                  {config?.persona?.perfil_socioeconomico && (
                    <div className="bg-white rounded-xl p-4 border border-gray-200">
                      <p className="text-[10px] text-green-600 font-semibold uppercase tracking-wide mb-1.5">Perfil Socioeconomico</p>
                      <p className="text-sm text-gray-700 leading-relaxed">{config.persona.perfil_socioeconomico}</p>
                    </div>
                  )}
                  {config?.persona?.contexto && (
                    <div className="bg-white rounded-xl p-4 border border-gray-200 col-span-2">
                      <p className="text-[10px] text-green-600 font-semibold uppercase tracking-wide mb-1.5">Contexto</p>
                      <p className="text-sm text-gray-700 leading-relaxed">{config.persona.contexto}</p>
                    </div>
                  )}
                  {config?.persona?.busca && (
                    <div className="bg-white rounded-xl p-4 border border-gray-200">
                      <p className="text-[10px] text-green-600 font-semibold uppercase tracking-wide mb-1.5">O que busca</p>
                      <p className="text-sm text-gray-700 leading-relaxed">{config.persona.busca}</p>
                    </div>
                  )}
                  {config?.persona?.dores && (
                    <div className="bg-white rounded-xl p-4 border border-gray-200">
                      <p className="text-[10px] text-red-500 font-semibold uppercase tracking-wide mb-1.5">Dores</p>
                      <p className="text-sm text-gray-700 leading-relaxed">{config.persona.dores}</p>
                    </div>
                  )}
                </>)}
              </div>

              {/* Objective */}
              {config?.objective && (
                <div className="bg-white rounded-xl p-5 border border-gray-200">
                  <div className="flex items-center gap-2 mb-3">
                    <Target className="w-4 h-4 text-green-600" />
                    <h4 className="text-sm font-bold text-gray-900">Objetivo</h4>
                  </div>
                  <p className="text-sm font-medium text-gray-900 mb-1">{config.objective.name}</p>
                  {config.objective.description && (
                    <p className="text-sm text-gray-600">{config.objective.description}</p>
                  )}
                </div>
              )}

              {/* Objections */}
              {config?.objections && config.objections.length > 0 && (
                <div className="bg-white rounded-xl p-5 border border-gray-200">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-4 h-4 text-green-600" />
                    <h4 className="text-sm font-bold text-gray-900">Objecoes para Treinar</h4>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{config.objections.length}</span>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    {config.objections.map((obj: any, idx: number) => (
                      <div key={idx} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                        <div className="flex items-start gap-2 mb-1.5">
                          <p className="text-sm font-medium text-gray-900 flex-1">{cleanGptText(obj.name)}</p>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                            obj.source === 'meeting'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-orange-100 text-orange-700'
                          }`}>
                            {obj.source === 'meeting' ? 'Da reuniao' : 'Coaching'}
                          </span>
                        </div>
                        {obj.rebuttals && obj.rebuttals.length > 0 && (
                          <div className="space-y-1 mt-2">
                            <p className="text-[10px] text-gray-500 uppercase font-semibold tracking-wide">Como quebrar:</p>
                            {obj.rebuttals.map((r: string, ri: number) => (
                              <p key={ri} className="text-xs text-green-700 flex items-start gap-1.5 bg-green-50 rounded px-2 py-1">
                                <CheckCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                {cleanGptText(r)}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Coaching Focus */}
              {coaching.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-amber-500" />
                    <h4 className="text-sm font-bold text-gray-900">Foco de Coaching</h4>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {coaching.length} {coaching.length === 1 ? 'area' : 'areas'}
                    </span>
                  </div>

                  {coaching.map((focus: any, idx: number) => {
                    const severityColors = {
                      critical: { border: 'border-l-red-500', badge: 'bg-red-100 text-red-700', label: 'Critico', impact: 'bg-red-50 border-red-100' },
                      high: { border: 'border-l-amber-500', badge: 'bg-amber-100 text-amber-700', label: 'Alto', impact: 'bg-amber-50 border-amber-100' },
                      medium: { border: 'border-l-yellow-500', badge: 'bg-yellow-100 text-yellow-700', label: 'Medio', impact: 'bg-yellow-50 border-yellow-100' }
                    }
                    const sev = severityColors[focus.severity as keyof typeof severityColors] || severityColors.high
                    const phrases = focus.example_phrases || focus.tips || []
                    const diagnosisText = focus.diagnosis || focus.what_to_improve || ''

                    return (
                      <div key={idx} className={`bg-white rounded-xl border border-gray-200 border-l-4 ${sev.border} overflow-hidden`}>
                        {/* Header */}
                        <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100">
                          <div className="flex items-center gap-2">
                            {focus.severity && (
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide ${sev.badge}`}>
                                {sev.label}
                              </span>
                            )}
                            <span className="text-sm font-bold text-gray-900">{fixAreaAccent(focus.area)}</span>
                          </div>
                          {focus.spin_score !== undefined && (
                            <span className={`text-sm font-bold ${focus.spin_score < 4 ? 'text-red-600' : focus.spin_score < 6 ? 'text-amber-600' : 'text-yellow-600'}`}>
                              {focus.spin_score.toFixed(1)}/10
                            </span>
                          )}
                        </div>

                        <div className="p-4 space-y-3">
                          {diagnosisText && (
                            <div>
                              <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide mb-1">Diagnostico</p>
                              <p className="text-sm text-gray-700 leading-relaxed">{cleanGptText(diagnosisText)}</p>
                            </div>
                          )}

                          {focus.transcript_evidence && (
                            <div className="bg-gray-50 rounded-lg p-3 border-l-[3px] border-l-gray-300 border border-gray-100">
                              <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide mb-1">Evidencia da Reuniao</p>
                              <p className="text-xs text-gray-600 italic leading-relaxed">{cleanGptText(focus.transcript_evidence)}</p>
                            </div>
                          )}

                          {focus.business_impact && (
                            <div className={`rounded-lg p-3 border ${sev.impact}`}>
                              <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide mb-1">Por que importa</p>
                              <p className="text-xs text-gray-700 leading-relaxed">{cleanGptText(focus.business_impact)}</p>
                            </div>
                          )}

                          {focus.practice_goal && (
                            <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                              <p className="text-[10px] text-green-600 font-semibold uppercase tracking-wide mb-1">O que praticar</p>
                              <p className="text-xs text-green-800 leading-relaxed font-medium">{cleanGptText(focus.practice_goal)}</p>
                            </div>
                          )}

                          {phrases.length > 0 && (
                            <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                              <p className="text-[10px] text-blue-600 font-semibold uppercase tracking-wide mb-1.5">Frases para usar</p>
                              <div className="space-y-1.5">
                                {phrases.map((phrase: string, pi: number) => (
                                  <p key={pi} className="text-xs text-blue-800 flex items-start gap-1.5">
                                    <span className="text-blue-400 mt-0.5 flex-shrink-0">&ldquo;</span>
                                    <span className="leading-relaxed">{cleanGptText(phrase)}</span>
                                  </p>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Action Button */}
              <button
                type="button"
                onClick={() => handleStart(sim)}
                className="w-full py-3.5 bg-green-50 hover:bg-green-100 text-green-700 rounded-xl font-bold flex items-center justify-center gap-2 transition-all border border-green-200"
              >
                <Play className="w-5 h-5" />
                Iniciar Simulação
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
