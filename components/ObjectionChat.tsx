'use client'

import { useState, useRef, useEffect } from 'react'
import { Sparkles, Send, Loader2, Check, X, Pencil, Bot, CheckCircle, Mic, MicOff } from 'lucide-react'
import { addObjection } from '@/lib/config'

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

const APPROACH_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  emocional: { label: 'Emocional', color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' },
  logica: { label: 'Lógica/ROI', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
  social: { label: 'Social', color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200' },
  tecnica: { label: 'Técnica', color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
  estrategica: { label: 'Estratégica', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
}

interface ObjectionProposal {
  type: 'objection' | 'rebuttal'
  value: string
  approach?: string | null
  status: 'pending' | 'accepted' | 'rejected' | 'editing'
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  proposal?: ObjectionProposal
  rebuttalPicker?: boolean
}

interface ObjectionChatProps {
  companyData?: Record<string, string> | null
  onObjectionSaved: (objection: { id: string; name: string; rebuttals: string[] }) => void
  onCancel: () => void
}

export default function ObjectionChat({ companyData, onObjectionSaved, onCancel }: ObjectionChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Olá! Vou te ajudar a criar uma objeção de alta qualidade com formas de quebra variadas. Qual objeção você quer criar?',
    }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [editingProposal, setEditingProposal] = useState<string | null>(null) // msgId
  const [editValue, setEditValue] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const [acceptedObjection, setAcceptedObjection] = useState<string | null>(null)
  const [acceptedRebuttals, setAcceptedRebuttals] = useState<string[]>([])
  const [acceptedApproaches, setAcceptedApproaches] = useState<string[]>([])

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  // Progress tracking
  const objectionDone = acceptedObjection !== null
  const rebuttalCount = acceptedRebuttals.length

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [messages, isLoading])

  useEffect(() => {
    return () => { recognitionRef.current?.stop() }
  }, [])

  const handleSave = async () => {
    if (!acceptedObjection) return
    setIsSaving(true)
    try {
      const result = await addObjection(acceptedObjection, acceptedRebuttals)
      if (result) {
        setIsSaved(true)
        onObjectionSaved({ id: result.id, name: result.name, rebuttals: result.rebuttals || [] })
      }
    } catch (err) {
      console.error('[ObjectionChat] Erro ao salvar:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const buildApiMessages = (msgs: ChatMessage[]) => {
    return msgs
      .filter(m => m.id !== 'welcome' && !m.rebuttalPicker)
      .map(m => {
        if (m.role === 'assistant' && m.proposal) {
          const p = m.proposal
          const statusLabel = p.status === 'accepted' ? 'ACEITO' : p.status === 'rejected' ? 'REJEITADO' : 'pendente'
          const typeLabel = p.type === 'objection' ? 'Objeção' : `Rebuttal (${APPROACH_CONFIG[p.approach || '']?.label || 'geral'})`
          return { role: m.role, content: m.content + `\n\n[Proposta ${typeLabel}: "${p.value}" - ${statusLabel}]` }
        }
        return { role: m.role, content: m.content }
      })
  }

  const sendToAi = async (updatedMessages: ChatMessage[], overrideObjection?: string | null, overrideRebuttals?: string[]) => {
    try {
      const res = await fetch('/api/company/objection-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: buildApiMessages(updatedMessages),
          currentObjection: overrideObjection !== undefined ? overrideObjection : acceptedObjection,
          currentRebuttals: overrideRebuttals || acceptedRebuttals,
          companyContext: companyData,
        })
      })

      if (!res.ok) throw new Error('Erro na API')

      const data = await res.json()

      const aiMsg: ChatMessage = {
        id: `ai_${Date.now()}`,
        role: 'assistant',
        content: data.message || '',
        proposal: data.proposal ? {
          ...data.proposal,
          status: 'pending' as const,
        } : undefined,
      }

      setMessages(prev => [...prev, aiMsg])
    } catch (err) {
      console.error('Erro objection-chat:', err)
      setMessages(prev => [
        ...prev,
        { id: `err_${Date.now()}`, role: 'assistant', content: 'Desculpe, houve um erro. Tente novamente.' }
      ])
    }
  }

  const handleSend = async () => {
    const text = input.trim()
    if (!text || isLoading) return

    const userMsg: ChatMessage = { id: `user_${Date.now()}`, role: 'user', content: text }
    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    setInput('')
    setIsLoading(true)

    await sendToAi(updatedMessages)
    setIsLoading(false)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const handlePickRebuttalCount = async (count: number) => {
    // Replace picker message and add user response
    const withoutPicker = messages.filter(m => !m.rebuttalPicker)
    const userMsg: ChatMessage = { id: `user_${Date.now()}`, role: 'user', content: `Quero ${count} formas de quebra.` }
    const updatedMessages = [...withoutPicker, userMsg]
    setMessages(updatedMessages)
    setIsLoading(true)
    await sendToAi(updatedMessages)
    setIsLoading(false)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const handleProposalAction = async (msgId: string, action: 'accept' | 'reject' | 'edit') => {
    const msg = messages.find(m => m.id === msgId)
    if (!msg?.proposal) return

    if (action === 'accept') {
      const p = msg.proposal
      let newObjection = acceptedObjection
      let newRebuttals = [...acceptedRebuttals]

      if (p.type === 'objection') {
        newObjection = p.value
        setAcceptedObjection(p.value)
      } else {
        newRebuttals = [...newRebuttals, p.value]
        setAcceptedRebuttals(newRebuttals)
        if (p.approach) setAcceptedApproaches(prev => [...prev, p.approach!])
      }

      const newMessages = messages.map(m =>
        m.id === msgId
          ? { ...m, proposal: { ...m.proposal!, status: 'accepted' as const } }
          : m
      )

      if (p.type === 'objection') {
        // Show rebuttal count picker instead of asking the AI
        const pickerMsg: ChatMessage = {
          id: `picker_${Date.now()}`,
          role: 'assistant',
          content: 'Quantas formas de quebra você quer criar?',
          rebuttalPicker: true,
        }
        setMessages([...newMessages, pickerMsg])
      } else {
        setMessages(newMessages)
        // Auto-continue for rebuttals
        setIsLoading(true)
        await sendToAi(newMessages, newObjection, newRebuttals)
        setIsLoading(false)
        setTimeout(() => inputRef.current?.focus(), 100)
      }
    } else if (action === 'reject') {
      const newMessages = messages.map(m =>
        m.id === msgId
          ? { ...m, proposal: { ...m.proposal!, status: 'rejected' as const } }
          : m
      )
      setMessages(newMessages)

      // Auto-continue (AI will reformulate)
      setIsLoading(true)
      await sendToAi(newMessages)
      setIsLoading(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    } else if (action === 'edit') {
      setEditingProposal(msgId)
      setEditValue(msg.proposal.value)
      setMessages(prev =>
        prev.map(m =>
          m.id === msgId
            ? { ...m, proposal: { ...m.proposal!, status: 'editing' as const } }
            : m
        )
      )
    }
  }

  const handleEditConfirm = async () => {
    if (!editingProposal) return
    const msg = messages.find(m => m.id === editingProposal)
    if (!msg?.proposal) return

    const p = msg.proposal
    let newObjection = acceptedObjection
    let newRebuttals = [...acceptedRebuttals]

    if (p.type === 'objection') {
      newObjection = editValue.trim()
      setAcceptedObjection(newObjection)
    } else {
      newRebuttals = [...newRebuttals, editValue.trim()]
      setAcceptedRebuttals(newRebuttals)
      if (p.approach) setAcceptedApproaches(prev => [...prev, p.approach!])
    }

    const newMessages = messages.map(m =>
      m.id === editingProposal
        ? { ...m, proposal: { ...m.proposal!, value: editValue.trim(), status: 'accepted' as const } }
        : m
    )
    setEditingProposal(null)
    setEditValue('')

    if (p.type === 'objection') {
      // Show rebuttal count picker
      const pickerMsg: ChatMessage = {
        id: `picker_${Date.now()}`,
        role: 'assistant',
        content: 'Quantas formas de quebra você quer criar?',
        rebuttalPicker: true,
      }
      setMessages([...newMessages, pickerMsg])
    } else {
      setMessages(newMessages)
      // Auto-continue for rebuttals
      setIsLoading(true)
      await sendToAi(newMessages, newObjection, newRebuttals)
      setIsLoading(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  const handleEditCancel = () => {
    if (!editingProposal) return
    setMessages(prev =>
      prev.map(m =>
        m.id === editingProposal
          ? { ...m, proposal: { ...m.proposal!, status: 'pending' as const } }
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
      if (inputRef.current) inputRef.current.placeholder = 'Descreva a situação da objeção...'
    }

    recognition.onerror = () => {
      setIsListening(false)
      recognitionRef.current = null
    }

    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }

  const renderMessageContent = (content: string) => {
    const lines = content.split('\n')
    const blocks: { type: 'text' | 'bullets'; lines: string[] }[] = []
    let currentBlock: { type: 'text' | 'bullets'; lines: string[] } | null = null

    for (const line of lines) {
      const trimmed = line.trim()
      const isBullet = /^[•\-\*]\s/.test(trimmed)

      if (isBullet) {
        if (currentBlock?.type !== 'bullets') {
          if (currentBlock) blocks.push(currentBlock)
          currentBlock = { type: 'bullets', lines: [] }
        }
        currentBlock.lines.push(trimmed.replace(/^[•\-\*]\s*/, ''))
      } else {
        if (trimmed === '') {
          if (currentBlock) { blocks.push(currentBlock); currentBlock = null }
        } else {
          if (currentBlock?.type !== 'text') {
            if (currentBlock) blocks.push(currentBlock)
            currentBlock = { type: 'text', lines: [] }
          }
          currentBlock.lines.push(trimmed)
        }
      }
    }
    if (currentBlock) blocks.push(currentBlock)

    return (
      <div className="space-y-2">
        {blocks.map((block, i) =>
          block.type === 'bullets' ? (
            <div key={i} className="bg-green-50/60 border border-green-100 rounded-lg p-2.5 space-y-1.5">
              {block.lines.map((item, j) => (
                <div key={j} className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-[7px] flex-shrink-0" />
                  <span className="text-sm text-gray-700 leading-relaxed">{item}</span>
                </div>
              ))}
            </div>
          ) : (
            <p key={i} className="text-sm text-gray-700 leading-relaxed">{block.lines.join(' ')}</p>
          )
        )}
      </div>
    )
  }

  const renderProposal = (msg: ChatMessage) => {
    const p = msg.proposal
    if (!p) return null

    const approachInfo = p.approach ? APPROACH_CONFIG[p.approach] : null
    const isObjType = p.type === 'objection'

    return (
      <div
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
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
            {isObjType ? 'Objeção' : 'Forma de Quebrar'}
          </span>
          {approachInfo && (
            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${approachInfo.bg} ${approachInfo.color} ${approachInfo.border} border`}>
              {approachInfo.label}
            </span>
          )}
          {p.status === 'accepted' && <CheckCircle className="w-3 h-3 text-green-500" />}
        </div>
        {p.status === 'editing' && editingProposal === msg.id ? (
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
                <button onClick={() => handleProposalAction(msg.id, 'accept')} className="px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1 shadow-sm">
                  <Check className="w-3 h-3" />Sim
                </button>
                <button onClick={() => handleProposalAction(msg.id, 'reject')} className="px-3 py-1.5 text-xs font-medium bg-white text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-1">
                  <X className="w-3 h-3" />Não
                </button>
                <button onClick={() => handleProposalAction(msg.id, 'edit')} className="px-3 py-1.5 text-xs font-medium bg-white text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1">
                  <Pencil className="w-3 h-3" />Personalizar
                </button>
              </div>
            )}
          </>
        )}
      </div>
    )
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
            <h3 className="text-sm font-semibold text-gray-900">Criar Objeção com IA</h3>
            <p className="text-[11px] text-gray-400">
              {!objectionDone ? 'Definindo objeção...' : rebuttalCount > 0 ? `${rebuttalCount} forma${rebuttalCount !== 1 ? 's' : ''} de quebra criada${rebuttalCount !== 1 ? 's' : ''}` : 'Objeção definida'}
            </p>
          </div>
        </div>
        {/* Save button - appears after objection + at least 1 rebuttal */}
        {objectionDone && rebuttalCount >= 1 && !isSaved && !isSaving && (
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 transition-colors shadow-sm"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            Salvar
          </button>
        )}
      </div>

      {/* Messages Area */}
      <div
        className="h-[340px] overflow-y-auto px-5 py-4 space-y-4 bg-gray-50/30"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,0,0,0.08) transparent' }}
      >
        {messages.map((msg) => (
          <div key={msg.id}>
            {msg.rebuttalPicker ? (
              /* Rebuttal count picker card */
              <div className="flex gap-2.5 max-w-[92%]">
                <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5 text-green-600" />
                </div>
                <div className="flex-1">
                  <div className="px-3.5 py-3 bg-white border border-gray-200 rounded-2xl rounded-tl-md shadow-sm">
                    <p className="text-sm font-medium text-gray-800 mb-3">{msg.content}</p>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map(n => (
                        <button
                          key={n}
                          onClick={() => handlePickRebuttalCount(n)}
                          className="flex-1 py-2 px-3 rounded-xl border-2 border-dashed border-green-300 bg-green-50/50 hover:bg-green-100 hover:border-green-400 transition-all text-center group"
                        >
                          <span className="text-lg font-bold text-green-600 group-hover:scale-110 inline-block transition-transform">{n}</span>
                          <span className="block text-[10px] text-gray-500 mt-0.5">forma{n > 1 ? 's' : ''}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : msg.role === 'assistant' ? (
              <div className="flex gap-2.5 max-w-[92%]">
                <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5 text-green-600" />
                </div>
                <div className="flex-1 space-y-2">
                  <div className="px-3.5 py-2.5 bg-white border border-gray-200 rounded-2xl rounded-tl-md shadow-sm">
                    {renderMessageContent(msg.content)}
                  </div>
                  {renderProposal(msg)}
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
              <span className="text-xs text-gray-400">{!objectionDone ? 'Pensando na objeção...' : 'Criando rebuttal...'}</span>
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
              <span className="text-xs text-gray-400">Salvando objeção...</span>
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
              placeholder="Descreva a situação da objeção..."
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
          <span className="text-sm font-medium text-green-700">Objeção salva com sucesso!</span>
        </div>
      )}
    </div>
  )
}
