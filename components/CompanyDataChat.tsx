'use client'

import { useState, useRef, useEffect } from 'react'
import { Sparkles, Send, Loader2, Check, X, Pencil, Bot, CheckCircle } from 'lucide-react'

const FIELD_LABELS: Record<string, string> = {
  nome: 'Nome da Empresa',
  descricao: 'Descrição',
  produtos_servicos: 'Produtos/Serviços',
  funcao_produtos: 'Função dos Produtos',
  diferenciais: 'Diferenciais',
  concorrentes: 'Concorrentes',
  dados_metricas: 'Provas Sociais',
  erros_comuns: 'Erros Comuns',
  percepcao_desejada: 'Percepção Desejada',
  dores_resolvidas: 'Dores que Resolve'
}

const ALL_FIELDS = Object.keys(FIELD_LABELS)

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

interface CompanyDataChatProps {
  companyData: Record<string, string>
  businessType: string
  onFieldUpdate: (field: string, value: string) => void
}

export default function CompanyDataChat({ companyData, businessType, onFieldUpdate }: CompanyDataChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Olá! Sou o assistente de dados da empresa. Me conte sobre a sua empresa — o que ela faz, quais produtos ou serviços oferece — e eu vou te ajudar a preencher todos os campos automaticamente.'
    }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [editingProposal, setEditingProposal] = useState<{ msgId: string; field: string } | null>(null)
  const [editValue, setEditValue] = useState('')

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const filledCount = ALL_FIELDS.filter(f => companyData[f]?.trim()).length
  const allFilled = filledCount === ALL_FIELDS.length
  const [forceOpen, setForceOpen] = useState(false)
  // Track if user has started chatting (sent at least one message)
  const hasStartedChat = messages.length > 1

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  // Build conversation history for API (text-only, no proposals)
  const buildApiMessages = (msgs: ChatMessage[]) => {
    return msgs
      .filter(m => m.id !== 'welcome')
      .map(m => {
        if (m.role === 'assistant' && m.proposals?.length) {
          // Include proposals context in assistant message for AI continuity
          const proposalText = m.proposals
            .map(p => {
              if (p.status === 'accepted') return `[${p.label}: "${p.value}" — ACEITO]`
              if (p.status === 'rejected') return `[${p.label}: "${p.value}" — REJEITADO, precisa reformular]`
              return `[${p.label}: "${p.value}" — pendente]`
            })
            .join('\n')
          return { role: m.role, content: m.content + '\n\nPropostas:\n' + proposalText }
        }
        return { role: m.role, content: m.content }
      })
  }

  const handleSend = async () => {
    const text = input.trim()
    if (!text || isLoading) return

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: text
    }

    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    setInput('')
    setIsLoading(true)

    try {
      const res = await fetch('/api/company/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: buildApiMessages(updatedMessages),
          currentFields: companyData,
          businessType
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
      console.error('Erro ai-chat:', err)
      setMessages(prev => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: 'assistant',
          content: 'Desculpe, houve um erro. Tente novamente.'
        }
      ])
    } finally {
      setIsLoading(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  const handleProposalAction = (msgId: string, field: string, action: 'accept' | 'reject' | 'edit') => {
    if (action === 'accept') {
      // Find the proposal value
      const msg = messages.find(m => m.id === msgId)
      const proposal = msg?.proposals?.find(p => p.field === field)
      if (proposal) {
        onFieldUpdate(field, proposal.value)
      }
      // Update status
      setMessages(prev =>
        prev.map(m =>
          m.id === msgId
            ? {
                ...m,
                proposals: m.proposals?.map(p =>
                  p.field === field ? { ...p, status: 'accepted' as const } : p
                )
              }
            : m
        )
      )
    } else if (action === 'reject') {
      setMessages(prev =>
        prev.map(m =>
          m.id === msgId
            ? {
                ...m,
                proposals: m.proposals?.map(p =>
                  p.field === field ? { ...p, status: 'rejected' as const } : p
                )
              }
            : m
        )
      )
    } else if (action === 'edit') {
      const msg = messages.find(m => m.id === msgId)
      const proposal = msg?.proposals?.find(p => p.field === field)
      if (proposal) {
        setEditingProposal({ msgId, field })
        setEditValue(proposal.value)
        // Mark as editing
        setMessages(prev =>
          prev.map(m =>
            m.id === msgId
              ? {
                  ...m,
                  proposals: m.proposals?.map(p =>
                    p.field === field ? { ...p, status: 'editing' as const } : p
                  )
                }
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

    setMessages(prev =>
      prev.map(m =>
        m.id === msgId
          ? {
              ...m,
              proposals: m.proposals?.map(p =>
                p.field === field ? { ...p, value: editValue.trim(), status: 'accepted' as const } : p
              )
            }
          : m
      )
    )

    setEditingProposal(null)
    setEditValue('')
  }

  const handleEditCancel = () => {
    if (!editingProposal) return
    const { msgId, field } = editingProposal

    setMessages(prev =>
      prev.map(m =>
        m.id === msgId
          ? {
              ...m,
              proposals: m.proposals?.map(p =>
                p.field === field ? { ...p, status: 'pending' as const } : p
              )
            }
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

  // If all fields are filled and user hasn't started chatting and not forced open, show compact state
  if (allFilled && !hasStartedChat && !forceOpen) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-green-100 flex items-center justify-center">
              <CheckCircle className="w-3.5 h-3.5 text-green-600" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-700">Todos os campos preenchidos</h3>
              <p className="text-[10px] text-gray-400">10/10 campos completos</p>
            </div>
          </div>
          <button
            onClick={() => setForceOpen(true)}
            className="px-3 py-1.5 text-xs font-medium text-gray-500 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 hover:text-gray-700 transition-colors"
          >
            Editar com IA
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-green-50 to-white">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Assistente de Dados</h3>
            <p className="text-[10px] text-gray-400">Preencha conversando com a IA</p>
          </div>
        </div>
        {/* Progress */}
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5">
            {ALL_FIELDS.map((f) => (
              <div
                key={f}
                className={`w-2 h-2 rounded-full transition-colors ${
                  companyData[f]?.trim() ? 'bg-green-500' : 'bg-gray-200'
                }`}
                title={FIELD_LABELS[f]}
              />
            ))}
          </div>
          <span className="text-[11px] font-medium text-gray-500">{filledCount}/10</span>
        </div>
      </div>

      {/* Messages */}
      <div className="h-[400px] overflow-y-auto p-4 space-y-4 bg-gray-50/30" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,0,0,0.1) transparent' }}>
        {messages.map((msg) => (
          <div key={msg.id}>
            {msg.role === 'assistant' ? (
              <div className="flex gap-2.5 max-w-[90%]">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot className="w-3 h-3 text-white" />
                </div>
                <div className="flex-1 space-y-2">
                  <p className="text-sm text-gray-700 leading-relaxed">{msg.content}</p>

                  {/* Proposals */}
                  {msg.proposals?.map((p) => (
                    <div
                      key={p.field}
                      className={`rounded-lg border p-3 transition-all ${
                        p.status === 'accepted'
                          ? 'bg-green-50 border-green-200'
                          : p.status === 'rejected'
                          ? 'bg-red-50/50 border-red-200/50 opacity-60'
                          : p.status === 'editing'
                          ? 'bg-blue-50 border-blue-200'
                          : 'bg-white border-gray-200 shadow-sm'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                          {p.label}
                        </span>
                        {p.status === 'accepted' && (
                          <CheckCircle className="w-3 h-3 text-green-500" />
                        )}
                      </div>

                      {p.status === 'editing' && editingProposal?.field === p.field ? (
                        <div className="space-y-2">
                          <textarea
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            rows={3}
                            className="w-full px-2.5 py-2 text-sm border border-blue-300 rounded-lg bg-white focus:outline-none focus:border-blue-500 resize-none"
                            autoFocus
                          />
                          <div className="flex gap-1.5">
                            <button
                              onClick={handleEditConfirm}
                              className="px-3 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors flex items-center gap-1"
                            >
                              <Check className="w-3 h-3" />
                              Confirmar
                            </button>
                            <button
                              onClick={handleEditCancel}
                              className="px-3 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="text-sm text-gray-800 mb-2 leading-relaxed">{p.value}</p>

                          {p.status === 'pending' && (
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => handleProposalAction(msg.id, p.field, 'accept')}
                                className="px-3 py-1.5 text-xs font-medium bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors flex items-center gap-1"
                              >
                                <Check className="w-3 h-3" />
                                Sim
                              </button>
                              <button
                                onClick={() => handleProposalAction(msg.id, p.field, 'reject')}
                                className="px-3 py-1.5 text-xs font-medium bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors flex items-center gap-1"
                              >
                                <X className="w-3 h-3" />
                                Não
                              </button>
                              <button
                                onClick={() => handleProposalAction(msg.id, p.field, 'edit')}
                                className="px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1"
                              >
                                <Pencil className="w-3 h-3" />
                                Personalizar
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
                <div className="max-w-[80%] px-3.5 py-2 rounded-2xl rounded-br-md bg-green-600 text-white text-sm leading-relaxed">
                  {msg.content}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Loading */}
        {isLoading && (
          <div className="flex gap-2.5 max-w-[90%]">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center flex-shrink-0">
              <Bot className="w-3 h-3 text-white" />
            </div>
            <div className="flex items-center gap-1.5 px-3 py-2 bg-white rounded-lg border border-gray-100">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-green-500" />
              <span className="text-xs text-gray-400">Pensando...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-gray-100 bg-white">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Descreva sua empresa..."
            rows={1}
            className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-green-500/50 resize-none"
            style={{ minHeight: '38px', maxHeight: '100px' }}
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="p-2 rounded-xl bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
