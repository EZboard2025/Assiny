'use client'

import { useState } from 'react'
import { X, ChevronDown, ChevronUp, UserCircle2, CheckCircle, AlertCircle } from 'lucide-react'

// Mock data
const mockPersonas = [
  { id: '1', business_type: 'B2B', job_title: 'Gerente Comercial', company_type: 'Software de gestão para pequenos negócios. LTV médio: R$ 4.188', business_challenges: 'Busca aumentar vendas em 30%', company_goals: 'Escalar operação comercial', tags: [{ id: 't1', name: 'Personas franquia', color: '#22c55e' }] },
  { id: '2', business_type: 'B2B', job_title: 'Dono de franquia', company_type: 'Clínica médica, faturamento de R$1.000.000,00/mês', business_challenges: 'Reduzir custos operacionais', company_goals: 'Automatizar processos', tags: [{ id: 't1', name: 'Personas franquia', color: '#22c55e' }] },
  { id: '3', business_type: 'B2B', job_title: 'Head de vendas', company_type: 'Empresa de tecnologia B2B', business_challenges: 'Time de vendas desmotivado', company_goals: 'Melhorar conversão', tags: [] },
]

const mockObjections = [
  { id: '1', name: 'Cliente demonstra insegurança em adotar um treinamento novo...', rebuttals: ['Mostrar cases de sucesso', 'Oferecer período de teste'] },
  { id: '2', name: 'Cliente confunde nossa ferramenta com metodologia, comparando com concorrentes...', rebuttals: ['Diferenciar produto de metodologia', 'Mostrar valor único'] },
  { id: '3', name: 'Cliente não consegue associar o uso de 15/20 minutos diários com resultados...', rebuttals: ['Apresentar ROI comprovado', 'Mostrar métricas de engajamento'] },
  { id: '4', name: 'Dinheiro - "Está muito caro para nossa realidade"', rebuttals: ['Calcular custo de não treinar', 'Mostrar payback'] },
]

const mockObjectives = [
  { id: '1', name: 'Fechar a venda', description: 'Fechar uma venda de assinaturas' },
  { id: '2', name: 'Agendar demonstração', description: 'Conseguir uma reunião de demonstração' },
]

const temperaments = ['Analítico', 'Empático', 'Determinado', 'Indeciso', 'Sociável']

export default function PreviewConfigPage() {
  const [age, setAge] = useState(30)
  const [temperament, setTemperament] = useState('Analítico')
  const [selectedPersona, setSelectedPersona] = useState('1')
  const [selectedObjections, setSelectedObjections] = useState<string[]>([])
  const [selectedObjective, setSelectedObjective] = useState('1')
  const [expandedPersonaId, setExpandedPersonaId] = useState<string | null>(null)
  const [expandedObjectionId, setExpandedObjectionId] = useState<string | null>(null)

  const toggleObjection = (id: string) => {
    setSelectedObjections(prev =>
      prev.includes(id) ? prev.filter(o => o !== id) : [...prev, id]
    )
  }

  // Group personas by tag
  const taggedPersonas = mockPersonas.filter(p => p.tags.length > 0)
  const untaggedPersonas = mockPersonas.filter(p => p.tags.length === 0)

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 overflow-y-auto">
      <div className="min-h-screen py-8 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">Configuração da Sessão</h1>
              <p className="text-gray-400 text-sm">Configure os parâmetros do seu roleplay (Preview)</p>
            </div>
            <a
              href="/"
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </a>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Coluna Esquerda - Cliente */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Perfil do Cliente</h3>

              {/* Idade do Cliente */}
              <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-gray-300">Idade do Cliente</label>
                  <span className="text-lg font-bold text-green-400">{age} anos</span>
                </div>
                <input
                  type="range"
                  min="18"
                  max="60"
                  value={age}
                  onChange={(e) => setAge(Number(e.target.value))}
                  className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-green-500"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-2">
                  <span>18</span>
                  <span>60</span>
                </div>

                {/* Info da faixa etária */}
                <div className="mt-4 bg-gray-800/50 rounded-lg p-3 border border-gray-700">
                  {age >= 18 && age <= 24 && (
                    <div>
                      <p className="text-sm font-medium text-blue-400 mb-2">18 a 24 anos</p>
                      <div className="space-y-1 text-xs text-gray-400">
                        <p><span className="text-gray-300">Tom:</span> Informal e moderno</p>
                        <p><span className="text-gray-300">Comportamento:</span> Aceita novidades • Referências digitais</p>
                      </div>
                    </div>
                  )}
                  {age >= 25 && age <= 34 && (
                    <div>
                      <p className="text-sm font-medium text-green-400 mb-2">25 a 34 anos</p>
                      <div className="space-y-1 text-xs text-gray-400">
                        <p><span className="text-gray-300">Tom:</span> Pragmático e orientado a resultados</p>
                        <p><span className="text-gray-300">Comportamento:</span> Foco em ROI • Aceita risco calculado</p>
                      </div>
                    </div>
                  )}
                  {age >= 35 && age <= 44 && (
                    <div>
                      <p className="text-sm font-medium text-yellow-400 mb-2">35 a 44 anos</p>
                      <div className="space-y-1 text-xs text-gray-400">
                        <p><span className="text-gray-300">Tom:</span> Equilibrado entre desempenho e estabilidade</p>
                        <p><span className="text-gray-300">Comportamento:</span> Valoriza compliance • Cauteloso</p>
                      </div>
                    </div>
                  )}
                  {age >= 45 && age <= 60 && (
                    <div>
                      <p className="text-sm font-medium text-orange-400 mb-2">45 a 60 anos</p>
                      <div className="space-y-1 text-xs text-gray-400">
                        <p><span className="text-gray-300">Tom:</span> Conservador e formal</p>
                        <p><span className="text-gray-300">Comportamento:</span> Foco em segurança • Avesso a riscos</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Temperamento */}
              <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-4">
                <label className="text-sm font-medium text-gray-300 mb-3 block">Temperamento</label>
                <div className="flex flex-wrap gap-2">
                  {temperaments.map((temp) => (
                    <button
                      key={temp}
                      onClick={() => setTemperament(temp)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        temperament === temp
                          ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                          : 'bg-gray-800/50 text-gray-400 border border-gray-700 hover:border-gray-600 hover:text-gray-300'
                      }`}
                    >
                      {temp}
                    </button>
                  ))}
                </div>

                {/* Info do temperamento */}
                <div className="mt-4 bg-gray-800/50 rounded-lg p-3 border border-gray-700">
                  {temperament === 'Analítico' && (
                    <div>
                      <p className="text-sm font-medium text-green-400 mb-2">Analítico</p>
                      <div className="space-y-1 text-xs text-gray-400">
                        <p><span className="text-gray-300">Estilo:</span> Formal, racional, calmo e preciso</p>
                        <p><span className="text-gray-300">Gatilhos:</span> Dados concretos, estatísticas, provas de eficácia</p>
                      </div>
                    </div>
                  )}
                  {temperament === 'Empático' && (
                    <div>
                      <p className="text-sm font-medium text-pink-400 mb-2">Empático</p>
                      <div className="space-y-1 text-xs text-gray-400">
                        <p><span className="text-gray-300">Estilo:</span> Afável, próximo, gentil e emocional</p>
                        <p><span className="text-gray-300">Gatilhos:</span> Histórias reais, propósito, apoio humano</p>
                      </div>
                    </div>
                  )}
                  {temperament === 'Determinado' && (
                    <div>
                      <p className="text-sm font-medium text-red-400 mb-2">Determinado</p>
                      <div className="space-y-1 text-xs text-gray-400">
                        <p><span className="text-gray-300">Estilo:</span> Objetivo, seguro, impaciente e assertivo</p>
                        <p><span className="text-gray-300">Gatilhos:</span> Soluções rápidas, eficiência, resultado imediato</p>
                      </div>
                    </div>
                  )}
                  {temperament === 'Indeciso' && (
                    <div>
                      <p className="text-sm font-medium text-yellow-400 mb-2">Indeciso</p>
                      <div className="space-y-1 text-xs text-gray-400">
                        <p><span className="text-gray-300">Estilo:</span> Hesitante, cauteloso e questionador</p>
                        <p><span className="text-gray-300">Gatilhos:</span> Depoimentos, garantias, segurança, prova social</p>
                      </div>
                    </div>
                  )}
                  {temperament === 'Sociável' && (
                    <div>
                      <p className="text-sm font-medium text-cyan-400 mb-2">Sociável</p>
                      <div className="space-y-1 text-xs text-gray-400">
                        <p><span className="text-gray-300">Estilo:</span> Leve, animado, entusiasmado e informal</p>
                        <p><span className="text-gray-300">Gatilhos:</span> Amizade, humor, interesse genuíno, energia positiva</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Coluna Direita - Cenário */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Cenário do Roleplay</h3>

              {/* Persona */}
              <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-4">
                <label className="text-sm font-medium text-gray-300 mb-3 block">Persona</label>
                <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
                  {/* Tagged personas */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 py-1">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Personas franquia</span>
                    </div>
                    {taggedPersonas.map((persona) => (
                      <div
                        key={persona.id}
                        onClick={() => setSelectedPersona(persona.id)}
                        className={`cursor-pointer rounded-lg p-3 border transition-all ${
                          selectedPersona === persona.id
                            ? 'bg-green-500/10 border-green-500/50'
                            : 'bg-gray-800/30 border-gray-700 hover:border-gray-600'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                            selectedPersona === persona.id ? 'bg-green-500/20' : 'bg-gray-800'
                          }`}>
                            <UserCircle2 className={`w-5 h-5 ${selectedPersona === persona.id ? 'text-green-400' : 'text-gray-500'}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{persona.job_title}</p>
                            {persona.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {persona.tags.map((t) => (
                                  <span key={t.id} className="text-[10px] px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: t.color }}>{t.name}</span>
                                ))}
                              </div>
                            )}
                            <p className="text-xs text-gray-500 mt-1 truncate">{persona.company_type}</p>
                          </div>
                          {selectedPersona === persona.id && <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />}
                          <button
                            onClick={(e) => { e.stopPropagation(); setExpandedPersonaId(expandedPersonaId === persona.id ? null : persona.id) }}
                            className="p-1 text-gray-500 hover:text-gray-300"
                          >
                            {expandedPersonaId === persona.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </div>
                        {expandedPersonaId === persona.id && (
                          <div className="mt-3 pt-3 border-t border-gray-700 space-y-1 text-xs text-gray-400">
                            <p><span className="text-gray-300">Empresa:</span> {persona.company_type}</p>
                            <p><span className="text-gray-300">Contexto:</span> {persona.business_challenges}</p>
                            <p><span className="text-gray-300">Busca:</span> {persona.company_goals}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Untagged personas */}
                  {untaggedPersonas.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 py-1">
                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Sem Etiqueta</span>
                      </div>
                      {untaggedPersonas.map((persona) => (
                        <div
                          key={persona.id}
                          onClick={() => setSelectedPersona(persona.id)}
                          className={`cursor-pointer rounded-lg p-3 border transition-all ${
                            selectedPersona === persona.id
                              ? 'bg-green-500/10 border-green-500/50'
                              : 'bg-gray-800/30 border-gray-700 hover:border-gray-600'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                              selectedPersona === persona.id ? 'bg-green-500/20' : 'bg-gray-800'
                            }`}>
                              <UserCircle2 className={`w-5 h-5 ${selectedPersona === persona.id ? 'text-green-400' : 'text-gray-500'}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-white truncate">{persona.job_title}</p>
                              <p className="text-xs text-gray-500 mt-1 truncate">{persona.company_type}</p>
                            </div>
                            {selectedPersona === persona.id && <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />}
                            <button
                              onClick={(e) => { e.stopPropagation(); setExpandedPersonaId(expandedPersonaId === persona.id ? null : persona.id) }}
                              className="p-1 text-gray-500 hover:text-gray-300"
                            >
                              {expandedPersonaId === persona.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Objeções */}
              <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-gray-300">Objeções</label>
                  <span className="text-xs text-green-400 font-medium">{selectedObjections.length} selecionadas</span>
                </div>
                <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                  {mockObjections.map((objection) => (
                    <div
                      key={objection.id}
                      className={`group rounded-lg p-3 border transition-all ${
                        selectedObjections.includes(objection.id)
                          ? 'bg-green-500/10 border-green-500/50'
                          : 'bg-gray-800/30 border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          onClick={() => toggleObjection(objection.id)}
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 cursor-pointer transition-all mt-0.5 ${
                            selectedObjections.includes(objection.id)
                              ? 'bg-green-500 border-green-500'
                              : 'border-gray-600 group-hover:border-gray-500'
                          }`}
                        >
                          {selectedObjections.includes(objection.id) && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleObjection(objection.id)}>
                          <span className={`text-sm ${expandedObjectionId === objection.id ? '' : 'truncate block'} ${
                            selectedObjections.includes(objection.id) ? 'text-white font-medium' : 'text-gray-300'
                          }`}>{objection.name}</span>
                          {expandedObjectionId === objection.id && objection.rebuttals.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-gray-700 space-y-1">
                              <p className="text-xs text-green-400 font-medium">Rebatidas:</p>
                              {objection.rebuttals.map((rebuttal, idx) => (
                                <p key={idx} className="text-xs text-gray-400">• {rebuttal}</p>
                              ))}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); setExpandedObjectionId(expandedObjectionId === objection.id ? null : objection.id) }}
                          className="p-1 text-gray-500 hover:text-gray-300 flex-shrink-0"
                        >
                          {expandedObjectionId === objection.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Objetivo */}
              <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-4">
                <label className="text-sm font-medium text-gray-300 mb-3 block">
                  Objetivo do Roleplay <span className="text-red-400">*</span>
                </label>
                <div className="space-y-2">
                  {mockObjectives.map((objective) => (
                    <div
                      key={objective.id}
                      onClick={() => setSelectedObjective(objective.id)}
                      className={`cursor-pointer rounded-lg p-3 border transition-all ${
                        selectedObjective === objective.id
                          ? 'bg-green-500/10 border-green-500/50'
                          : 'bg-gray-800/30 border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                          selectedObjective === objective.id ? 'bg-green-500 border-green-500' : 'border-gray-600'
                        }`}>
                          {selectedObjective === objective.id && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1">
                          <p className={`text-sm font-medium ${selectedObjective === objective.id ? 'text-white' : 'text-gray-300'}`}>
                            {objective.name}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">{objective.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Aviso de configuração incompleta */}
          {selectedObjections.length === 0 && (
            <div className="mt-6 bg-yellow-500/10 rounded-xl border border-yellow-500/30 p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-yellow-400 mb-2">Configure os itens obrigatórios:</p>
                  <ul className="space-y-1 text-xs text-yellow-300/80">
                    <li>• Selecione pelo menos uma Objeção</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 mt-6">
            <a
              href="/"
              className="flex-1 px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-xl font-medium hover:bg-gray-800 transition-colors text-gray-300 text-sm text-center"
            >
              Voltar
            </a>
            <button
              disabled={selectedObjections.length === 0}
              className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all text-sm ${
                selectedObjections.length === 0
                  ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-500 text-white'
              }`}
            >
              Iniciar Roleplay
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
