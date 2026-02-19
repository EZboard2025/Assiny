'use client'

import { useState, useRef, useEffect } from 'react'
import { Sparkles, Send, Loader2, Check, X, Pencil, Bot, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react'

const FIELD_CONFIG: { key: string; label: string; placeholder: string; type: 'input' | 'textarea' }[] = [
  { key: 'nome', label: 'Nome da Empresa', placeholder: 'Ex: Tech Solutions LTDA', type: 'input' },
  { key: 'descricao', label: 'Descrição', placeholder: 'O que a empresa faz em uma frase', type: 'textarea' },
  { key: 'produtos_servicos', label: 'Produtos/Serviços', placeholder: 'Ex: Sistema ERP, CRM para vendas', type: 'textarea' },
  { key: 'funcao_produtos', label: 'Função dos Produtos', placeholder: 'O que cada produto faz na prática', type: 'textarea' },
  { key: 'diferenciais', label: 'Diferenciais', placeholder: 'Diferenciais em relação aos concorrentes', type: 'textarea' },
  { key: 'concorrentes', label: 'Concorrentes', placeholder: 'Ex: TOTVS, Omie, Bling', type: 'textarea' },
  { key: 'dados_metricas', label: 'Provas Sociais', placeholder: 'Depoimentos, cases, prêmios, certificações...', type: 'textarea' },
  { key: 'erros_comuns', label: 'Erros Comuns', placeholder: 'Informações que vendedores costumam confundir', type: 'textarea' },
  { key: 'percepcao_desejada', label: 'Percepção Desejada', placeholder: 'Como a empresa deseja ser percebida', type: 'textarea' },
  { key: 'dores_resolvidas', label: 'Dores que Resolve', placeholder: 'Quais dores a empresa resolve para seus clientes', type: 'textarea' },
]

const ALL_FIELD_KEYS = FIELD_CONFIG.map(f => f.key)

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
  onBusinessTypeChange?: (type: 'B2B' | 'B2C' | 'Ambos') => void
  children?: React.ReactNode
}

export default function CompanyDataChat({ companyData, businessType, onFieldUpdate, onBusinessTypeChange, children }: CompanyDataChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Olá! Sou o assistente de dados da empresa. Me conte sobre a sua empresa, o que ela faz, quais produtos ou serviços oferece, e eu vou te ajudar a preencher todos os campos automaticamente.'
    }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [editingProposal, setEditingProposal] = useState<{ msgId: string; field: string } | null>(null)
  const [editValue, setEditValue] = useState('')
  const [showFields, setShowFields] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const totalFields = ALL_FIELD_KEYS.length + 1 // +1 for business_type
  const filledCount = ALL_FIELD_KEYS.filter(f => companyData[f]?.trim()).length + (businessType ? 1 : 0)
  const allFilled = filledCount === totalFields
  const [forceOpen, setForceOpen] = useState(false)
  const hasStartedChat = messages.length > 1

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

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
          currentFields: { ...companyData, business_type: businessType || '' },
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
      const msg = messages.find(m => m.id === msgId)
      const proposal = msg?.proposals?.find(p => p.field === field)
      if (proposal) {
        if (field === 'business_type' && onBusinessTypeChange) {
          const val = proposal.value.trim()
          if (val === 'B2B' || val === 'B2C' || val === 'Ambos') {
            onBusinessTypeChange(val)
          }
        } else {
          onFieldUpdate(field, proposal.value)
        }
      }
      setMessages(prev =>
        prev.map(m =>
          m.id === msgId
            ? { ...m, proposals: m.proposals?.map(p => p.field === field ? { ...p, status: 'accepted' as const } : p) }
            : m
        )
      )
    } else if (action === 'reject') {
      setMessages(prev =>
        prev.map(m =>
          m.id === msgId
            ? { ...m, proposals: m.proposals?.map(p => p.field === field ? { ...p, status: 'rejected' as const } : p) }
            : m
        )
      )
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
    if (field === 'business_type' && onBusinessTypeChange) {
      const val = editValue.trim()
      if (val === 'B2B' || val === 'B2C' || val === 'Ambos') {
        onBusinessTypeChange(val)
      }
    } else {
      onFieldUpdate(field, editValue.trim())
    }
    setMessages(prev =>
      prev.map(m =>
        m.id === msgId
          ? { ...m, proposals: m.proposals?.map(p => p.field === field ? { ...p, value: editValue.trim(), status: 'accepted' as const } : p) }
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

  const showChat = !allFilled || hasStartedChat || forceOpen

  // Progress bar percentage
  const progressPercent = (filledCount / totalFields) * 100

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Chat Section */}
      {showChat ? (
        <>
          {/* Header */}
          <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100 bg-gray-50/50">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Assistente de Dados</h3>
                <p className="text-[11px] text-gray-400">Preencha conversando com a IA</p>
              </div>
            </div>
            {/* Progress */}
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
                  /* AI Message */
                  <div className="flex gap-2.5 max-w-[92%]">
                    <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Bot className="w-3.5 h-3.5 text-green-600" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="px-3.5 py-2.5 bg-white border border-gray-200 rounded-2xl rounded-tl-md shadow-sm">
                        <p className="text-sm text-gray-700 leading-relaxed">{msg.content}</p>
                      </div>
                      {/* Proposals */}
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
                                <button
                                  onClick={handleEditConfirm}
                                  className="px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1"
                                >
                                  <Check className="w-3 h-3" />Confirmar
                                </button>
                                <button
                                  onClick={handleEditCancel}
                                  className="px-3 py-1.5 text-xs font-medium bg-white text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <p className="text-sm text-gray-700 mb-2.5 leading-relaxed">{p.value}</p>
                              {p.status === 'pending' && (
                                <div className="flex gap-1.5">
                                  <button
                                    onClick={() => handleProposalAction(msg.id, p.field, 'accept')}
                                    className="px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1 shadow-sm"
                                  >
                                    <Check className="w-3 h-3" />Sim
                                  </button>
                                  <button
                                    onClick={() => handleProposalAction(msg.id, p.field, 'reject')}
                                    className="px-3 py-1.5 text-xs font-medium bg-white text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-1"
                                  >
                                    <X className="w-3 h-3" />Não
                                  </button>
                                  <button
                                    onClick={() => handleProposalAction(msg.id, p.field, 'edit')}
                                    className="px-3 py-1.5 text-xs font-medium bg-white text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1"
                                  >
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
                  /* User Message */
                  <div className="flex justify-end">
                    <div className="max-w-[80%] px-3.5 py-2.5 rounded-2xl rounded-br-md bg-green-600 text-white text-sm leading-relaxed shadow-sm">
                      {msg.content}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {/* Loading */}
            {isLoading && (
              <div className="flex gap-2.5 max-w-[92%]">
                <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-3.5 h-3.5 text-green-600 animate-pulse" />
                </div>
                <div className="flex items-center gap-2 px-3.5 py-2.5 bg-white border border-gray-200 rounded-2xl rounded-tl-md shadow-sm">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-green-500" />
                  <span className="text-xs text-gray-400">Pensando...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar */}
          <div className="px-5 py-3 border-t border-gray-100 bg-white">
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Descreva sua empresa..."
                rows={1}
                className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 resize-none transition-all"
                style={{ minHeight: '40px', maxHeight: '100px' }}
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
          </div>
        </>
      ) : (
        /* Collapsed: all fields filled */
        <div className="px-5 py-4 flex items-center justify-between bg-green-50/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-900">Todos os campos preenchidos</h3>
              <p className="text-[11px] text-gray-400">{totalFields}/{totalFields} campos completos</p>
            </div>
          </div>
          <button
            onClick={() => setForceOpen(true)}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Editar com IA
          </button>
        </div>
      )}

      {/* Fields Toggle - only visible after all fields are filled */}
      {allFilled && (
        <div
          className="px-5 py-2.5 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors border-t border-gray-100"
          onClick={() => setShowFields(!showFields)}
        >
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
            Campos ({filledCount}/{totalFields} preenchidos)
          </span>
          {showFields ? (
            <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
          )}
        </div>
      )}

      {/* Expandable Fields - only after all filled */}
      {allFilled && showFields && (
        <div className="px-5 pb-4 pt-3 space-y-3 border-t border-gray-100">
          {/* Business Type Selector */}
          <div>
            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Tipo de Negócio
              {businessType && <CheckCircle className="w-2.5 h-2.5 text-green-500 inline ml-1" />}
            </label>
            <div className="flex items-center gap-2">
              {(['B2C', 'B2B', 'Ambos'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => onBusinessTypeChange?.(type)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    businessType === type
                      ? 'bg-green-100 text-green-700 border border-green-500/30'
                      : 'bg-gray-50 border border-gray-200 text-gray-400 hover:text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {FIELD_CONFIG.map((field) => (
            <div key={field.key}>
              <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                {field.label}
                {companyData[field.key]?.trim() && (
                  <CheckCircle className="w-2.5 h-2.5 text-green-500 inline ml-1" />
                )}
              </label>
              {field.type === 'input' ? (
                <input
                  type="text"
                  value={companyData[field.key] || ''}
                  onChange={(e) => onFieldUpdate(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all"
                />
              ) : (
                <textarea
                  value={companyData[field.key] || ''}
                  onChange={(e) => onFieldUpdate(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  rows={2}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 resize-none transition-all"
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Action Buttons from ConfigHub */}
      {children && (
        <div className="px-5 pb-4 pt-2 border-t border-gray-100">
          {children}
        </div>
      )}
    </div>
  )
}
