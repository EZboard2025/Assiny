'use client'

import { useState, useRef, useEffect } from 'react'
import { Sparkles, Send, Loader2, Check, X, Pencil, Bot, CheckCircle, Mic, MicOff } from 'lucide-react'
import { addPersona } from '@/lib/config'
import type { Persona, PersonaB2B, PersonaB2C } from '@/lib/config'

// Web Speech API types (not in default TS lib)
interface SpeechRecognitionResult {
  readonly isFinal: boolean
  readonly length: number
  [index: number]: { transcript: string; confidence: number }
}
interface SpeechRecognitionResultList {
  readonly length: number
  [index: number]: SpeechRecognitionResult
}
interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number
  readonly results: SpeechRecognitionResultList
}
interface SpeechRecognitionInstance extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
  start(): void
  stop(): void
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const window: Window & { SpeechRecognition?: any; webkitSpeechRecognition?: any }

type FieldConfig = { key: string; label: string; type: 'input' | 'textarea' }

const B2B_FIELDS: FieldConfig[] = [
  { key: 'job_title', label: 'Cargo', type: 'input' },
  { key: 'company_type', label: 'Tipo de Empresa e Faturamento', type: 'textarea' },
  { key: 'context', label: 'Contexto', type: 'textarea' },
  { key: 'company_goals', label: 'O que busca para a empresa', type: 'textarea' },
  { key: 'business_challenges', label: 'Desafios/Dores do negócio', type: 'textarea' },
  { key: 'prior_knowledge', label: 'Conhecimento prévio', type: 'textarea' },
]

const B2C_FIELDS: FieldConfig[] = [
  { key: 'profession', label: 'Profissão', type: 'input' },
  { key: 'context', label: 'Contexto', type: 'textarea' },
  { key: 'what_seeks', label: 'O que busca/valoriza', type: 'textarea' },
  { key: 'main_pains', label: 'Principais dores/problemas', type: 'textarea' },
  { key: 'prior_knowledge', label: 'Conhecimento prévio', type: 'textarea' },
]

interface FieldProposal {
  field: string
  label: string
  value: string
  status: 'pending' | 'accepted' | 'rejected' | 'editing'
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  proposals?: FieldProposal[]
}

interface PersonaChatProps {
  personaType: 'B2B' | 'B2C'
  personaData: Record<string, string>
  companyData?: Record<string, string> | null
  businessType?: string
  onFieldUpdate: (field: string, value: string) => void
  onPersonaSaved: (persona: Persona) => void
  onCancel: () => void
}

export default function PersonaChat({ personaType, personaData, companyData, onFieldUpdate, onPersonaSaved, onCancel }: PersonaChatProps) {
  const fields = personaType === 'B2B' ? B2B_FIELDS : B2C_FIELDS
  const fieldKeys = fields.map(f => f.key)

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: personaType === 'B2B'
        ? 'Olá! Vou te ajudar a criar uma persona de cliente B2B para treinamento de vendas. Me conte sobre o perfil do cliente ideal: qual o cargo, tipo de empresa, desafios que enfrenta?'
        : 'Olá! Vou te ajudar a criar uma persona de cliente B2C para treinamento de vendas. Me conte sobre o perfil do consumidor: profissão, contexto de vida, o que busca, quais suas dores?'
    }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [editingProposal, setEditingProposal] = useState<{ msgId: string; field: string } | null>(null)
  const [editValue, setEditValue] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)

  const filledCount = fieldKeys.filter(f => personaData[f]?.trim()).length
  const totalFields = fieldKeys.length
  const allFilled = filledCount === totalFields
  const hasStartedChat = messages.length > 1
  const progressPercent = (filledCount / totalFields) * 100

  // Auto-save when all fields are filled during chat
  const prevFilledRef = useRef(filledCount)
  const autoSavedRef = useRef(false)

  useEffect(() => {
    if (allFilled && prevFilledRef.current < totalFields && !autoSavedRef.current && hasStartedChat && !isSaved) {
      autoSavedRef.current = true
      handleSavePersona()
    }
    prevFilledRef.current = filledCount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filledCount, allFilled, totalFields, hasStartedChat, isSaved])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  // Cleanup recognition on unmount
  useEffect(() => {
    return () => { recognitionRef.current?.stop() }
  }, [])

  const handleSavePersona = async () => {
    setIsSaving(true)
    try {
      let result: Persona | null
      if (personaType === 'B2B') {
        const b2b: Omit<PersonaB2B, 'id' | 'created_at' | 'updated_at'> = {
          business_type: 'B2B',
          job_title: personaData.job_title || '',
          company_type: personaData.company_type || '',
          context: personaData.context || '',
          company_goals: personaData.company_goals || '',
          business_challenges: personaData.business_challenges || '',
          prior_knowledge: personaData.prior_knowledge || '',
        }
        result = await addPersona(b2b)
      } else {
        const b2c: Omit<PersonaB2C, 'id' | 'created_at' | 'updated_at'> = {
          business_type: 'B2C',
          profession: personaData.profession || '',
          context: personaData.context || '',
          what_seeks: personaData.what_seeks || '',
          main_pains: personaData.main_pains || '',
          prior_knowledge: personaData.prior_knowledge || '',
        }
        result = await addPersona(b2c)
      }
      if (result) {
        setIsSaved(true)
        onPersonaSaved(result)
      }
    } catch (err) {
      console.error('Erro ao salvar persona:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const buildApiMessages = (msgs: ChatMessage[]) => {
    return msgs
      .filter(m => m.id !== 'welcome')
      .map(m => {
        if (m.role === 'assistant' && m.proposals?.length) {
          const proposalText = m.proposals
            .map(p => {
              if (p.status === 'accepted') return `[${p.label}: "${p.value}" - ACEITO]`
              if (p.status === 'rejected') return `[${p.label}: "${p.value}" - REJEITADO, precisa reformular]`
              return `[${p.label}: "${p.value}" - pendente]`
            })
            .join('\n')
          return { role: m.role, content: m.content + '\n\nPropostas:\n' + proposalText }
        }
        return { role: m.role, content: m.content }
      })
  }

  const sendToAiChat = async (updatedMessages: ChatMessage[], fieldOverrides?: Record<string, string>) => {
    try {
      const mergedFields = { ...personaData, ...fieldOverrides }
      const res = await fetch('/api/company/persona-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: buildApiMessages(updatedMessages),
          currentFields: mergedFields,
          personaType,
          companyContext: companyData,
        })
      })

      if (!res.ok) throw new Error('Erro na API')

      const data = await res.json()

      const aiMsg: ChatMessage = {
        id: `ai_${Date.now()}`,
        role: 'assistant',
        content: data.message || '',
        proposals: (data.proposals || []).map((p: { field: string; label: string; value: string }) => ({
          ...p,
          status: 'pending' as const
        }))
      }

      setMessages(prev => [...prev, aiMsg])
    } catch (err) {
      console.error('Erro persona-chat:', err)
      setMessages(prev => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: 'assistant',
          content: 'Desculpe, houve um erro. Tente novamente.'
        }
      ])
    }
  }

  const handleSend = async () => {
    const text = input.trim()
    if (!text || isLoading) return

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: text,
    }

    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    setInput('')
    setIsLoading(true)

    await sendToAiChat(updatedMessages)
    setIsLoading(false)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const getAcceptedOverrides = (newMessages: ChatMessage[], msgId: string, extraField?: string, extraValue?: string) => {
    const msg = newMessages.find(m => m.id === msgId)
    const overrides: Record<string, string> = {}
    msg?.proposals?.forEach(p => {
      if (p.status === 'accepted') overrides[p.field] = p.value
    })
    if (extraField && extraValue) overrides[extraField] = extraValue
    return overrides
  }

  const autoContinueIfResolved = async (newMessages: ChatMessage[], msgId: string, overrides: Record<string, string>) => {
    const msg = newMessages.find(m => m.id === msgId)
    if (!msg?.proposals?.length) return
    const allResolved = msg.proposals.every(p => p.status === 'accepted' || p.status === 'rejected')
    if (allResolved && !isLoading) {
      setIsLoading(true)
      await sendToAiChat(newMessages, overrides)
      setIsLoading(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  const handleProposalAction = (msgId: string, field: string, action: 'accept' | 'reject' | 'edit') => {
    if (action === 'accept') {
      const msg = messages.find(m => m.id === msgId)
      const proposal = msg?.proposals?.find(p => p.field === field)
      if (proposal) onFieldUpdate(field, proposal.value)
      const newMessages = messages.map(m =>
        m.id === msgId
          ? { ...m, proposals: m.proposals?.map(p => p.field === field ? { ...p, status: 'accepted' as const } : p) }
          : m
      )
      setMessages(newMessages)
      const overrides = getAcceptedOverrides(newMessages, msgId, field, proposal?.value)
      autoContinueIfResolved(newMessages, msgId, overrides)
    } else if (action === 'reject') {
      const newMessages = messages.map(m =>
        m.id === msgId
          ? { ...m, proposals: m.proposals?.map(p => p.field === field ? { ...p, status: 'rejected' as const } : p) }
          : m
      )
      setMessages(newMessages)
      const overrides = getAcceptedOverrides(newMessages, msgId)
      autoContinueIfResolved(newMessages, msgId, overrides)
    } else if (action === 'edit') {
      const msg = messages.find(m => m.id === msgId)
      const proposal = msg?.proposals?.find(p => p.field === field)
      if (proposal) {
        setEditingProposal({ msgId, field })
        setEditValue(proposal.value)
        setMessages(prev =>
          prev.map(m =>
            m.id === msgId
              ? { ...m, proposals: m.proposals?.map(p => p.field === field ? { ...p, status: 'editing' as const } : p) }
              : m
          )
        )
      }
    }
  }

  const handleEditConfirm = () => {
    if (!editingProposal) return
    const { msgId, field } = editingProposal
    onFieldUpdate(field, editValue.trim())
    const newMessages = messages.map(m =>
      m.id === msgId
        ? { ...m, proposals: m.proposals?.map(p => p.field === field ? { ...p, value: editValue.trim(), status: 'accepted' as const } : p) }
        : m
    )
    setMessages(newMessages)
    setEditingProposal(null)
    setEditValue('')
    const overrides = getAcceptedOverrides(newMessages, msgId, field, editValue.trim())
    autoContinueIfResolved(newMessages, msgId, overrides)
  }

  const handleEditCancel = () => {
    if (!editingProposal) return
    const { msgId, field } = editingProposal
    setMessages(prev =>
      prev.map(m =>
        m.id === msgId
          ? { ...m, proposals: m.proposals?.map(p => p.field === field ? { ...p, status: 'pending' as const } : p) }
          : m
      )
    )
    setEditingProposal(null)
    setEditValue('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const toggleDictation = () => {
    if (isListening) {
      recognitionRef.current?.stop()
      return
    }
    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognitionCtor) return

    const recognition: SpeechRecognitionInstance = new SpeechRecognitionCtor()
    recognition.lang = 'pt-BR'
    recognition.continuous = true
    recognition.interimResults = true

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = ''
      let interimTranscript = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) finalTranscript += transcript
        else interimTranscript = transcript
      }
      if (finalTranscript) {
        setInput(prev => prev + (prev && !prev.endsWith(' ') ? ' ' : '') + finalTranscript)
      }
      if (interimTranscript && inputRef.current) {
        inputRef.current.placeholder = interimTranscript + '...'
      }
    }

    recognition.onend = () => {
      setIsListening(false)
      recognitionRef.current = null
      if (inputRef.current) {
        inputRef.current.placeholder = 'Descreva o perfil do cliente...'
      }
    }

    recognition.onerror = () => {
      setIsListening(false)
      recognitionRef.current = null
    }

    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100 bg-gray-50/50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-green-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Criar Persona {personaType}</h3>
            <p className="text-[11px] text-gray-400">Preencha conversando com a IA</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-24 bg-gray-100 rounded-full h-1.5">
            <div
              className="bg-green-500 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-xs font-medium text-gray-500">{filledCount}/{totalFields}</span>
        </div>
      </div>

      {/* Messages Area */}
      <div
        className="h-[340px] overflow-y-auto px-5 py-4 space-y-4 bg-gray-50/30"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,0,0,0.08) transparent' }}
      >
        {messages.map((msg) => (
          <div key={msg.id}>
            {msg.role === 'assistant' ? (
              <div className="flex gap-2.5 max-w-[92%]">
                <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5 text-green-600" />
                </div>
                <div className="flex-1 space-y-2">
                  <div className="px-3.5 py-2.5 bg-white border border-gray-200 rounded-2xl rounded-tl-md shadow-sm">
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{msg.content}</p>
                  </div>
                  {msg.proposals?.map((p) => (
                    <div
                      key={p.field}
                      className={`rounded-xl border p-3.5 transition-all ${
                        p.status === 'accepted'
                          ? 'bg-green-50 border-green-200'
                          : p.status === 'rejected'
                          ? 'bg-gray-50 border-gray-200 opacity-50'
                          : p.status === 'editing'
                          ? 'bg-blue-50 border-blue-200'
                          : 'bg-white border-gray-200 shadow-sm'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{p.label}</span>
                        {p.status === 'accepted' && <CheckCircle className="w-3 h-3 text-green-500" />}
                      </div>
                      {p.status === 'editing' && editingProposal?.field === p.field ? (
                        <div className="space-y-2">
                          <textarea
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            rows={3}
                            className="w-full px-3 py-2 text-sm border border-blue-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none"
                            autoFocus
                          />
                          <div className="flex gap-1.5">
                            <button onClick={handleEditConfirm} className="px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1">
                              <Check className="w-3 h-3" />Confirmar
                            </button>
                            <button onClick={handleEditCancel} className="px-3 py-1.5 text-xs font-medium bg-white text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="text-sm text-gray-700 mb-2.5 leading-relaxed">{p.value}</p>
                          {p.status === 'pending' && (
                            <div className="flex gap-1.5">
                              <button onClick={() => handleProposalAction(msg.id, p.field, 'accept')} className="px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1 shadow-sm">
                                <Check className="w-3 h-3" />Sim
                              </button>
                              <button onClick={() => handleProposalAction(msg.id, p.field, 'reject')} className="px-3 py-1.5 text-xs font-medium bg-white text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-1">
                                <X className="w-3 h-3" />Não
                              </button>
                              <button onClick={() => handleProposalAction(msg.id, p.field, 'edit')} className="px-3 py-1.5 text-xs font-medium bg-white text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1">
                                <Pencil className="w-3 h-3" />Personalizar
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex justify-end">
                <div className="max-w-[80%] px-3.5 py-2.5 rounded-2xl rounded-br-md bg-green-600 text-white text-sm leading-relaxed shadow-sm">
                  {msg.content}
                </div>
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-2.5 max-w-[92%]">
            <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-green-600 animate-pulse" />
            </div>
            <div className="flex items-center gap-2 px-3.5 py-2.5 bg-white border border-gray-200 rounded-2xl rounded-tl-md shadow-sm">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-green-500" />
              <span className="text-xs text-gray-400">Criando persona...</span>
            </div>
          </div>
        )}
        {isSaving && (
          <div className="flex gap-2.5 max-w-[92%]">
            <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-green-600 animate-pulse" />
            </div>
            <div className="flex items-center gap-2 px-3.5 py-2.5 bg-white border border-gray-200 rounded-2xl rounded-tl-md shadow-sm">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-green-500" />
              <span className="text-xs text-gray-400">Salvando persona...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      {!isSaved ? (
        <div className="px-5 py-3 border-t border-gray-100 bg-white">
          <div className="flex gap-2 items-end">
            <button
              onClick={toggleDictation}
              disabled={isLoading}
              className={`p-2.5 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 ${
                isListening
                  ? 'text-white bg-red-500 hover:bg-red-600 animate-pulse shadow-md shadow-red-500/30'
                  : 'text-white bg-green-500 hover:bg-green-600 shadow-sm shadow-green-500/20'
              }`}
              title={isListening ? 'Parar ditado' : 'Ditar mensagem'}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px'
              }}
              onKeyDown={handleKeyDown}
              placeholder="Descreva o perfil do cliente..."
              rows={1}
              className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 resize-none transition-all overflow-y-auto"
              style={{ minHeight: '40px', maxHeight: '160px' }}
              disabled={isLoading}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="p-2.5 rounded-xl bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 shadow-sm"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <div className="flex justify-end mt-2">
            <button onClick={onCancel} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="px-5 py-4 border-t border-gray-100 bg-green-50/50 flex items-center justify-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-600" />
          <span className="text-sm font-medium text-green-700">Persona salva com sucesso!</span>
        </div>
      )}
    </div>
  )
}
