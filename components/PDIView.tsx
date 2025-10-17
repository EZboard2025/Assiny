'use client'

import { useState } from 'react'

interface PDIData {
  versao?: string
  gerado_em: string
  periodo: string
  vendedor?: {
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
  meta_7_dias: {
    objetivo: string
    nota_atual: number
    nota_meta: number
    como_medir: string
  }
  acoes: Array<{
    acao: string
    resultado_esperado: string
  }>
  checkpoint: {
    quando: string
    como_avaliar: string
  }
  proximos_passos: string
}

export default function PDIView() {
  const [pdiData] = useState<PDIData | null>(null)
  const [isLoading] = useState(false)
  const hasData = pdiData !== null

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    })
  }

  const renderRadarChart = (scores: { situacao: number; problema: number; implicacao: number; necessidade: number }) => {
    const labels = ['S', 'P', 'I', 'N']
    const values = [scores.situacao, scores.problema, scores.implicacao, scores.necessidade]
    const max = 10
    const centerX = 100
    const centerY = 100
    const radius = 70
    const angleStep = (Math.PI * 2) / 4
    const startAngle = -Math.PI / 2

    const points = values.map((value, index) => {
      const angle = startAngle + angleStep * index
      const r = (value / max) * radius
      const x = centerX + r * Math.cos(angle)
      const y = centerY + r * Math.sin(angle)
      return `${x},${y}`
    }).join(' ')

    const labelPositions = labels.map((label, index) => {
      const angle = startAngle + angleStep * index
      const r = radius + 20
      const x = centerX + r * Math.cos(angle)
      const y = centerY + r * Math.sin(angle)
      return { label, x, y, value: values[index] }
    })

    return (
      <svg viewBox="0 0 200 200" className="w-full h-full">
        {[0.25, 0.5, 0.75, 1].map((scale, i) => (
          <circle key={i} cx={centerX} cy={centerY} r={radius * scale} fill="none" stroke="#374151" strokeWidth="0.5" opacity="0.3" />
        ))}
        {labels.map((_, index) => {
          const angle = startAngle + angleStep * index
          const x = centerX + radius * Math.cos(angle)
          const y = centerY + radius * Math.sin(angle)
          return <line key={index} x1={centerX} y1={centerY} x2={x} y2={y} stroke="#374151" strokeWidth="0.5" opacity="0.3" />
        })}
        <polygon points={points} fill="rgba(147, 51, 234, 0.3)" stroke="#a855f7" strokeWidth="2" />
        {values.map((value, index) => {
          const angle = startAngle + angleStep * index
          const r = (value / max) * radius
          const x = centerX + r * Math.cos(angle)
          const y = centerY + r * Math.sin(angle)
          return <circle key={index} cx={x} cy={y} r="3" fill="#a855f7" stroke="#fff" strokeWidth="1" />
        })}
        {labelPositions.map((pos, index) => (
          <g key={index}>
            <text x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="middle" className="fill-gray-300 font-bold text-sm">{pos.label}</text>
            <text x={pos.x} y={pos.y + 12} textAnchor="middle" dominantBaseline="middle" className="fill-purple-400 font-semibold text-xs">{pos.value.toFixed(1)}</text>
          </g>
        ))}
      </svg>
    )
  }

  const renderEmptyRadarChart = () => {
    const labels = ['S', 'P', 'I', 'N']
    const centerX = 100
    const centerY = 100
    const radius = 70
    const angleStep = (Math.PI * 2) / 4
    const startAngle = -Math.PI / 2

    const labelPositions = labels.map((label, index) => {
      const angle = startAngle + angleStep * index
      const r = radius + 20
      const x = centerX + r * Math.cos(angle)
      const y = centerY + r * Math.sin(angle)
      return { label, x, y }
    })

    return (
      <svg viewBox="0 0 200 200" className="w-full h-full opacity-30">
        {[0.25, 0.5, 0.75, 1].map((scale, i) => (
          <circle key={i} cx={centerX} cy={centerY} r={radius * scale} fill="none" stroke="#374151" strokeWidth="0.5" />
        ))}
        {labels.map((_, index) => {
          const angle = startAngle + angleStep * index
          const x = centerX + radius * Math.cos(angle)
          const y = centerY + radius * Math.sin(angle)
          return <line key={index} x1={centerX} y1={centerY} x2={x} y2={y} stroke="#374151" strokeWidth="0.5" />
        })}
        {labelPositions.map((pos, index) => (
          <text key={index} x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="middle" className="fill-gray-500 font-bold text-sm">{pos.label}</text>
        ))}
      </svg>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white overflow-hidden relative">
        {/* Animated background particles */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="stars"></div>
          <div className="stars2"></div>
          <div className="stars3"></div>
        </div>

        <div className="relative z-10 flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-purple-500 mx-auto"></div>
            <p className="text-gray-400 mt-4">Gerando seu PDI...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden relative">
      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="stars"></div>
        <div className="stars2"></div>
        <div className="stars3"></div>
      </div>

      <div className="relative z-10 p-4 md:p-8 overflow-y-auto min-h-screen">
        <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">

        {/* Header */}
        <div className="bg-gradient-to-r from-purple-900/40 to-blue-900/40 rounded-2xl p-6 md:p-8 border border-purple-500/20 shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
                PDI - Plano de Desenvolvimento Individual
              </h1>
              <p className="text-gray-300 text-lg">
                {hasData && pdiData.vendedor ? `${pdiData.vendedor.nome} • ${pdiData.vendedor.empresa}` : 'Aguardando dados...'}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <span className="px-4 py-2 rounded-lg border font-semibold text-center bg-purple-500/20 text-purple-400 border-purple-500/30">
                {hasData ? pdiData.periodo : '7 dias'}
              </span>
              {hasData && pdiData.vendedor && (
                <div className="text-right md:text-center">
                  <p className="text-sm text-gray-400">Total de Sessões</p>
                  <p className="text-2xl font-bold text-white">{pdiData.vendedor.total_sessoes}</p>
                </div>
              )}
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-700">
            <p className="text-sm text-gray-400">
              {hasData ? `Gerado em ${formatDate(pdiData.gerado_em)}` : 'PDI será gerado após completar sessões de roleplay'}
            </p>
          </div>
        </div>

        {/* Diagnóstico Geral */}
        <div className="bg-gray-800/50 rounded-2xl p-6 md:p-8 border border-gray-700/50 shadow-xl">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <span className="text-3xl">🎯</span>
            Diagnóstico Geral
          </h2>

          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-300 font-medium">Nota Geral</span>
              <span className="text-2xl font-bold text-gray-500">{hasData ? pdiData.diagnostico.nota_geral.toFixed(1) : '---'}</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-gray-600 to-gray-500 rounded-full transition-all duration-1000"
                style={{ width: hasData ? `${(pdiData.diagnostico.nota_geral / 10) * 100}%` : '0%' }}
              ></div>
            </div>
          </div>

          <div className="p-4 bg-blue-900/20 rounded-lg border border-blue-500/30">
            <p className="text-gray-400 leading-relaxed italic">
              {hasData ? pdiData.diagnostico.resumo : 'O resumo do seu diagnóstico aparecerá aqui após a geração do PDI...'}
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Notas SPIN */}
          <div className="bg-gray-800/50 rounded-2xl p-6 md:p-8 border border-gray-700/50 shadow-xl">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <span className="text-3xl">📊</span>
              Notas SPIN
            </h2>
            <div className="aspect-square max-w-sm mx-auto">
              {hasData ? renderRadarChart(pdiData.notas_spin) : renderEmptyRadarChart()}
            </div>
            <div className="mt-6 grid grid-cols-4 gap-2">
              <div className="text-center p-3 bg-purple-900/30 rounded-lg">
                <p className="text-gray-400 text-xs mb-1">Situação</p>
                <p className="text-gray-500 font-bold text-lg">{hasData ? pdiData.notas_spin.situacao.toFixed(1) : '---'}</p>
              </div>
              <div className="text-center p-3 bg-purple-900/30 rounded-lg">
                <p className="text-gray-400 text-xs mb-1">Problema</p>
                <p className="text-gray-500 font-bold text-lg">{hasData ? pdiData.notas_spin.problema.toFixed(1) : '---'}</p>
              </div>
              <div className="text-center p-3 bg-purple-900/30 rounded-lg">
                <p className="text-gray-400 text-xs mb-1">Implicação</p>
                <p className="text-gray-500 font-bold text-lg">{hasData ? pdiData.notas_spin.implicacao.toFixed(1) : '---'}</p>
              </div>
              <div className="text-center p-3 bg-purple-900/30 rounded-lg">
                <p className="text-gray-400 text-xs mb-1">Necessidade</p>
                <p className="text-gray-500 font-bold text-lg">{hasData ? pdiData.notas_spin.necessidade.toFixed(1) : '---'}</p>
              </div>
            </div>
          </div>

          {/* Meta 7 Dias */}
          <div className="bg-gray-800/50 rounded-2xl p-6 md:p-8 border border-gray-700/50 shadow-xl">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <span className="text-3xl">🎯</span>
              Meta de 7 Dias
            </h2>

            <div className="p-5 bg-gradient-to-r from-purple-900/40 to-blue-900/40 rounded-xl border border-purple-500/30 mb-4">
              <p className="text-purple-300 font-semibold mb-2 text-sm">OBJETIVO</p>
              <p className="text-gray-400 text-base italic mb-4">{hasData ? pdiData.meta_7_dias.objetivo : 'Seu objetivo será definido aqui...'}</p>

              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-300 text-sm">Progresso</span>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 font-bold">{hasData ? pdiData.meta_7_dias.nota_atual.toFixed(1) : '---'}</span>
                    <span className="text-gray-500">→</span>
                    <span className="text-gray-500 font-bold">{hasData ? pdiData.meta_7_dias.nota_meta.toFixed(1) : '---'}</span>
                  </div>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-gray-600 to-gray-500 rounded-full transition-all duration-1000"
                    style={{
                      width: hasData ? `${(pdiData.meta_7_dias.nota_atual / pdiData.meta_7_dias.nota_meta) * 100}%` : '0%'
                    }}
                  ></div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700">
              <p className="text-gray-400 text-xs mb-1 font-semibold">COMO MEDIR</p>
              <p className="text-gray-400 text-sm italic">{hasData ? pdiData.meta_7_dias.como_medir : 'Critérios de medição serão definidos...'}</p>
            </div>
          </div>
        </div>

        {/* Ações */}
        <div className="bg-gray-800/50 rounded-2xl p-6 md:p-8 border border-gray-700/50 shadow-xl">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <span className="text-3xl">📋</span>
            Ações para os Próximos 7 Dias
          </h2>
          <div className="space-y-4">
            {hasData ? (
              pdiData.acoes.map((acao, index) => (
                <div
                  key={index}
                  className="p-5 bg-gray-900/50 rounded-xl border border-gray-700 hover:border-purple-500/50 transition-all duration-300"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-purple-900/40 border border-purple-500/40 flex items-center justify-center flex-shrink-0">
                      <span className="text-purple-400 font-bold">{index + 1}</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-white font-semibold mb-3">{acao.acao}</p>
                      <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                        <p className="text-gray-500 text-xs mb-1">Resultado Esperado</p>
                        <p className="text-purple-400 text-sm">{acao.resultado_esperado}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <>
                <div className="p-5 bg-gray-900/50 rounded-xl border border-gray-700">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-gray-700/40 border border-gray-600/40 flex items-center justify-center flex-shrink-0">
                      <span className="text-gray-500 font-bold">1</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-gray-400 font-semibold mb-3 italic">Ação 1 será definida aqui...</p>
                      <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                        <p className="text-gray-500 text-xs mb-1">Resultado Esperado</p>
                        <p className="text-gray-500 text-sm italic">---</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-5 bg-gray-900/50 rounded-xl border border-gray-700">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-gray-700/40 border border-gray-600/40 flex items-center justify-center flex-shrink-0">
                      <span className="text-gray-500 font-bold">2</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-gray-400 font-semibold mb-3 italic">Ação 2 será definida aqui...</p>
                      <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                        <p className="text-gray-500 text-xs mb-1">Resultado Esperado</p>
                        <p className="text-gray-500 text-sm italic">---</p>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Checkpoint e Próximos Passos */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Checkpoint */}
          <div className="bg-gray-800/50 rounded-2xl p-6 md:p-8 border border-gray-700/50 shadow-xl">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <span className="text-3xl">✅</span>
              Checkpoint
            </h2>
            <div className="p-5 bg-gray-900/50 rounded-lg border border-gray-700">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-full bg-blue-900/30 border border-blue-500/30 flex items-center justify-center">
                  <span className="text-blue-400 font-bold text-lg">{hasData ? pdiData.checkpoint.quando : '?'}</span>
                </div>
                <p className="text-blue-400 font-semibold">{hasData ? pdiData.checkpoint.quando : 'Data do checkpoint...'}</p>
              </div>
              <p className="text-gray-400 text-sm italic">{hasData ? pdiData.checkpoint.como_avaliar : 'Forma de avaliação será definida...'}</p>
            </div>
          </div>

          {/* Próximos Passos */}
          <div className="bg-gradient-to-r from-purple-900/60 to-blue-900/60 rounded-2xl p-6 md:p-8 border border-purple-500/40 shadow-xl">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <span className="text-3xl">🚀</span>
              Próximos Passos
            </h2>
            <p className="text-gray-300 leading-relaxed italic">
              {hasData ? pdiData.proximos_passos : 'Orientações sobre os próximos passos aparecerão aqui após a geração do PDI...'}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center py-6">
          <p className="text-gray-500 text-sm">
            PDI gerado automaticamente pela plataforma Assiny • Foco em resultados em 7 dias
          </p>
        </div>
        </div>
      </div>
    </div>
  )
}
