'use client'

import { useState, useMemo, useEffect } from 'react'
import Image from 'next/image'
import StepIndicator from './StepIndicator'
import LeadInfoStep from './LeadInfoStep'
import CompanyInfoStep from './CompanyInfoStep'
import BusinessTypeStep from './BusinessTypeStep'
import PersonaConfigStep from './PersonaConfigStep'
import ObjectionsConfigStep from './ObjectionsConfigStep'
import ClientProfileStep from './ClientProfileStep'
import TestRoleplaySession from './TestRoleplaySession'
import TestEvaluationResults from './TestEvaluationResults'

// Keyframes CSS globais para animação das estrelas
const globalStyles = `
  @keyframes twinkle {
    0%, 100% { opacity: 0.3; }
    50% { opacity: 1; }
  }
  @keyframes float {
    from {
      transform: translateY(0px) translateX(0px);
    }
    to {
      transform: translateY(-150vh) translateX(var(--float-x));
    }
  }

  /* Custom scrollbar */
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: rgba(31, 41, 55, 0.5);
    border-radius: 10px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(34, 197, 94, 0.5);
    border-radius: 10px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(34, 197, 94, 0.7);
  }
`

// Tipos
export interface PersonaB2B {
  job_title: string
  company_type: string
  context: string
  company_goals: string
  business_challenges: string
  prior_knowledge: string
}

export interface PersonaB2C {
  profession: string
  context: string
  what_seeks: string
  main_pains: string
  prior_knowledge: string
}

export interface Objection {
  name: string
  rebuttals: string[]
}

export interface CompanyInfo {
  nome: string
  descricao: string
  produtos_servicos: string
  diferenciais: string
}

const STEPS = [
  'Seus Dados',
  'Empresa',
  'Tipo',
  'Persona',
  'Objeções',
  'Perfil',
  'Roleplay'
]

export default function TestRoleplayPage() {
  // Estado do step atual
  const [currentStep, setCurrentStep] = useState(0)

  // Step 1: Lead info
  const [leadName, setLeadName] = useState('')
  const [leadEmail, setLeadEmail] = useState('')
  const [leadPhone, setLeadPhone] = useState('')

  // Step 2: Company info
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>({
    nome: '',
    descricao: '',
    produtos_servicos: '',
    diferenciais: ''
  })

  // Step 3: Business type
  const [businessType, setBusinessType] = useState<'B2B' | 'B2C' | 'Ambos'>('B2B')

  // Step 4: Persona (quando "Ambos", o usuário escolhe qual tipo usar)
  const [selectedPersonaType, setSelectedPersonaType] = useState<'B2B' | 'B2C'>('B2B')

  // Step 4: Persona
  const [personaB2B, setPersonaB2B] = useState<PersonaB2B>({
    job_title: '',
    company_type: '',
    context: '',
    company_goals: '',
    business_challenges: '',
    prior_knowledge: ''
  })
  const [personaB2C, setPersonaB2C] = useState<PersonaB2C>({
    profession: '',
    context: '',
    what_seeks: '',
    main_pains: '',
    prior_knowledge: ''
  })

  // Step 5: Objections
  const [objections, setObjections] = useState<Objection[]>([
    { name: '', rebuttals: [] }
  ])

  // Step 6: Client profile
  const [clientAge, setClientAge] = useState(35)
  const [clientTemperament, setClientTemperament] = useState('Analítico')
  const [objective, setObjective] = useState('')

  // Session state
  const [sessionStarted, setSessionStarted] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [threadId, setThreadId] = useState<string | null>(null)
  const [clientName, setClientName] = useState<string | null>(null)
  const [firstMessage, setFirstMessage] = useState<string | null>(null)
  const [isStarting, setIsStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)

  // Evaluation state
  const [showEvaluation, setShowEvaluation] = useState(false)
  const [evaluation, setEvaluation] = useState<any>(null)

  // Carregar configurações salvas do localStorage
  useEffect(() => {
    const saved = localStorage.getItem('testRoleplayConfig')
    if (saved) {
      try {
        const config = JSON.parse(saved)
        if (config.leadName) setLeadName(config.leadName)
        if (config.leadEmail) setLeadEmail(config.leadEmail)
        if (config.leadPhone) setLeadPhone(config.leadPhone)
        if (config.companyInfo) setCompanyInfo(config.companyInfo)
        if (config.businessType) setBusinessType(config.businessType)
        if (config.selectedPersonaType) setSelectedPersonaType(config.selectedPersonaType)
        if (config.personaB2B) setPersonaB2B(config.personaB2B)
        if (config.personaB2C) setPersonaB2C(config.personaB2C)
        if (config.objections) setObjections(config.objections)
        if (config.clientAge) setClientAge(config.clientAge)
        if (config.clientTemperament) setClientTemperament(config.clientTemperament)
        if (config.objective) setObjective(config.objective)
        console.log('Configurações carregadas do localStorage')
      } catch (e) {
        console.error('Erro ao carregar configurações:', e)
      }
    }
  }, [])

  // Salvar configurações no localStorage
  const saveConfig = () => {
    const config = {
      leadName,
      leadEmail,
      leadPhone,
      companyInfo,
      businessType,
      selectedPersonaType,
      personaB2B,
      personaB2C,
      objections,
      clientAge,
      clientTemperament,
      objective
    }
    localStorage.setItem('testRoleplayConfig', JSON.stringify(config))
    alert('Configurações salvas!')
  }

  // Limpar configurações do localStorage
  const clearSavedConfig = () => {
    localStorage.removeItem('testRoleplayConfig')
    alert('Configurações removidas!')
  }

  // Gerar estrelas de forma determinística (evita hydration mismatch)
  const stars = useMemo(() => {
    const seededRandom = (seed: number) => {
      const x = Math.sin(seed * 10000) * 10000
      return x - Math.floor(x)
    }

    return [...Array(100)].map((_, i) => {
      const seed = i + 1
      return {
        id: i,
        top: seededRandom(seed) * 100,
        left: seededRandom(seed * 2) * 100,
        opacity: seededRandom(seed * 3) * 0.7 + 0.3,
        duration: seededRandom(seed * 4) * 20 + 15,
        delay: seededRandom(seed * 5) * 5,
        floatX: (seededRandom(seed * 6) > 0.5 ? 1 : -1) * seededRandom(seed * 7) * 100,
        twinkleDuration: seededRandom(seed * 8) * 2 + 1,
        twinkleDelay: seededRandom(seed * 9) * 3
      }
    })
  }, [])

  // Navegação entre steps
  const nextStep = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  // Iniciar roleplay
  const handleStartRoleplay = async () => {
    setIsStarting(true)
    setStartError(null)

    try {
      // Tipo efetivo: se "Ambos", usa o tipo selecionado pelo usuário
      const effectiveType = businessType === 'Ambos' ? selectedPersonaType : businessType
      const personaData = effectiveType === 'B2B' ? personaB2B : personaB2C

      // Filtrar objeções vazias
      const validObjections = objections.filter(obj => obj.name.trim() !== '')

      console.log('Iniciando roleplay com dados:', {
        leadName,
        leadEmail,
        businessType: effectiveType,
        validObjections: validObjections.length
      })

      const response = await fetch('/api/teste/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadName,
          leadEmail,
          leadPhone,
          companyInfo,
          businessType: effectiveType, // Envia o tipo efetivo (B2B ou B2C)
          personaData,
          objectionsData: validObjections,
          clientAge,
          clientTemperament,
          objective
        })
      })

      const data = await response.json()

      if (!response.ok) {
        console.error('Erro da API:', data)
        throw new Error(data.error || 'Erro ao iniciar roleplay')
      }

      console.log('Roleplay iniciado:', data)
      setSessionId(data.sessionId)
      setThreadId(data.threadId)
      setClientName(data.clientName)
      setFirstMessage(data.firstMessage)
      setSessionStarted(true)

      return data
    } catch (error: any) {
      console.error('Erro ao iniciar roleplay:', error)
      setStartError(error.message || 'Erro desconhecido')
    } finally {
      setIsStarting(false)
    }
  }

  // Finalizar e mostrar avaliação
  const handleShowEvaluation = (evalData: any) => {
    setEvaluation(evalData)
    setShowEvaluation(true)
  }

  // Reiniciar teste
  const handleRestart = () => {
    setCurrentStep(0)
    setLeadName('')
    setLeadEmail('')
    setLeadPhone('')
    setCompanyInfo({ nome: '', descricao: '', produtos_servicos: '', diferenciais: '' })
    setBusinessType('B2B')
    setSelectedPersonaType('B2B')
    setPersonaB2B({ job_title: '', company_type: '', context: '', company_goals: '', business_challenges: '', prior_knowledge: '' })
    setPersonaB2C({ profession: '', context: '', what_seeks: '', main_pains: '', prior_knowledge: '' })
    setObjections([{ name: '', rebuttals: [] }])
    setClientAge(35)
    setClientTemperament('Analítico')
    setObjective('')
    setSessionStarted(false)
    setSessionId(null)
    setThreadId(null)
    setClientName(null)
    setFirstMessage(null)
    setShowEvaluation(false)
    setEvaluation(null)
  }

  // Renderizar conteúdo do step atual
  const renderStepContent = () => {
    // Se já iniciou a sessão, mostrar o roleplay
    if (sessionStarted && !showEvaluation) {
      // Tipo efetivo: se "Ambos", usa o tipo selecionado
      const effectiveType = businessType === 'Ambos' ? selectedPersonaType : businessType
      const sessionPersona = effectiveType === 'B2B' ? personaB2B : personaB2C

      return (
        <TestRoleplaySession
          sessionId={sessionId!}
          threadId={threadId!}
          clientName={clientName!}
          clientAge={clientAge}
          clientTemperament={clientTemperament}
          persona={sessionPersona}
          objections={objections}
          companyInfo={companyInfo}
          businessType={effectiveType}
          objective={objective}
          firstMessage={firstMessage!}
          onEnd={handleShowEvaluation}
        />
      )
    }

    // Se mostrar avaliação
    if (showEvaluation && evaluation) {
      return (
        <TestEvaluationResults
          evaluation={evaluation}
          onRestart={handleRestart}
        />
      )
    }

    // Steps de configuração
    switch (currentStep) {
      case 0:
        return (
          <LeadInfoStep
            name={leadName}
            email={leadEmail}
            phone={leadPhone}
            onNameChange={setLeadName}
            onEmailChange={setLeadEmail}
            onPhoneChange={setLeadPhone}
            onNext={nextStep}
          />
        )
      case 1:
        return (
          <CompanyInfoStep
            companyInfo={companyInfo}
            onChange={setCompanyInfo}
            onNext={nextStep}
            onBack={prevStep}
          />
        )
      case 2:
        return (
          <BusinessTypeStep
            businessType={businessType}
            onChange={setBusinessType}
            onNext={nextStep}
            onBack={prevStep}
          />
        )
      case 3:
        return (
          <PersonaConfigStep
            businessType={businessType}
            personaB2B={personaB2B}
            personaB2C={personaB2C}
            onChangeB2B={setPersonaB2B}
            onChangeB2C={setPersonaB2C}
            onNext={nextStep}
            onBack={prevStep}
            selectedPersonaType={selectedPersonaType}
            onPersonaTypeChange={setSelectedPersonaType}
          />
        )
      case 4:
        return (
          <ObjectionsConfigStep
            objections={objections}
            onChange={setObjections}
            onNext={nextStep}
            onBack={prevStep}
          />
        )
      case 5:
        return (
          <ClientProfileStep
            age={clientAge}
            temperament={clientTemperament}
            objective={objective}
            onAgeChange={setClientAge}
            onTemperamentChange={setClientTemperament}
            onObjectiveChange={setObjective}
            onNext={nextStep}
            onBack={prevStep}
          />
        )
      case 6:
        return (
          <div className="w-full max-w-xl mx-auto">
            <div className="bg-gray-900/60 backdrop-blur-md rounded-2xl p-8 border border-green-500/20">
              <h2 className="text-2xl font-bold text-white mb-6 text-center">
                Tudo Pronto!
              </h2>
              <p className="text-gray-400 text-center mb-8">
                Revise suas configurações e clique em iniciar para começar o roleplay.
              </p>

              {/* Resumo */}
              <div className="space-y-4 mb-8">
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <p className="text-sm text-gray-400">Tipo de Negócio</p>
                  <p className="text-white font-medium">{businessType}</p>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <p className="text-sm text-gray-400">Perfil do Cliente</p>
                  <p className="text-white font-medium">{clientAge} anos, {clientTemperament}</p>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <p className="text-sm text-gray-400">Objeções</p>
                  <p className="text-white font-medium">
                    {objections.filter(o => o.name.trim()).length} objeção(ões) configurada(s)
                  </p>
                </div>
              </div>

              {/* Botões de salvar/limpar config */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={saveConfig}
                  className="flex-1 py-2 bg-blue-600/20 text-blue-400 rounded-lg text-sm font-medium hover:bg-blue-600/30 transition-all border border-blue-500/30"
                >
                  💾 Salvar Config
                </button>
                <button
                  onClick={clearSavedConfig}
                  className="flex-1 py-2 bg-red-600/20 text-red-400 rounded-lg text-sm font-medium hover:bg-red-600/30 transition-all border border-red-500/30"
                >
                  🗑️ Limpar Config
                </button>
              </div>

              {/* Erro */}
              {startError && (
                <div className="mb-4 p-4 bg-red-500/20 border border-red-500/30 rounded-lg">
                  <p className="text-red-400 text-sm font-medium">Erro: {startError}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={prevStep}
                  disabled={isStarting}
                  className="flex-1 py-3 bg-gray-700/50 text-white rounded-xl font-medium hover:bg-gray-700 transition-all disabled:opacity-50"
                >
                  Voltar
                </button>
                <button
                  onClick={handleStartRoleplay}
                  disabled={isStarting}
                  className="flex-1 py-3 bg-gradient-to-r from-green-600 to-green-500 rounded-xl font-bold text-white hover:scale-[1.02] hover:shadow-xl hover:shadow-green-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
                >
                  {isStarting ? (
                    <>
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Iniciando...
                    </>
                  ) : (
                    'Iniciar Roleplay'
                  )}
                </button>
              </div>
            </div>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden relative">
      <style jsx global>{globalStyles}</style>

      {/* Starfield background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {stars.map((star) => (
          <div
            key={star.id}
            className="absolute rounded-full bg-white"
            style={{
              width: '2px',
              height: '2px',
              top: `${star.top}%`,
              left: `${star.left}%`,
              opacity: star.opacity,
              animation: `
                twinkle ${star.twinkleDuration}s ease-in-out ${star.twinkleDelay}s infinite,
                float ${star.duration}s linear ${star.delay}s infinite
              `,
              ['--float-x' as any]: `${star.floatX}px`
            }}
          />
        ))}
      </div>

      {/* Green glow effect */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-green-500/10 rounded-full blur-[150px] pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 py-6 px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-center">
          <Image
            src="/images/ramppy-logo.png"
            alt="Ramppy"
            width={400}
            height={133}
            className="h-24 w-auto"
            priority
          />
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 px-6 pb-12">
        <div className="max-w-4xl mx-auto">
          {/* Title */}
          {!sessionStarted && !showEvaluation && (
            <>
              <div className="text-center mb-8">
                <h1 className="text-3xl md:text-4xl font-bold mb-3">
                  <span className="text-white">Teste o </span>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-lime-400">
                    Ramppy
                  </span>
                </h1>
                <p className="text-gray-400">
                  Configure seu cenário de vendas e experimente um roleplay personalizado
                </p>
              </div>

              {/* Step indicator */}
              <StepIndicator
                steps={STEPS}
                currentStep={currentStep}
              />
            </>
          )}

          {/* Step content */}
          <div className="mt-8">
            {renderStepContent()}
          </div>
        </div>
      </main>
    </div>
  )
}
