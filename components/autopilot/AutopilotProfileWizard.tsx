'use client'

import { useState, useRef, useEffect } from 'react'
import { Sparkles, ArrowRight, RotateCcw, Loader2, AlertTriangle } from 'lucide-react'

interface AutopilotProfileWizardProps {
  onComplete: (profile: { name: string; instructions: string; answers: Record<string, string> }) => void
  onCancel: () => void
  authToken: string | null
  initialName?: string
  initialAnswers?: Record<string, string>
  profileColors: string[]
}

const QUESTIONS = [
  { key: 'objetivo', question: 'Qual o objetivo com esses leads?', placeholder: 'Ex: Agendar uma demo, qualificar perfil, reativar lead que sumiu...' },
  { key: 'estrategia', question: 'Como quer que a IA conduza a conversa?', placeholder: 'Ex: Usar prova social, fazer perguntas, manter leve sem pressionar...' },
  { key: 'contexto', question: 'Qual o perfil desses leads?', placeholder: 'Ex: Donos de empresa pequena, gerentes comerciais, profissionais de marketing...' },
  { key: 'restricoes', question: 'Tem algo que a IA NÃO deve fazer?', placeholder: 'Ex: Não falar preço, não mencionar concorrente, não mandar muitas msgs...' },
  { key: 'escalonamento', question: 'Quando a IA deve parar e te chamar?', placeholder: 'Ex: Se pedir valores, se quiser fechar, se ficar agressivo...' },
]

export default function AutopilotProfileWizard({
  onComplete,
  onCancel,
  authToken,
  initialName = '',
  initialAnswers,
  profileColors
}: AutopilotProfileWizardProps) {
  const [profileName, setProfileName] = useState(initialName)
  const [step, setStep] = useState(initialName ? 0 : -1) // -1 = name step
  const [answers, setAnswers] = useState<Record<string, string>>(
    initialAnswers || { objetivo: '', estrategia: '', contexto: '', restricoes: '', escalonamento: '' }
  )
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Get current auth headers - uses getSession() for the auto-refreshed token
  const getFreshHeaders = async (): Promise<Record<string, string>> => {
    try {
      const { supabase } = await import('@/lib/supabase')
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        return { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }
      }
    } catch {}
    return authToken
      ? { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' }
      : { 'Content-Type': 'application/json' }
  }

  // Auto-scroll to bottom on step change
  useEffect(() => {
    if (scrollRef.current) {
      setTimeout(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
      }, 100)
    }
  }, [step, isGenerating, error])

  const handleNext = () => {
    setError(null)

    if (step === -1) {
      if (profileName.trim().length > 0) setStep(0)
      return
    }

    const currentKey = QUESTIONS[step].key
    if (!answers[currentKey]?.trim()) return

    if (step < QUESTIONS.length - 1) {
      setStep(prev => prev + 1)
    } else {
      // Last question answered - advance step past all questions, then generate
      setStep(QUESTIONS.length)
      handleGenerate()
    }
  }

  const handleGenerate = async () => {
    setIsGenerating(true)
    setError(null)
    try {
      const headers = await getFreshHeaders()
      const res = await fetch('/api/autopilot/improve-prompt', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          answers,
          currentInstructions: '',
          profileName: profileName.trim()
        })
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Erro ${res.status}`)
      }

      const { prompt } = await res.json()
      if (!prompt) {
        throw new Error('Resposta vazia da IA')
      }

      onComplete({
        name: profileName.trim(),
        instructions: prompt,
        answers
      })
    } catch (err: any) {
      console.error('Wizard generate error:', err)
      setError(err.message || 'Erro ao gerar instruções')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleRestart = () => {
    setStep(-1)
    setProfileName('')
    setAnswers({ objetivo: '', estrategia: '', contexto: '', restricoes: '', escalonamento: '' })
    setError(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleNext()
    }
  }

  const totalSteps = QUESTIONS.length + 1 // name + 5 questions
  const currentProgress = Math.min(step + 2, totalSteps) // step -1=1, 0=2, ..., 5=6(capped)

  // Whether a question's answer should show as a bubble (answered and moved past it)
  const isAnswered = (questionIndex: number) => step > questionIndex

  return (
    <div className="flex flex-col h-full">
      {/* Progress */}
      <div className="flex items-center gap-1.5 px-4 pt-4 pb-2">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
              i < currentProgress ? 'bg-[#00a884]' : 'bg-[#2a3942]'
            }`}
          />
        ))}
        <span className="text-[#8696a0] text-[10px] ml-1 flex-shrink-0">
          {currentProgress}/{totalSteps}
        </span>
      </div>

      {/* Chat conversation area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto whatsapp-scrollbar px-4 py-3 space-y-3">
        {/* Name step */}
        {step >= -1 && (
          <div className="space-y-2">
            <div className="flex gap-2 items-start">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#00a884] to-[#00d4a1] flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div className="bg-[#202c33] rounded-2xl rounded-tl-sm px-3.5 py-2.5 max-w-[85%]">
                <p className="text-[#e9edef] text-[13px] leading-snug">
                  Vamos configurar um perfil de lead. Como você quer chamá-lo?
                </p>
                {step === -1 && (
                  <p className="text-[#8696a0] text-[11px] mt-1">
                    Ex: "Gestor Comercial", "Dono de Empresa", "Lead Inbound"
                  </p>
                )}
              </div>
            </div>
            {profileName && step > -1 && (
              <div className="flex justify-end pl-10">
                <div className="bg-[#005c4b] rounded-2xl rounded-tr-sm px-3.5 py-2.5 max-w-[85%]">
                  <p className="text-[#e9edef] text-[13px] leading-snug">{profileName}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Question steps */}
        {QUESTIONS.map((q, i) => {
          if (i > step && i > step) return null // Don't show questions ahead of current step
          if (i > step) return null
          const answer = answers[q.key]
          return (
            <div key={q.key} className="space-y-2">
              <div className="flex gap-2 items-start">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#00a884] to-[#00d4a1] flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div className="bg-[#202c33] rounded-2xl rounded-tl-sm px-3.5 py-2.5 max-w-[85%]">
                  <p className="text-[#e9edef] text-[13px] leading-snug">{q.question}</p>
                  {i === step && step < QUESTIONS.length && (
                    <p className="text-[#8696a0] text-[11px] mt-1">{q.placeholder}</p>
                  )}
                </div>
              </div>
              {/* Show answer bubble if we've moved past this question */}
              {answer && isAnswered(i) && (
                <div className="flex justify-end pl-10">
                  <div className="bg-[#005c4b] rounded-2xl rounded-tr-sm px-3.5 py-2.5 max-w-[85%]">
                    <p className="text-[#e9edef] text-[13px] leading-snug">{answer}</p>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {/* Generating state */}
        {isGenerating && (
          <div className="flex gap-2 items-start">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#00a884] to-[#00d4a1] flex items-center justify-center flex-shrink-0">
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            </div>
            <div className="bg-[#202c33] rounded-2xl rounded-tl-sm px-3.5 py-2.5">
              <p className="text-[#e9edef] text-[13px]">Montando as instruções do perfil...</p>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && !isGenerating && (
          <div className="flex gap-2 items-start">
            <div className="w-8 h-8 rounded-full bg-red-900/50 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-4 h-4 text-red-400" />
            </div>
            <div className="bg-red-900/20 border border-red-800/30 rounded-2xl rounded-tl-sm px-3.5 py-2.5 max-w-[85%]">
              <p className="text-red-400 text-[13px]">Erro ao gerar: {error}</p>
              <button
                onClick={handleGenerate}
                className="text-[#00a884] text-[12px] mt-1.5 hover:underline"
              >
                Tentar novamente
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Input area - hidden while generating */}
      <div className="px-4 pb-4 pt-2 border-t border-[#222d35]">
        {!isGenerating && step < QUESTIONS.length && (
          <div className="flex gap-2 items-center">
            {step === -1 ? (
              <input
                type="text"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
                placeholder="Nome do perfil..."
                maxLength={50}
                className="flex-1 bg-[#2a3942] text-[#e9edef] text-[13px] rounded-full px-4 py-3 placeholder-[#8696a0]/50 outline-none focus:ring-1 focus:ring-[#00a884]/40 transition-all"
              />
            ) : (
              <input
                type="text"
                value={answers[QUESTIONS[step].key] || ''}
                onChange={(e) => setAnswers(prev => ({ ...prev, [QUESTIONS[step].key]: e.target.value }))}
                onKeyDown={handleKeyDown}
                autoFocus
                placeholder="Sua resposta..."
                className="flex-1 bg-[#2a3942] text-[#e9edef] text-[13px] rounded-full px-4 py-3 placeholder-[#8696a0]/50 outline-none focus:ring-1 focus:ring-[#00a884]/40 transition-all"
              />
            )}

            <button
              onClick={handleNext}
              disabled={
                step === -1
                  ? !profileName.trim()
                  : !answers[QUESTIONS[step].key]?.trim()
              }
              className="w-10 h-10 rounded-full flex items-center justify-center transition-all bg-[#00a884] text-white hover:bg-[#00a884]/90 disabled:opacity-20 disabled:bg-[#2a3942] flex-shrink-0"
            >
              {step === QUESTIONS.length - 1 ? (
                <Sparkles className="w-4 h-4" />
              ) : (
                <ArrowRight className="w-4 h-4" />
              )}
            </button>
          </div>
        )}

        <div className="flex items-center justify-between mt-2">
          {step > -1 && !isGenerating && (
            <button
              onClick={handleRestart}
              className="text-[11px] text-[#8696a0] hover:text-[#e9edef] transition-colors flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" /> Recomeçar
            </button>
          )}
          <button
            onClick={onCancel}
            className="text-[11px] text-[#8696a0] hover:text-[#e9edef] transition-colors ml-auto"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
