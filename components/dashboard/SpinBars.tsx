'use client'

interface SpinBarsProps {
  scores: { S: number; P: number; I: number; N: number }
  loading?: boolean
  onClick?: () => void
}

const SPIN_LABELS: Record<string, string> = {
  S: 'Situação',
  P: 'Problema',
  I: 'Implicação',
  N: 'Necessidade',
}

function getScoreColor(score: number): string {
  if (score >= 7) return 'bg-green-500'
  if (score >= 5) return 'bg-yellow-500'
  return 'bg-red-500'
}

function getScoreTextColor(score: number): string {
  if (score >= 7) return 'text-green-600'
  if (score >= 5) return 'text-yellow-600'
  return 'text-red-500'
}

export default function SpinBars({ scores, loading, onClick }: SpinBarsProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-32 mb-4" />
        <div className="space-y-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i}>
              <div className="h-3 bg-gray-200 rounded w-20 mb-2" />
              <div className="h-3 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const entries = Object.entries(scores) as [string, number][]
  const minScore = Math.min(...entries.map(([, v]) => v))
  const hasData = entries.some(([, v]) => v > 0)

  return (
    <div
      className={`bg-white rounded-xl border border-gray-200 p-5 ${onClick ? 'cursor-pointer hover:border-green-300 hover:shadow-sm transition-all' : ''}`}
      onClick={onClick}
    >
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Métricas SPIN</h3>

      {!hasData ? (
        <div className="py-8 text-center">
          <p className="text-sm text-gray-400">Complete sessões para ver suas métricas</p>
        </div>
      ) : (
        <div className="space-y-4">
          {entries.map(([letter, score]) => {
            const isWeakest = score === minScore && score < 7
            return (
              <div key={letter}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-700 w-5">{letter}</span>
                    <span className="text-xs text-gray-500">{SPIN_LABELS[letter]}</span>
                    {isWeakest && (
                      <span className="text-[10px] font-semibold text-red-500 bg-red-50 px-1.5 py-0.5 rounded border border-red-100">
                        foco
                      </span>
                    )}
                  </div>
                  <span className={`text-sm font-bold ${getScoreTextColor(score)}`}>
                    {score.toFixed(1)}
                  </span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${getScoreColor(score)}`}
                    style={{ width: `${Math.min(score * 10, 100)}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
