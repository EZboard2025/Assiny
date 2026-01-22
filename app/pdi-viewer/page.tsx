'use client'

import { useSearchParams } from 'next/navigation'
import { useState, useEffect, Suspense } from 'react'
import { Target, TrendingUp, Zap, CheckCircle, Calendar, Award, Sparkles, AlertTriangle, Loader2 } from 'lucide-react'

interface PDIData {
  versao?: string
  gerado_em: string
  periodo: string
  empresa: {
    nome: string
    tipo: string
  }
  vendedor: {
    nome: string
    empresa: string
    total_sessoes: number
  }
  diagnostico: {
    nota_geral: number
    resumo: string
  }
  notas_spin: {
    situacao: number
    problema: number
    implicacao: number
    necessidade: number
  }
  foco_da_semana?: {
    area: string
    objetivo: string
  }
  meta_7_dias?: {
    objetivo: string
    meta_numerica?: string
  }
  simulacoes?: Array<{
    quantidade: number
    objetivo: string
    persona_sugerida: string
    objecao_para_treinar?: string
    criterio_sucesso: string
  }>
  acoes?: Array<{
    acao: string
    resultado_esperado: string
  }>
  proximo_ciclo?: string
  proximos_passos?: string
}

function PDIViewerContent() {
  const searchParams = useSearchParams()
  const userId = searchParams.get('userId')
  const [pdiData, setPdiData] = useState<PDIData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (userId) {
      loadPDI()
    }
  }, [userId])

  const loadPDI = async () => {
    try {
      setIsLoading(true)
      const { supabase } = await import('@/lib/supabase')

      const { data, error } = await supabase
        .from('pdis')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'ativo')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (error) {
        console.error('Erro ao carregar PDI:', error)
        setErrorMessage('Nenhum PDI encontrado para este vendedor.')
        setIsLoading(false)
        return
      }

      if (data && data.pdi_data) {
        setPdiData(data.pdi_data as PDIData)
      } else {
        setErrorMessage('PDI não gerado ainda.')
      }
    } catch (error) {
      console.error('Erro ao carregar PDI:', error)
      setErrorMessage('Erro ao carregar PDI.')
    } finally {
      setIsLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    })
  }

  const renderRadarChart = (scores: { situacao: number; problema: number; implicacao: number; necessidade: number }) => {
    const S = scores.situacao || 0
    const P = scores.problema || 0
    const I = scores.implicacao || 0
    const N = scores.necessidade || 0

    const sY = 120 - (S * 8)
    const pX = 120 + (P * 8)
    const iY = 120 + (I * 8)
    const nX = 120 - (N * 8)

    return (
      <svg viewBox="0 0 240 240" className="w-full h-full drop-shadow-[0_0_30px_rgba(34,197,94,0.3)]">
        <defs>
          <filter id="greenGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((level) => {
          const size = level * 8
          return (
            <polygon
              key={level}
              points={`120,${120-size} ${120+size},120 120,${120+size} ${120-size},120`}
              fill="none"
              stroke={level % 2 === 0 ? "rgba(34, 197, 94, 0.15)" : "rgba(34, 197, 94, 0.08)"}
              strokeWidth="0.5"
            />
          )
        })}

        <line x1="120" y1="40" x2="120" y2="200" stroke="rgba(34, 197, 94, 0.3)" strokeWidth="0.5" />
        <line x1="40" y1="120" x2="200" y2="120" stroke="rgba(34, 197, 94, 0.3)" strokeWidth="0.5" />

        <polygon
          points={`120,${sY} ${pX},120 120,${iY} ${nX},120`}
          fill="rgba(34, 197, 94, 0.15)"
          stroke="rgb(34, 197, 94)"
          strokeWidth="3"
          filter="url(#greenGlow)"
        />
        <polygon
          points={`120,${sY} ${pX},120 120,${iY} ${nX},120`}
          fill="rgba(34, 197, 94, 0.3)"
          stroke="rgb(34, 197, 94)"
          strokeWidth="2.5"
        />

        <circle cx="120" cy={sY} r="7" fill="rgb(34, 197, 94)" opacity="0.4" />
        <circle cx="120" cy={sY} r="4" fill="rgb(34, 197, 94)" />
        <circle cx="120" cy={sY} r="2" fill="rgb(255, 255, 255)" />

        <circle cx={pX} cy="120" r="7" fill="rgb(34, 197, 94)" opacity="0.4" />
        <circle cx={pX} cy="120" r="4" fill="rgb(34, 197, 94)" />
        <circle cx={pX} cy="120" r="2" fill="rgb(255, 255, 255)" />

        <circle cx="120" cy={iY} r="7" fill="rgb(34, 197, 94)" opacity="0.4" />
        <circle cx="120" cy={iY} r="4" fill="rgb(34, 197, 94)" />
        <circle cx="120" cy={iY} r="2" fill="rgb(255, 255, 255)" />

        <circle cx={nX} cy="120" r="7" fill="rgb(34, 197, 94)" opacity="0.4" />
        <circle cx={nX} cy="120" r="4" fill="rgb(34, 197, 94)" />
        <circle cx={nX} cy="120" r="2" fill="rgb(255, 255, 255)" />

        <g>
          <rect x="100" y="15" width="40" height="24" rx="6" fill="rgba(34, 197, 94, 0.2)" stroke="rgba(34, 197, 94, 0.4)" strokeWidth="1.5" />
          <text x="120" y="32" textAnchor="middle" fill="rgb(34, 197, 94)" fontSize="14" fontWeight="bold">S</text>
        </g>
        <g>
          <rect x="200" y="108" width="40" height="24" rx="6" fill="rgba(34, 197, 94, 0.2)" stroke="rgba(34, 197, 94, 0.4)" strokeWidth="1.5" />
          <text x="220" y="125" textAnchor="middle" fill="rgb(34, 197, 94)" fontSize="14" fontWeight="bold">P</text>
        </g>
        <g>
          <rect x="100" y="201" width="40" height="24" rx="6" fill="rgba(34, 197, 94, 0.2)" stroke="rgba(34, 197, 94, 0.4)" strokeWidth="1.5" />
          <text x="120" y="218" textAnchor="middle" fill="rgb(34, 197, 94)" fontSize="14" fontWeight="bold">I</text>
        </g>
        <g>
          <rect x="0" y="108" width="40" height="24" rx="6" fill="rgba(34, 197, 94, 0.2)" stroke="rgba(34, 197, 94, 0.4)" strokeWidth="1.5" />
          <text x="20" y="125" textAnchor="middle" fill="rgb(34, 197, 94)" fontSize="14" fontWeight="bold">N</text>
        </g>
      </svg>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-green-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Carregando PDI...</p>
        </div>
      </div>
    )
  }

  if (errorMessage || !pdiData) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <AlertTriangle className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
          <p className="text-xl text-gray-300 mb-2">{errorMessage || 'PDI não encontrado'}</p>
          <p className="text-sm text-gray-500">Este vendedor ainda não gerou um PDI.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white py-12 px-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="relative bg-gradient-to-br from-gray-900/60 to-gray-800/40 backdrop-blur-xl rounded-2xl p-8 border border-green-500/30">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-green-500/20 to-emerald-500/10 rounded-2xl flex items-center justify-center border border-green-500/30">
              <Target className="w-8 h-8 text-green-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-white via-green-50 to-white bg-clip-text text-transparent">
                PDI • 7 Dias
              </h1>
              <p className="text-gray-400">{pdiData.vendedor.nome} • {pdiData.vendedor.empresa}</p>
            </div>
          </div>
          <div className="flex items-center justify-between text-sm mt-4 pt-4 border-t border-gray-700/50">
            <div className="flex items-center gap-2 text-gray-400">
              <Calendar className="w-4 h-4 text-green-400" />
              <span>Gerado em {formatDate(pdiData.gerado_em)}</span>
            </div>
            <span className="text-green-400 font-semibold">{pdiData.periodo}</span>
          </div>
        </div>

        {/* Diagnóstico */}
        <div className="bg-gradient-to-br from-gray-900/60 to-gray-800/40 backdrop-blur-xl rounded-2xl p-8 border border-green-500/30">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Award className="w-6 h-6 text-green-400" />
            Diagnóstico Geral
          </h2>
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-gray-300 font-medium">Nota Geral</span>
              <span className="text-4xl font-black bg-gradient-to-br from-green-400 to-emerald-500 bg-clip-text text-transparent">
                {pdiData.diagnostico.nota_geral.toFixed(1)}
              </span>
            </div>
            <div className="w-full bg-gray-900/50 rounded-full h-3 overflow-hidden border border-gray-700/50">
              <div
                className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full"
                style={{ width: `${(pdiData.diagnostico.nota_geral / 10) * 100}%` }}
              />
            </div>
          </div>
          <p className="text-gray-300 leading-relaxed">{pdiData.diagnostico.resumo}</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* SPIN */}
          <div className="bg-gradient-to-br from-gray-900/60 to-gray-800/40 backdrop-blur-xl rounded-2xl p-8 border border-green-500/30">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
              <TrendingUp className="w-6 h-6 text-green-400" />
              Notas SPIN
            </h2>
            <div className="aspect-square max-w-sm mx-auto">
              {renderRadarChart(pdiData.notas_spin)}
            </div>
            <div className="grid grid-cols-4 gap-3 mt-6">
              <div className="text-center p-3 bg-green-900/20 rounded-xl border border-green-500/20">
                <p className="text-gray-400 text-xs mb-1">Situação</p>
                <p className="text-xl font-bold text-green-400">{pdiData.notas_spin.situacao.toFixed(1)}</p>
              </div>
              <div className="text-center p-3 bg-green-900/20 rounded-xl border border-green-500/20">
                <p className="text-gray-400 text-xs mb-1">Problema</p>
                <p className="text-xl font-bold text-green-400">{pdiData.notas_spin.problema.toFixed(1)}</p>
              </div>
              <div className="text-center p-3 bg-green-900/20 rounded-xl border border-green-500/20">
                <p className="text-gray-400 text-xs mb-1">Implicação</p>
                <p className="text-xl font-bold text-green-400">{pdiData.notas_spin.implicacao.toFixed(1)}</p>
              </div>
              <div className="text-center p-3 bg-green-900/20 rounded-xl border border-green-500/20">
                <p className="text-gray-400 text-xs mb-1">Necessidade</p>
                <p className="text-xl font-bold text-green-400">{pdiData.notas_spin.necessidade.toFixed(1)}</p>
              </div>
            </div>
          </div>

          {/* Foco */}
          <div className="bg-gradient-to-br from-gray-900/60 to-gray-800/40 backdrop-blur-xl rounded-2xl p-8 border border-green-500/30">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
              <Zap className="w-6 h-6 text-green-400" />
              Foco da Semana
            </h2>
            <div className="p-5 bg-gradient-to-r from-green-900/40 to-blue-900/40 rounded-xl border border-green-500/30">
              <div className="flex items-center gap-3 mb-3">
                <div className="px-4 py-2 bg-green-500/20 border border-green-500/40 rounded-lg">
                  <p className="text-green-300 font-bold text-2xl">
                    {pdiData.foco_da_semana?.area || pdiData.meta_7_dias?.objetivo.split(' ')[0] || '?'}
                  </p>
                </div>
                <div className="flex-1">
                  <p className="text-white font-semibold">
                    {pdiData.foco_da_semana?.objetivo || pdiData.meta_7_dias?.objetivo || 'Definir objetivo'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Simulações */}
        <div className="bg-gradient-to-br from-gray-900/60 to-gray-800/40 backdrop-blur-xl rounded-2xl p-8 border border-green-500/30">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-green-400" />
            Simulações Recomendadas
          </h2>
          <div className="space-y-4">
            {pdiData.simulacoes ? (
              pdiData.simulacoes.map((sim, idx) => (
                <div key={idx} className="p-5 bg-gray-900/40 rounded-xl border border-gray-700/50">
                  <div className="flex gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500/30 to-emerald-500/20 border border-green-500/40 flex items-center justify-center flex-shrink-0">
                      <span className="text-green-400 font-bold">{sim.quantidade}x</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-white font-semibold mb-2">{sim.objetivo}</p>
                      <div className="space-y-2 mb-2">
                        <div className="px-3 py-1.5 bg-blue-500/10 rounded-lg border border-blue-500/20 inline-block">
                          <span className="text-blue-400 text-xs font-semibold">Persona: </span>
                          <span className="text-gray-200 text-sm">{sim.persona_sugerida}</span>
                        </div>
                        {sim.objecao_para_treinar && (
                          <div className="px-3 py-1.5 bg-orange-500/10 rounded-lg border border-orange-500/20 inline-block ml-2">
                            <span className="text-orange-400 text-xs font-semibold">Objeção: </span>
                            <span className="text-gray-200 text-sm">{sim.objecao_para_treinar}</span>
                          </div>
                        )}
                      </div>
                      <div className="p-3 bg-gradient-to-br from-green-900/20 to-emerald-900/10 rounded-lg border border-green-500/20">
                        <p className="text-gray-400 text-xs mb-1 uppercase tracking-wider font-semibold">Critério de Sucesso</p>
                        <p className="text-green-300 text-sm">{sim.criterio_sucesso}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : pdiData.acoes ? (
              pdiData.acoes.map((acao, idx) => (
                <div key={idx} className="p-5 bg-gray-900/40 rounded-xl border border-gray-700/50">
                  <p className="text-white font-semibold mb-2">{acao.acao}</p>
                  <p className="text-gray-400 text-sm">{acao.resultado_esperado}</p>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center py-4">Nenhuma simulação definida ainda</p>
            )}
          </div>
        </div>

        {/* Próximo Ciclo */}
        <div className="bg-gradient-to-br from-gray-900/60 to-gray-800/40 backdrop-blur-xl rounded-2xl p-8 border border-green-500/30">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-green-400" />
            Próximo Ciclo
          </h2>
          <p className="text-gray-200 leading-relaxed">
            {pdiData.proximo_ciclo || pdiData.proximos_passos || 'Orientações aparecerão aqui...'}
          </p>
        </div>
      </div>
    </div>
  )
}

export default function PDIViewerPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-green-400 animate-spin" />
      </div>
    }>
      <PDIViewerContent />
    </Suspense>
  )
}
