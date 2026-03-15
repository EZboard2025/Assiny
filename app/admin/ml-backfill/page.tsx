'use client'

import { useState } from 'react'

interface BackfillResult {
  success: boolean
  total?: number
  already_processed?: number
  processed?: number
  failed?: number
  results?: { id: string; status: string }[]
  error?: string
  message?: string
}

export default function MLBackfillPage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<BackfillResult | null>(null)
  const [companyId, setCompanyId] = useState('')

  const runBackfill = async () => {
    setLoading(true)
    setResult(null)

    try {
      const body: any = {}
      if (companyId.trim()) body.companyId = companyId.trim()

      const response = await fetch('/api/meet/backfill-patterns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await response.json()
      setResult(data)
    } catch (err: any) {
      setResult({ success: false, error: err.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0a',
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{
        background: '#1a1a2e',
        borderRadius: 16,
        padding: 40,
        maxWidth: 600,
        width: '100%',
        textAlign: 'center',
      }}>
        <h1 style={{ fontSize: 24, marginBottom: 8 }}>ML Backfill</h1>
        <p style={{ color: '#888', marginBottom: 24, fontSize: 14 }}>
          Transforma reunioes de Meet ja avaliadas em dados para o Machine Learning dos roleplays.
        </p>

        <input
          type="text"
          placeholder="Company ID (vazio = todas)"
          value={companyId}
          onChange={(e) => setCompanyId(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 14px',
            borderRadius: 8,
            border: '1px solid #333',
            background: '#111',
            color: '#fff',
            marginBottom: 16,
            fontSize: 14,
            boxSizing: 'border-box',
          }}
        />

        <button
          onClick={runBackfill}
          disabled={loading}
          style={{
            width: '100%',
            padding: '14px 24px',
            borderRadius: 8,
            border: 'none',
            background: loading ? '#333' : 'linear-gradient(135deg, #7c3aed, #ec4899)',
            color: '#fff',
            fontSize: 16,
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Processando... (pode demorar alguns minutos)' : 'Iniciar Backfill'}
        </button>

        {result && (
          <div style={{
            marginTop: 24,
            padding: 20,
            borderRadius: 8,
            background: result.success ? '#0d2818' : '#2d0a0a',
            border: `1px solid ${result.success ? '#166534' : '#7f1d1d'}`,
            textAlign: 'left',
            fontSize: 14,
          }}>
            {result.error ? (
              <p style={{ color: '#f87171' }}>Erro: {result.error}</p>
            ) : result.message ? (
              <p style={{ color: '#4ade80' }}>{result.message}</p>
            ) : (
              <>
                <p style={{ color: '#4ade80', fontWeight: 600, marginBottom: 12 }}>Backfill concluido!</p>
                <p>Total de avaliacoes encontradas: <strong>{result.total}</strong></p>
                <p>Ja processadas antes: <strong>{result.already_processed}</strong></p>
                <p>Processadas agora: <strong style={{ color: '#4ade80' }}>{result.processed}</strong></p>
                {(result.failed || 0) > 0 && (
                  <p>Falharam: <strong style={{ color: '#f87171' }}>{result.failed}</strong></p>
                )}

                {result.results && result.results.length > 0 && (
                  <div style={{ marginTop: 12, maxHeight: 200, overflow: 'auto' }}>
                    <p style={{ color: '#888', fontSize: 12, marginBottom: 4 }}>Detalhes:</p>
                    {result.results.map((r, i) => (
                      <div key={i} style={{
                        fontSize: 12,
                        color: r.status === 'ok' ? '#4ade80' : r.status === 'skipped' ? '#fbbf24' : '#f87171',
                        padding: '2px 0',
                      }}>
                        {r.id.substring(0, 8)}... → {r.status}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <p style={{ color: '#555', fontSize: 11, marginTop: 20 }}>
          Pagina temporaria — pode apagar depois de usar.
        </p>
      </div>
    </div>
  )
}
