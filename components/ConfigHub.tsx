'use client'

import { useState, useEffect } from 'react'
import { X, Lock, Settings, Building2, Users, Target, Upload, Plus, Trash2, FileText, AlertCircle, CheckCircle, Loader2, UserCircle2 } from 'lucide-react'
import {
  getEmployees,
  addEmployee as addEmployeeDB,
  updateEmployee,
  deleteEmployee,
  getCompanyType,
  setCompanyType,
  getObjections,
  addObjection,
  updateObjection,
  updateObjectionScore,
  deleteObjection,
  getPersonas,
  addPersona,
  deletePersona,
  type Employee,
  type Objection,
  type Persona,
  type PersonaB2B,
  type PersonaB2C
} from '@/lib/config'

interface ConfigHubProps {
  onClose: () => void
}

// Component for the main configuration interface
function ConfigurationInterface({
  personaEvaluation,
  setPersonaEvaluation,
  showPersonaEvaluationModal,
  setShowPersonaEvaluationModal,
  objectionEvaluation,
  setObjectionEvaluation,
  showObjectionEvaluationModal,
  setShowObjectionEvaluationModal
}: {
  personaEvaluation: any
  setPersonaEvaluation: (val: any) => void
  showPersonaEvaluationModal: boolean
  setShowPersonaEvaluationModal: (val: boolean) => void
  objectionEvaluation: any
  setObjectionEvaluation: (val: any) => void
  showObjectionEvaluationModal: boolean
  setShowObjectionEvaluationModal: (val: boolean) => void
}) {
  const [activeTab, setActiveTab] = useState<'employees' | 'business-type' | 'personas' | 'objections' | 'files'>('employees')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [newEmployeeName, setNewEmployeeName] = useState('')
  const [newEmployeeEmail, setNewEmployeeEmail] = useState('')
  const [newEmployeePassword, setNewEmployeePassword] = useState('')
  const [addingEmployee, setAddingEmployee] = useState(false)
  const [businessType, setBusinessType] = useState<'B2B' | 'B2C'>('B2C')
  const [personas, setPersonas] = useState<Persona[]>([])
  const [showPersonaForm, setShowPersonaForm] = useState(false)
  const [newPersona, setNewPersona] = useState<Partial<PersonaB2B> | Partial<PersonaB2C>>({})
  const [editingPersonaId, setEditingPersonaId] = useState<string | null>(null)
  const [objections, setObjections] = useState<Objection[]>([])
  const [newObjection, setNewObjection] = useState('')
  const [newRebuttal, setNewRebuttal] = useState('')
  const [editingObjectionId, setEditingObjectionId] = useState<string | null>(null)
  const [expandedObjections, setExpandedObjections] = useState<Set<string>>(new Set())
  const [evaluatingObjection, setEvaluatingObjection] = useState(false)
  const [loading, setLoading] = useState(true)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([])
  const [uploadQueue, setUploadQueue] = useState<File[]>([])
  const [currentUploadIndex, setCurrentUploadIndex] = useState<number>(-1)
  const [uploadProgress, setUploadProgress] = useState<{ total: number; completed: number }>({ total: 0, completed: 0 })
  const [evaluatingQuality, setEvaluatingQuality] = useState(false)
  const [qualityScore, setQualityScore] = useState<number>(60)
  const [qualityEvaluation, setQualityEvaluation] = useState<{
    nota_final: number
    classificacao: string
    pode_usar: boolean
    resumo: string
    pontos_fortes: string[]
    principais_gaps: string[]
    proxima_acao: string
  } | null>(null)
  const [evaluatingPersona, setEvaluatingPersona] = useState(false)
  const [editedPersonaIds, setEditedPersonaIds] = useState<Set<string>>(new Set())

  // Carregar dados do Supabase
  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [employeesData, companyTypeData, personasData, objectionsData] = await Promise.all([
        getEmployees(),
        getCompanyType(),
        getPersonas(),
        getObjections()
      ])

      setEmployees(employeesData)
      setBusinessType(companyTypeData)
      setPersonas(personasData)
      setObjections(objectionsData)
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveEmployee = async () => {
    if (!newEmployeeName || !newEmployeeEmail || !newEmployeePassword) {
      alert('Preencha todos os campos!')
      return
    }

    try {
      const response = await fetch('/api/employees/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newEmployeeName,
          email: newEmployeeEmail,
          password: newEmployeePassword
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        alert('Erro ao criar funcionário: ' + error.message)
        return
      }

      const { employee } = await response.json()

      // Adicionar à lista
      setEmployees([...employees, employee])

      // Limpar campos
      setNewEmployeeName('')
      setNewEmployeeEmail('')
      setNewEmployeePassword('')
      setAddingEmployee(false)

      alert('Funcionário criado com sucesso!')
    } catch (error) {
      console.error('Erro ao criar funcionário:', error)
      alert('Erro ao criar funcionário!')
    }
  }

  const handleDeleteEmployee = async (id: string, email: string) => {
    if (!confirm('Tem certeza que deseja excluir este funcionário?')) return
    const success = await deleteEmployee(id, email)
    if (success) {
      setEmployees(employees.filter(e => e.id !== id))
    }
  }

  // Processar fila de upload - envia um arquivo por vez
  const processUploadQueue = async (files: File[]) => {
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      setCurrentUploadIndex(i)

      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('fileName', file.name)
        formData.append('fileType', file.type)

        console.log(`📤 [${i + 1}/${files.length}] Enviando ${file.name} para processamento...`)

        // Enviar para API route que faz proxy para N8N
        const response = await fetch('/api/upload-file', {
          method: 'POST',
          body: formData,
        })

        if (response.ok) {
          const result = await response.json()
          setUploadedFiles(prev => [...prev, file.name])
          setUploadProgress(prev => ({ ...prev, completed: prev.completed + 1 }))
          console.log(`✅ [${i + 1}/${files.length}] Arquivo ${file.name} processado com sucesso!`, result)
        } else {
          const error = await response.json()
          console.error(`❌ [${i + 1}/${files.length}] Erro ao enviar ${file.name}:`, error)
          alert(`Erro ao enviar arquivo ${file.name}: ${error.details || error.error}`)
        }
      } catch (error) {
        console.error(`💥 [${i + 1}/${files.length}] Erro ao processar ${file.name}:`, error)
        alert(`Erro ao processar arquivo ${file.name}!`)
      }
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    const fileArray = Array.from(files)
    setUploadQueue(fileArray)
    setUploadProgress({ total: fileArray.length, completed: 0 })
    setUploadingFile(true)

    try {
      await processUploadQueue(fileArray)
      alert(`${fileArray.length} arquivo(s) processado(s) com sucesso! Os embeddings foram criados.`)
    } catch (error) {
      console.error('Erro ao fazer upload:', error)
      alert('Erro ao fazer upload dos arquivos!')
    } finally {
      setUploadingFile(false)
      setCurrentUploadIndex(-1)
      setUploadQueue([])
      // Limpar input
      event.target.value = ''
    }
  }

  const handleSetBusinessType = async (type: 'B2B' | 'B2C') => {
    const success = await setCompanyType(type)
    if (success) {
      setBusinessType(type)
    }
  }

  const handleSavePersona = async () => {
    if (businessType === 'B2B') {
      const persona = newPersona as PersonaB2B
      if (!persona.job_title) {
        alert('Por favor, preencha o cargo')
        return
      }

      if (editingPersonaId) {
        // Atualizar persona existente
        const { supabase } = await import('@/lib/supabase')
        const { data, error } = await supabase
          .from('personas')
          .update({ ...persona, business_type: 'B2B' })
          .eq('id', editingPersonaId)
          .select()
          .single()

        if (error) {
          console.error('Erro ao atualizar persona:', error)
          alert('Erro ao atualizar persona!')
          return
        }

        setPersonas(personas.map(p => p.id === editingPersonaId ? data : p))
        // Marcar persona como editada (permite reavaliação)
        if (editingPersonaId) {
          setEditedPersonaIds(prev => new Set(prev).add(editingPersonaId))
        }
        setNewPersona({})
        setShowPersonaForm(false)
        setEditingPersonaId(null)
      } else {
        // Criar nova persona
        const result = await addPersona({ ...persona, business_type: 'B2B' })
        if (result) {
          setPersonas([...personas, result])
          setNewPersona({})
          setShowPersonaForm(false)
        }
      }
    } else {
      const persona = newPersona as PersonaB2C
      if (!persona.profession) {
        alert('Por favor, preencha a profissão')
        return
      }

      if (editingPersonaId) {
        // Atualizar persona existente
        const { supabase } = await import('@/lib/supabase')
        const { data, error } = await supabase
          .from('personas')
          .update({ ...persona, business_type: 'B2C' })
          .eq('id', editingPersonaId)
          .select()
          .single()

        if (error) {
          console.error('Erro ao atualizar persona:', error)
          alert('Erro ao atualizar persona!')
          return
        }

        setPersonas(personas.map(p => p.id === editingPersonaId ? data : p))
        // Marcar persona como editada (permite reavaliação)
        if (editingPersonaId) {
          setEditedPersonaIds(prev => new Set(prev).add(editingPersonaId))
        }
        setNewPersona({})
        setShowPersonaForm(false)
        setEditingPersonaId(null)
      } else {
        // Criar nova persona
        const result = await addPersona({ ...persona, business_type: 'B2C' })
        if (result) {
          setPersonas([...personas, result])
          setNewPersona({})
          setShowPersonaForm(false)
        }
      }
    }
  }

  const handleDeletePersona = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta persona?')) return
    const success = await deletePersona(id)
    if (success) {
      setPersonas(personas.filter(p => p.id !== id))
    }
  }

  const handleEvaluatePersona = async (persona: Persona) => {
    setEvaluatingPersona(true)
    try {
      console.log('📊 Enviando persona para avaliação...', persona)

      // Juntar todos os campos do formulário em um único texto
      let personaText = ''

      if (persona.business_type === 'B2B') {
        const personaB2B = persona as PersonaB2B
        personaText = `Tipo de Negócio: B2B\n\nCargo: ${personaB2B.job_title || 'N/A'}\n\nTipo de Empresa: ${personaB2B.company_type || 'N/A'}\n\nContexto: ${personaB2B.context || 'N/A'}\n\nO que busca para a empresa: ${personaB2B.company_goals || 'N/A'}\n\nPrincipais desafios/dores do negócio: ${personaB2B.business_challenges || 'N/A'}`
      } else {
        const personaB2C = persona as PersonaB2C
        personaText = `Tipo de Negócio: B2C\n\nProfissão: ${personaB2C.profession || 'N/A'}\n\nContexto: ${personaB2C.context || 'N/A'}\n\nO que busca/valoriza: ${personaB2C.what_seeks || 'N/A'}\n\nPrincipais dores/problemas: ${personaB2C.main_pains || 'N/A'}`
      }

      const response = await fetch('https://ezboard.app.n8n.cloud/webhook/persona-consultor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          persona: personaText
        })
      })

      if (response.ok) {
        const result = await response.json()
        console.log('✅ Resposta recebida:', result)

        // Parse do JSON retornado pelo N8N
        let evaluation

        // N8N retorna array com objeto {output: "```json\n{...}\n```"}
        if (Array.isArray(result) && result[0]?.output) {
          const outputString = result[0].output
          // Remover ```json e ``` do início e fim
          const jsonString = outputString.replace(/```json\n/, '').replace(/\n```$/, '')
          evaluation = JSON.parse(jsonString)
        } else if (result.output) {
          const outputString = result.output
          const jsonString = outputString.replace(/```json\n/, '').replace(/\n```$/, '')
          evaluation = JSON.parse(jsonString)
        } else {
          evaluation = result
        }

        console.log('✅ Avaliação processada:', evaluation)
        setPersonaEvaluation(evaluation)
        setShowPersonaEvaluationModal(true)

        // Salvar o score no banco de dados
        if (evaluation.score_geral && persona.id) {
          const { supabase } = await import('@/lib/supabase')
          const { error: updateError } = await supabase
            .from('personas')
            .update({ evaluation_score: evaluation.score_geral })
            .eq('id', persona.id)

          if (!updateError) {
            // Atualizar a lista local de personas
            setPersonas(personas.map(p =>
              p.id === persona.id
                ? { ...p, evaluation_score: evaluation.score_geral }
                : p
            ))
            // Remover da lista de editadas (desabilita o botão)
            if (persona.id) {
              setEditedPersonaIds(prev => {
                const newSet = new Set(prev)
                newSet.delete(persona.id!)
                return newSet
              })
            }
          }
        }
      } else {
        console.error('❌ Erro ao avaliar persona:', response.status)
        alert(`Erro ao avaliar persona (${response.status})`)
      }
    } catch (error) {
      console.error('💥 Erro ao avaliar persona:', error)
      alert('Erro ao conectar com o serviço de avaliação')
    } finally {
      setEvaluatingPersona(false)
    }
  }

  const handleAddObjection = async () => {
    if (newObjection.trim()) {
      const objection = await addObjection(newObjection.trim(), [])
      if (objection) {
        setObjections([...objections, objection])
        setNewObjection('')
        setEditingObjectionId(objection.id)
        setExpandedObjections(new Set([objection.id]))
      }
    }
  }

  const handleAddRebuttal = async (objectionId: string) => {
    if (!newRebuttal.trim()) return

    const objection = objections.find(o => o.id === objectionId)
    if (!objection) return

    const updatedRebuttals = [...(objection.rebuttals || []), newRebuttal.trim()]
    const success = await updateObjection(objectionId, objection.name, updatedRebuttals)

    if (success) {
      setObjections(objections.map(o =>
        o.id === objectionId ? { ...o, rebuttals: updatedRebuttals } : o
      ))
      setNewRebuttal('')
    }
  }

  const handleRemoveRebuttal = async (objectionId: string, rebuttalIndex: number) => {
    const objection = objections.find(o => o.id === objectionId)
    if (!objection) return

    const updatedRebuttals = objection.rebuttals.filter((_, i) => i !== rebuttalIndex)
    const success = await updateObjection(objectionId, objection.name, updatedRebuttals)

    if (success) {
      setObjections(objections.map(o =>
        o.id === objectionId ? { ...o, rebuttals: updatedRebuttals } : o
      ))
    }
  }

  const handleRemoveObjection = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta objeção?')) return
    const success = await deleteObjection(id)
    if (success) {
      setObjections(objections.filter(o => o.id !== id))
      setExpandedObjections(prev => {
        const newSet = new Set(prev)
        newSet.delete(id)
        return newSet
      })
    }
  }

  const toggleObjectionExpanded = (id: string) => {
    setExpandedObjections(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  const handleEvaluateObjection = async (objection: Objection) => {
    setEvaluatingObjection(true)
    setObjectionEvaluation(null)

    try {
      console.log('🔍 Iniciando avaliação da objeção:', objection.name)

      // Formatar como texto único
      let objectionText = `OBJEÇÃO:\n${objection.name}\n\nFORMAS DE QUEBRAR:`

      if (objection.rebuttals && objection.rebuttals.length > 0) {
        objection.rebuttals.forEach((rebuttal, index) => {
          objectionText += `\n${index + 1}. ${rebuttal}`
        })
      } else {
        objectionText += `\nNenhuma forma de quebrar cadastrada.`
      }

      const payload = {
        objecao_completa: objectionText
      }

      console.log('📤 Enviando para N8N:', payload)

      const response = await fetch('https://ezboard.app.n8n.cloud/webhook/ed84cced-6bf5-4c4d-87e7-4ca3057be871', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`)
      }

      const result = await response.json()
      console.log('📥 Resposta N8N:', result)

      // Parse do formato N8N
      let evaluation = result
      if (Array.isArray(result) && result[0]?.output) {
        const outputString = result[0].output
        evaluation = JSON.parse(outputString)
      } else if (result?.output && typeof result.output === 'string') {
        evaluation = JSON.parse(result.output)
      }

      console.log('✅ Avaliação processada:', evaluation)

      // Salvar score no banco de dados
      if (evaluation?.nota_final !== undefined) {
        const success = await updateObjectionScore(objection.id, evaluation.nota_final)
        if (success) {
          console.log('💾 Score salvo no banco:', evaluation.nota_final)
          // Atualizar state local
          setObjections(objections.map(o =>
            o.id === objection.id ? { ...o, evaluation_score: evaluation.nota_final } : o
          ))
        }
      }

      setObjectionEvaluation(evaluation)
      setShowObjectionEvaluationModal(true)

    } catch (error) {
      console.error('💥 Erro ao avaliar objeção:', error)
      alert('Erro ao conectar com o serviço de avaliação')
    } finally {
      setEvaluatingObjection(false)
    }
  }

  const getQualityLabel = (score: number): string => {
    if (score >= 95) return 'Perfeito'
    if (score >= 80) return 'Ótimo'
    if (score >= 60) return 'Suficiente'
    if (score >= 40) return 'Ok'
    if (score >= 20) return 'Ruim'
    return 'Insuficiente'
  }

  const handleEvaluateQuality = async () => {
    setEvaluatingQuality(true)

    try {
      console.log('📊 Solicitando avaliação de qualidade...')

      const response = await fetch('https://ezboard.app.n8n.cloud/webhook/avaliar-documento', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'evaluate_quality',
          timestamp: new Date().toISOString()
        })
      })

      if (response.ok) {
        const result = await response.json()
        console.log('✅ Resposta recebida do N8N:', result)

        let evaluation

        // O N8N pode retornar de 3 formas diferentes:
        // 1. Objeto com propriedade 'output' contendo string JSON
        // 2. Diretamente o objeto com nota_final
        // 3. String JSON pura

        if (result.output) {
          // Caso 1: Tem propriedade output
          try {
            if (typeof result.output === 'string') {
              evaluation = JSON.parse(result.output)
            } else {
              evaluation = result.output
            }
            console.log('✅ Avaliação extraída do output:', evaluation)
          } catch (parseError) {
            console.error('❌ Erro ao fazer parse do output:', parseError)
            console.error('Output recebido:', result.output)
            throw new Error('Erro ao processar resposta do servidor')
          }
        } else if (result.nota_final) {
          // Caso 2: Objeto direto
          evaluation = result
          console.log('✅ Avaliação recebida diretamente:', evaluation)
        } else if (typeof result === 'string') {
          // Caso 3: String JSON
          try {
            evaluation = JSON.parse(result)
            console.log('✅ Avaliação parseada de string:', evaluation)
          } catch (parseError) {
            console.error('❌ Erro ao fazer parse da string:', parseError)
            throw new Error('Erro ao processar resposta do servidor')
          }
        } else {
          console.error('❌ Formato de resposta inesperado:', result)
          throw new Error('Formato de resposta inesperado')
        }

        // Verificar se a avaliação tem os campos esperados
        if (!evaluation.nota_final || !evaluation.classificacao) {
          console.error('❌ Resposta sem campos obrigatórios:', evaluation)
          throw new Error('Resposta incompleta do servidor')
        }

        console.log('✅ Avaliação final processada:', evaluation)
        setQualityScore(evaluation.nota_final)
        setQualityEvaluation(evaluation)

        alert('Avaliação de qualidade concluída!')
      } else {
        const errorText = await response.text()
        console.error('❌ Erro ao avaliar qualidade:', response.status, errorText)
        alert(`Erro ao avaliar qualidade dos arquivos (${response.status})`)
      }
    } catch (error) {
      console.error('💥 Erro ao avaliar qualidade:', error)
      alert('Erro ao conectar com o serviço de avaliação')
    } finally {
      setEvaluatingQuality(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-purple-500/20">
        <button
          onClick={() => setActiveTab('employees')}
          className={`px-6 py-3 font-medium transition-all ${
            activeTab === 'employees'
              ? 'border-b-2 border-purple-500 text-white'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          <Users className="w-4 h-4 inline mr-2" />
          Funcionários
        </button>
        <button
          onClick={() => setActiveTab('business-type')}
          className={`px-6 py-3 font-medium transition-all ${
            activeTab === 'business-type'
              ? 'border-b-2 border-purple-500 text-white'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          <Building2 className="w-4 h-4 inline mr-2" />
          Tipo de Empresa
        </button>
        <button
          onClick={() => setActiveTab('personas')}
          className={`px-6 py-3 font-medium transition-all ${
            activeTab === 'personas'
              ? 'border-b-2 border-purple-500 text-white'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          <UserCircle2 className="w-4 h-4 inline mr-2" />
          Personas
        </button>
        <button
          onClick={() => setActiveTab('objections')}
          className={`px-6 py-3 font-medium transition-all ${
            activeTab === 'objections'
              ? 'border-b-2 border-purple-500 text-white'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          <Target className="w-4 h-4 inline mr-2" />
          Objeções
        </button>
        <button
          onClick={() => setActiveTab('files')}
          className={`px-6 py-3 font-medium transition-all ${
            activeTab === 'files'
              ? 'border-b-2 border-purple-500 text-white'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          <FileText className="w-4 h-4 inline mr-2" />
          Arquivos
        </button>
      </div>

      {/* Content */}
      <div className="py-4">
        {/* Funcionários Tab */}
        {activeTab === 'employees' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-bold mb-4">Gerenciar Funcionários</h3>

              {/* Lista de funcionários */}
              {employees.length > 0 && (
                <div className="mb-6 overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left border-b border-purple-500/20">
                        <th className="pb-3 text-sm font-medium text-gray-400">Nome</th>
                        <th className="pb-3 text-sm font-medium text-gray-400">Email</th>
                        <th className="pb-3 text-sm font-medium text-gray-400">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {employees.map((emp) => (
                        <tr key={emp.id} className="border-b border-purple-500/10">
                          <td className="py-3 text-sm text-gray-300">{emp.name}</td>
                          <td className="py-3 text-sm text-gray-300">{emp.email}</td>
                          <td className="py-3">
                            <button
                              onClick={() => handleDeleteEmployee(emp.id, emp.email)}
                              className="text-red-400 hover:text-red-300 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Adicionar novo funcionário */}
              {!addingEmployee ? (
                <button
                  onClick={() => setAddingEmployee(true)}
                  className="px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-500 rounded-xl font-medium hover:scale-105 transition-transform flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Adicionar Funcionário
                </button>
              ) : (
                <div className="bg-gray-900/50 border border-purple-500/20 rounded-xl p-6">
                  <h4 className="text-lg font-semibold mb-4">Novo Funcionário</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Nome</label>
                      <input
                        type="text"
                        value={newEmployeeName}
                        onChange={(e) => setNewEmployeeName(e.target.value)}
                        className="w-full px-4 py-3 bg-gray-800/50 border border-purple-500/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/40"
                        placeholder="João Silva"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
                      <input
                        type="email"
                        value={newEmployeeEmail}
                        onChange={(e) => setNewEmployeeEmail(e.target.value)}
                        className="w-full px-4 py-3 bg-gray-800/50 border border-purple-500/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/40"
                        placeholder="joao@empresa.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Senha</label>
                      <input
                        type="password"
                        value={newEmployeePassword}
                        onChange={(e) => setNewEmployeePassword(e.target.value)}
                        className="w-full px-4 py-3 bg-gray-800/50 border border-purple-500/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/40"
                        placeholder="••••••••"
                      />
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setAddingEmployee(false)}
                        className="flex-1 px-6 py-3 bg-gray-800/50 border border-purple-500/20 rounded-xl font-medium hover:bg-gray-700/50 transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleSaveEmployee}
                        className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-500 rounded-xl font-medium hover:scale-105 transition-transform"
                      >
                        Salvar
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tipo de Empresa Tab */}
        {activeTab === 'business-type' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-bold mb-4">Tipo de Empresa</h3>
              <div className="flex gap-3">
                <button
                  onClick={() => handleSetBusinessType('B2C')}
                  className={`flex-1 px-6 py-4 rounded-xl font-medium transition-all ${
                    businessType === 'B2C'
                      ? 'bg-gradient-to-r from-purple-600 to-purple-500 text-white'
                      : 'bg-gray-800/50 border border-purple-500/20 text-gray-400 hover:border-purple-500/40'
                  }`}
                >
                  B2C (Business to Consumer)
                </button>
                <button
                  onClick={() => handleSetBusinessType('B2B')}
                  className={`flex-1 px-6 py-4 rounded-xl font-medium transition-all ${
                    businessType === 'B2B'
                      ? 'bg-gradient-to-r from-purple-600 to-purple-500 text-white'
                      : 'bg-gray-800/50 border border-purple-500/20 text-gray-400 hover:border-purple-500/40'
                  }`}
                >
                  B2B (Business to Business)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Personas Tab */}
        {activeTab === 'personas' && (
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold">Personas {businessType}</h3>
                <button
                  onClick={() => {
                    setShowPersonaForm(true)
                    setNewPersona({})
                    setEditingPersonaId(null)
                  }}
                  className="px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-500 rounded-xl font-medium hover:scale-105 transition-transform flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Nova Persona {businessType}
                </button>
              </div>

              {/* Aviso de Qualidade */}
              <div className="mb-4 bg-red-900/20 border border-red-500/40 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-red-300 leading-relaxed">
                      <span className="font-bold">Atenção:</span> Personas com pontuação abaixo de 7.0 podem comprometer a eficiência e o realismo dos roleplays de vendas.
                    </p>
                  </div>
                </div>
              </div>

              {/* Lista de personas */}
              {!showPersonaForm && personas.filter(p => p.business_type === businessType).length > 0 && (
                <div className="mb-4 space-y-4">
                  {personas.filter(p => p.business_type === businessType).map((persona) => (
                    <div
                      key={persona.id}
                      className="bg-gradient-to-br from-gray-900/80 to-gray-900/40 border border-purple-500/30 rounded-xl p-5 hover:border-purple-500/50 transition-all shadow-lg"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-3">
                          {/* Título */}
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-600 to-purple-400 flex items-center justify-center flex-shrink-0">
                              <UserCircle2 className="w-7 h-7 text-white" />
                            </div>
                            <h4 className="text-lg font-bold text-white">
                              {persona.business_type === 'B2B'
                                ? (persona as PersonaB2B).job_title
                                : (persona as PersonaB2C).profession}
                            </h4>
                          </div>

                          {/* Conteúdo B2B */}
                          {persona.business_type === 'B2B' && (
                            <div className="space-y-2 pl-15">
                              {(persona as PersonaB2B).company_type && (
                                <p className="text-sm text-gray-300 leading-relaxed">
                                  <span className="font-bold text-purple-400">Tipo de Empresa:</span>{' '}
                                  {(persona as PersonaB2B).company_type}
                                </p>
                              )}
                              {(persona as PersonaB2B).company_goals && (
                                <p className="text-sm text-gray-300 leading-relaxed">
                                  <span className="font-bold text-purple-400">Busca:</span>{' '}
                                  {(persona as PersonaB2B).company_goals}
                                </p>
                              )}
                              {(persona as PersonaB2B).business_challenges && (
                                <p className="text-sm text-gray-300 leading-relaxed">
                                  <span className="font-bold text-purple-400">Desafios:</span>{' '}
                                  {(persona as PersonaB2B).business_challenges}
                                </p>
                              )}
                              {(persona as PersonaB2B).context && (
                                <p className="text-sm text-gray-400 italic mt-2 pt-2 border-t border-purple-500/20">
                                  {(persona as PersonaB2B).context}
                                </p>
                              )}
                            </div>
                          )}

                          {/* Conteúdo B2C */}
                          {persona.business_type === 'B2C' && (
                            <div className="space-y-2 pl-15">
                              {(persona as PersonaB2C).what_seeks && (
                                <p className="text-sm text-gray-300 leading-relaxed">
                                  <span className="font-bold text-purple-400">Busca:</span>{' '}
                                  {(persona as PersonaB2C).what_seeks}
                                </p>
                              )}
                              {(persona as PersonaB2C).main_pains && (
                                <p className="text-sm text-gray-300 leading-relaxed">
                                  <span className="font-bold text-purple-400">Dores:</span>{' '}
                                  {(persona as PersonaB2C).main_pains}
                                </p>
                              )}
                              {(persona as PersonaB2C).context && (
                                <p className="text-sm text-gray-400 italic mt-2 pt-2 border-t border-purple-500/20">
                                  {(persona as PersonaB2C).context}
                                </p>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Botões de ação */}
                        <div className="flex gap-2 flex-shrink-0 items-center">
                          {/* Score da avaliação */}
                          {persona.evaluation_score !== undefined && persona.evaluation_score !== null && (
                            <div className="flex items-center gap-1.5 px-3 py-2 bg-green-900/30 border border-green-500/40 rounded-lg">
                              <span className="text-xs text-green-300 font-medium">Nota:</span>
                              <span className="text-lg font-bold text-green-400">{persona.evaluation_score.toFixed(1)}</span>
                            </div>
                          )}

                          <button
                            onClick={() => handleEvaluatePersona(persona)}
                            disabled={evaluatingPersona || (persona.evaluation_score !== undefined && persona.evaluation_score !== null && !editedPersonaIds.has(persona.id!))}
                            className={`px-4 py-2 rounded-lg font-medium text-white hover:scale-105 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center gap-2 ${
                              editedPersonaIds.has(persona.id!)
                                ? 'bg-gradient-to-r from-green-500 to-green-400 shadow-green-500/30'
                                : 'bg-gradient-to-r from-green-500 to-green-400 shadow-green-500/30'
                            }`}
                            title={
                              persona.evaluation_score !== undefined && persona.evaluation_score !== null && !editedPersonaIds.has(persona.id!)
                                ? 'Edite a persona para poder reavaliá-la'
                                : editedPersonaIds.has(persona.id!)
                                ? 'Reavaliar persona após edição'
                                : 'Avaliar persona'
                            }
                          >
                            {evaluatingPersona && <Loader2 className="w-4 h-4 animate-spin" />}
                            {evaluatingPersona
                              ? 'AVALIANDO...'
                              : editedPersonaIds.has(persona.id!)
                              ? 'REAVALIAR PERSONA'
                              : 'AVALIAR PERSONA'}
                          </button>
                          <button
                            onClick={() => {
                              setEditingPersonaId(persona.id!)
                              setNewPersona(persona)
                              setShowPersonaForm(true)
                            }}
                            className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 p-2 rounded-lg transition-all"
                            title="Editar persona"
                          >
                            <Settings className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDeletePersona(persona.id!)}
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10 p-2 rounded-lg transition-all"
                            title="Deletar persona"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Formulário de Nova/Editar Persona */}
              {showPersonaForm && (
                <div className="bg-gray-900/50 border border-purple-500/20 rounded-xl p-6 space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-bold">
                      {editingPersonaId ? 'Editar' : 'Nova'} Persona {businessType}
                    </h4>
                    <button
                      onClick={() => {
                        setShowPersonaForm(false)
                        setNewPersona({})
                        setEditingPersonaId(null)
                      }}
                      className="text-gray-400 hover:text-gray-300"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {businessType === 'B2B' ? (
                    <>
                      {/* Formulário B2B */}
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Cargo *
                        </label>
                        <input
                          type="text"
                          value={(newPersona as PersonaB2B).job_title || ''}
                          onChange={(e) => setNewPersona({ ...newPersona, job_title: e.target.value })}
                          className="w-full px-4 py-3 bg-gray-800/50 border border-purple-500/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/40"
                          placeholder="Ex: Gerente de Compras, CEO, Diretor de TI"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Tipo de Empresa e Faturamento
                        </label>
                        <input
                          type="text"
                          value={(newPersona as PersonaB2B).company_type || ''}
                          onChange={(e) => setNewPersona({ ...newPersona, company_type: e.target.value })}
                          className="w-full px-4 py-3 bg-gray-800/50 border border-purple-500/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/40"
                          placeholder="Ex: Startup de tecnologia com faturamento de R$500k/mês"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Contexto (descrição livre)
                        </label>
                        <textarea
                          value={(newPersona as PersonaB2B).context || ''}
                          onChange={(e) => setNewPersona({ ...newPersona, context: e.target.value })}
                          className="w-full px-4 py-3 bg-gray-800/50 border border-purple-500/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/40 min-h-[80px]"
                          placeholder="Ex: Responsável por decisões de compra, equipe de 10 pessoas, busca inovação"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          O que busca para a empresa?
                        </label>
                        <textarea
                          value={(newPersona as PersonaB2B).company_goals || ''}
                          onChange={(e) => setNewPersona({ ...newPersona, company_goals: e.target.value })}
                          className="w-full px-4 py-3 bg-gray-800/50 border border-purple-500/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/40 min-h-[80px]"
                          placeholder="Ex: Aumentar eficiência, reduzir custos, melhorar processos, escalar o negócio"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Principais desafios/dores do negócio
                        </label>
                        <textarea
                          value={(newPersona as PersonaB2B).business_challenges || ''}
                          onChange={(e) => setNewPersona({ ...newPersona, business_challenges: e.target.value })}
                          className="w-full px-4 py-3 bg-gray-800/50 border border-purple-500/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/40 min-h-[80px]"
                          placeholder="Ex: Processos manuais demorados, falta de integração, dificuldade em medir resultados"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Formulário B2C */}
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Profissão *
                        </label>
                        <input
                          type="text"
                          value={(newPersona as PersonaB2C).profession || ''}
                          onChange={(e) => setNewPersona({ ...newPersona, profession: e.target.value })}
                          className="w-full px-4 py-3 bg-gray-800/50 border border-purple-500/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/40"
                          placeholder="Ex: Professor, Médico, Estudante"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Contexto (descrição livre)
                        </label>
                        <textarea
                          value={(newPersona as PersonaB2C).context || ''}
                          onChange={(e) => setNewPersona({ ...newPersona, context: e.target.value })}
                          className="w-full px-4 py-3 bg-gray-800/50 border border-purple-500/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/40 min-h-[80px]"
                          placeholder="Ex: Mãe de 2 filhos, mora em apartamento, trabalha home office"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          O que busca/valoriza?
                        </label>
                        <textarea
                          value={(newPersona as PersonaB2C).what_seeks || ''}
                          onChange={(e) => setNewPersona({ ...newPersona, what_seeks: e.target.value })}
                          className="w-full px-4 py-3 bg-gray-800/50 border border-purple-500/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/40 min-h-[80px]"
                          placeholder="Ex: Praticidade, economia de tempo, produtos de qualidade, bom atendimento"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Principais dores/problemas
                        </label>
                        <textarea
                          value={(newPersona as PersonaB2C).main_pains || ''}
                          onChange={(e) => setNewPersona({ ...newPersona, main_pains: e.target.value })}
                          className="w-full px-4 py-3 bg-gray-800/50 border border-purple-500/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/40 min-h-[80px]"
                          placeholder="Ex: Falta de tempo, dificuldade em encontrar produtos confiáveis, preços altos"
                        />
                      </div>
                    </>
                  )}

                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-sm text-blue-300">
                    <strong>Lembre-se:</strong> Nome, idade, temperamento e objeções serão configurados antes de iniciar cada roleplay.
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setShowPersonaForm(false)
                        setNewPersona({})
                        setEditingPersonaId(null)
                      }}
                      className="flex-1 px-6 py-3 bg-gray-800/50 border border-purple-500/20 rounded-xl font-medium hover:border-purple-500/40 transition-all"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleSavePersona}
                      className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-500 rounded-xl font-medium hover:scale-105 transition-transform"
                    >
                      {editingPersonaId ? 'Atualizar' : 'Salvar'} Persona
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Objeções Tab */}
        {activeTab === 'objections' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-bold mb-4">Principais Objeções</h3>
              <p className="text-gray-400 mb-6 text-sm">
                Registre objeções comuns e adicione múltiplas formas de quebrá-las para cada uma.
              </p>

              {/* Lista de objeções */}
              {objections.length > 0 && (
                <div className="mb-4 space-y-3">
                  {objections.map((objection) => (
                    <div
                      key={objection.id}
                      className="bg-gray-900/50 border border-purple-500/20 rounded-xl overflow-hidden"
                    >
                      {/* Header da objeção */}
                      <div className="flex items-center justify-between px-4 py-3">
                        <div className="flex items-center gap-3 flex-1">
                          <button
                            onClick={() => toggleObjectionExpanded(objection.id)}
                            className="text-purple-400 hover:text-purple-300 transition-colors"
                          >
                            <svg
                              className={`w-5 h-5 transform transition-transform ${expandedObjections.has(objection.id) ? 'rotate-90' : ''}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                          <div className="flex-1">
                            <span className="text-gray-300 font-medium">{objection.name}</span>
                            <span className="text-gray-500 text-sm ml-2">
                              ({objection.rebuttals?.length || 0} {objection.rebuttals?.length === 1 ? 'forma de quebra' : 'formas de quebra'})
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {/* Score Badge */}
                          {objection.evaluation_score !== null && objection.evaluation_score !== undefined && (
                            <div className={`px-2 py-1 rounded text-xs font-bold ${
                              objection.evaluation_score >= 7 ? 'bg-green-600/20 text-green-400' :
                              objection.evaluation_score >= 4 ? 'bg-yellow-600/20 text-yellow-400' :
                              'bg-red-600/20 text-red-400'
                            }`}>
                              {objection.evaluation_score.toFixed(1)}
                            </div>
                          )}

                          <button
                            onClick={() => handleEvaluateObjection(objection)}
                            disabled={evaluatingObjection}
                            className="px-3 py-1.5 bg-green-600/20 hover:bg-green-600/30 border border-green-500/30 rounded-lg text-xs font-medium text-green-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {evaluatingObjection ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              objection.evaluation_score !== null && objection.evaluation_score !== undefined ? 'REAVALIAR' : 'AVALIAR'
                            )}
                          </button>
                          <button
                            onClick={() => handleRemoveObjection(objection.id)}
                            className="text-red-400 hover:text-red-300 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Conteúdo expandido */}
                      {expandedObjections.has(objection.id) && (
                        <div className="border-t border-purple-500/20 px-4 py-3 space-y-3 bg-gray-800/30">
                          <div>
                            <h4 className="text-sm font-medium text-gray-400 mb-2">Formas de Quebrar:</h4>

                            {/* Lista de rebuttals */}
                            {objection.rebuttals && objection.rebuttals.length > 0 ? (
                              <div className="space-y-2 mb-3">
                                {objection.rebuttals.map((rebuttal, index) => (
                                  <div
                                    key={index}
                                    className="flex items-start gap-2 bg-gray-900/50 border border-purple-500/10 rounded-lg px-3 py-2"
                                  >
                                    <span className="text-purple-400 font-bold text-sm mt-0.5">{index + 1}.</span>
                                    <span className="text-gray-300 text-sm flex-1">{rebuttal}</span>
                                    <button
                                      onClick={() => handleRemoveRebuttal(objection.id, index)}
                                      className="text-red-400 hover:text-red-300 transition-colors"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-gray-500 text-sm mb-3 italic">Nenhuma forma de quebra registrada ainda.</p>
                            )}

                            {/* Adicionar nova forma de quebra */}
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={editingObjectionId === objection.id ? newRebuttal : ''}
                                onFocus={() => setEditingObjectionId(objection.id)}
                                onChange={(e) => setNewRebuttal(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleAddRebuttal(objection.id)
                                  }
                                }}
                                className="flex-1 px-3 py-2 bg-gray-800/50 border border-purple-500/20 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500/40"
                                placeholder="Ex: Apresentar cálculo de ROI detalhado mostrando retorno em 6 meses com base em cases reais do segmento"
                              />
                              <button
                                onClick={() => handleAddRebuttal(objection.id)}
                                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-500 rounded-lg font-medium hover:scale-105 transition-transform text-sm"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Adicionar nova objeção */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newObjection}
                  onChange={(e) => setNewObjection(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddObjection()}
                  className="flex-1 px-4 py-3 bg-gray-800/50 border border-purple-500/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/40"
                  placeholder="Ex: Cliente diz que o preço está acima do orçamento disponível e questiona se terá ROI rápido o suficiente para justificar"
                />
                <button
                  onClick={handleAddObjection}
                  className="px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-500 rounded-xl font-medium hover:scale-105 transition-transform"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Arquivos Tab */}
        {activeTab === 'files' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-bold mb-4">Upload de Arquivos para IA</h3>
              <p className="text-gray-400 mb-6">
                Faça upload de PDFs, vídeos ou áudios para melhorar a base de conhecimento da IA.
              </p>

              {/* Upload Area */}
              <div className="bg-gray-900/50 border-2 border-dashed border-purple-500/30 rounded-xl p-8 text-center">
                <Upload className="w-12 h-12 text-purple-400 mx-auto mb-4" />
                <h4 className="text-lg font-semibold mb-2">Selecione os arquivos</h4>
                <p className="text-sm text-gray-400 mb-4">
                  Suporta PDF, vídeo e áudio
                </p>
                <label className="inline-block">
                  <input
                    type="file"
                    multiple
                    onChange={handleFileUpload}
                    disabled={uploadingFile}
                    className="hidden"
                    accept=".pdf,video/*,audio/*"
                  />
                  <span className="px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-500 rounded-xl font-medium hover:scale-105 transition-transform inline-block cursor-pointer">
                    {uploadingFile ? 'Processando...' : 'Escolher Arquivos'}
                  </span>
                </label>
              </div>

              {/* Upload Progress */}
              {uploadingFile && (
                <div className="bg-gray-900/50 border border-purple-500/20 rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
                    <span className="text-gray-300">
                      Processando arquivo {currentUploadIndex + 1} de {uploadProgress.total}...
                    </span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-purple-600 to-purple-500 h-2 rounded-full transition-all"
                      style={{ width: `${(uploadProgress.completed / uploadProgress.total) * 100}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {/* Uploaded Files */}
              {uploadedFiles.length > 0 && (
                <div className="bg-gray-900/50 border border-purple-500/20 rounded-xl p-6">
                  <h4 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    Arquivos Processados
                  </h4>
                  <ul className="space-y-2">
                    {uploadedFiles.map((file, index) => (
                      <li key={index} className="text-sm text-gray-400">
                        • {file}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Quality Scale Legend */}
              <div className="bg-gray-900/50 border border-purple-500/20 rounded-xl p-6 mb-6">
                <h4 className="text-lg font-semibold mb-4">Escala de Qualidade</h4>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <span className="text-sm text-gray-300">0-19: Insuficiente</span>
                    </div>
                    <div className="flex-1 flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                      <span className="text-sm text-gray-300">20-39: Ruim</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                      <span className="text-sm text-gray-300">40-59: Ok</span>
                    </div>
                    <div className="flex-1 flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                      <span className="text-sm text-gray-300">60-79: Suficiente</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                      <span className="text-sm text-gray-300">80-94: Ótimo</span>
                    </div>
                    <div className="flex-1 flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      <span className="text-sm text-gray-300">95-100: Perfeito</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quality Evaluation */}
              <div className="bg-gray-900/50 border border-purple-500/20 rounded-xl p-6">
                <h4 className="text-lg font-semibold mb-4">Avaliação de Qualidade</h4>
                <button
                  onClick={handleEvaluateQuality}
                  disabled={evaluatingQuality}
                  className="px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-500 rounded-xl font-medium hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {evaluatingQuality ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Avaliando...
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-5 h-5" />
                      Avaliar Qualidade dos Arquivos
                    </>
                  )}
                </button>

                {qualityEvaluation && (
                  <div className="mt-6 space-y-4">
                    {/* Score */}
                    <div className="bg-gray-800/50 border border-purple-500/20 rounded-xl p-6">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-gray-300 text-lg">Nota Final</span>
                        <span className="text-4xl font-bold text-purple-400">
                          {qualityEvaluation.nota_final}
                          <span className="text-xl text-gray-500">/100</span>
                        </span>
                      </div>

                      {/* Quality Bar with Divisions */}
                      <div className="relative mb-4">
                        {/* Background Scale */}
                        <div className="w-full h-6 rounded-full overflow-hidden flex">
                          <div className="bg-red-500/30" style={{ width: '20%' }}></div>
                          <div className="bg-orange-500/30" style={{ width: '20%' }}></div>
                          <div className="bg-yellow-500/30" style={{ width: '20%' }}></div>
                          <div className="bg-blue-500/30" style={{ width: '20%' }}></div>
                          <div className="bg-purple-500/30" style={{ width: '15%' }}></div>
                          <div className="bg-green-500/30" style={{ width: '5%' }}></div>
                        </div>

                        {/* Progress Bar */}
                        <div className="absolute top-0 left-0 h-6 rounded-full overflow-hidden" style={{ width: `${qualityEvaluation.nota_final}%` }}>
                          <div className="h-full flex">
                            <div className="bg-red-500" style={{ width: `${Math.min(100, (20 / qualityEvaluation.nota_final) * 100)}%` }}></div>
                            {qualityEvaluation.nota_final > 20 && (
                              <div className="bg-orange-500" style={{ width: `${Math.min(100, ((20) / qualityEvaluation.nota_final) * 100)}%` }}></div>
                            )}
                            {qualityEvaluation.nota_final > 40 && (
                              <div className="bg-yellow-500" style={{ width: `${Math.min(100, ((20) / qualityEvaluation.nota_final) * 100)}%` }}></div>
                            )}
                            {qualityEvaluation.nota_final > 60 && (
                              <div className="bg-blue-500" style={{ width: `${Math.min(100, ((20) / qualityEvaluation.nota_final) * 100)}%` }}></div>
                            )}
                            {qualityEvaluation.nota_final > 80 && (
                              <div className="bg-purple-500" style={{ width: `${Math.min(100, ((15) / qualityEvaluation.nota_final) * 100)}%` }}></div>
                            )}
                            {qualityEvaluation.nota_final > 95 && (
                              <div className="bg-green-500" style={{ width: `${Math.min(100, ((5) / qualityEvaluation.nota_final) * 100)}%` }}></div>
                            )}
                          </div>
                        </div>

                        {/* Division Lines */}
                        <div className="absolute inset-0 flex">
                          <div className="flex-1" style={{ width: '20%', borderRight: '1px solid rgba(255,255,255,0.1)' }}></div>
                          <div className="flex-1" style={{ width: '20%', borderRight: '1px solid rgba(255,255,255,0.1)' }}></div>
                          <div className="flex-1" style={{ width: '20%', borderRight: '1px solid rgba(255,255,255,0.1)' }}></div>
                          <div className="flex-1" style={{ width: '20%', borderRight: '1px solid rgba(255,255,255,0.1)' }}></div>
                          <div className="flex-1" style={{ width: '15%', borderRight: '1px solid rgba(255,255,255,0.1)' }}></div>
                          <div className="flex-1" style={{ width: '5%' }}></div>
                        </div>
                      </div>

                      {/* Classification Badge */}
                      <div className="flex items-center justify-center">
                        <div className={`px-6 py-2 rounded-full font-semibold text-sm ${
                          qualityEvaluation.nota_final >= 95 ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                          qualityEvaluation.nota_final >= 80 ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                          qualityEvaluation.nota_final >= 60 ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                          qualityEvaluation.nota_final >= 40 ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                          qualityEvaluation.nota_final >= 20 ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                          'bg-red-500/20 text-red-400 border border-red-500/30'
                        }`}>
                          ⭐ {qualityEvaluation.classificacao}
                        </div>
                      </div>
                    </div>

                    {/* Summary */}
                    <div className="bg-gray-800/50 border border-purple-500/20 rounded-xl p-4">
                      <h5 className="font-semibold mb-2">Resumo</h5>
                      <p className="text-sm text-gray-400">{qualityEvaluation.resumo}</p>
                    </div>

                    {/* Pontos Fortes */}
                    {qualityEvaluation.pontos_fortes && qualityEvaluation.pontos_fortes.length > 0 && (
                      <div className="bg-green-900/20 border border-green-500/30 rounded-xl p-4">
                        <h5 className="font-semibold mb-2 flex items-center gap-2">
                          <CheckCircle className="w-5 h-5 text-green-400" />
                          Pontos Fortes
                        </h5>
                        <ul className="space-y-1">
                          {qualityEvaluation.pontos_fortes.map((ponto, index) => (
                            <li key={index} className="text-sm text-gray-300 flex items-start gap-2">
                              <span className="text-green-400 mt-0.5">•</span>
                              <span>{ponto}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Principais Gaps */}
                    {qualityEvaluation.principais_gaps && qualityEvaluation.principais_gaps.length > 0 && (
                      <div className="bg-orange-900/20 border border-orange-500/30 rounded-xl p-4">
                        <h5 className="font-semibold mb-2 flex items-center gap-2">
                          <AlertCircle className="w-5 h-5 text-orange-400" />
                          Principais Gaps
                        </h5>
                        <ul className="space-y-1">
                          {qualityEvaluation.principais_gaps.map((gap, index) => (
                            <li key={index} className="text-sm text-gray-300 flex items-start gap-2">
                              <span className="text-orange-400 mt-0.5">•</span>
                              <span>{gap}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Próxima Ação */}
                    <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-4">
                      <h5 className="font-semibold mb-2">Próxima Ação Recomendada</h5>
                      <p className="text-sm text-gray-300">{qualityEvaluation.proxima_acao}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ConfigHub({ onClose }: ConfigHubProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  // Estados para avaliação de persona
  const [personaEvaluation, setPersonaEvaluation] = useState<{
    qualidade_geral: string
    score_geral: number
    nivel_qualidade_textual: string
    score_detalhado: {
      cargo: number
      tipo_empresa_faturamento: number
      contexto: number
      busca: number
      dores: number
    }
    destaques_positivos: string[]
    spin_readiness: {
      situacao: string
      problema: string
      implicacao: string
      need_payoff: string
      score_spin_total: number
    }
    campos_excelentes: string[]
    campos_que_precisam_ajuste: string[]
    sugestoes_melhora_prioritarias: string[]
    pronto_para_roleplay: boolean
    nivel_complexidade_roleplay: string
    proxima_acao_recomendada: string
    mensagem_motivacional: string
  } | null>(null)
  const [showPersonaEvaluationModal, setShowPersonaEvaluationModal] = useState(false)

  // Estados para avaliação de objeção
  const [objectionEvaluation, setObjectionEvaluation] = useState<any>(null)
  const [showObjectionEvaluationModal, setShowObjectionEvaluationModal] = useState(false)

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Senha temporária: "admin123"
    if (password === 'admin123') {
      setIsAuthenticated(true)
      setError('')
    } else {
      setError('Senha incorreta')
    }
  }

  return (
    <>
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className={`relative max-w-5xl w-full max-h-[90vh] overflow-hidden transition-transform duration-300 ${
        showPersonaEvaluationModal || showObjectionEvaluationModal ? 'sm:-translate-x-[250px]' : ''
      }`}>
        <div className="absolute inset-0 bg-gradient-to-br from-purple-600/20 to-transparent rounded-3xl blur-xl"></div>
        <div className="relative bg-gray-900/95 backdrop-blur-xl rounded-3xl border border-purple-500/30 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-purple-500/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-600/20 rounded-xl flex items-center justify-center">
                <Settings className="w-6 h-6 text-purple-400" />
              </div>
              <h2 className="text-2xl font-bold text-white">Hub de Configuração</h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors text-2xl"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-100px)]">
            {!isAuthenticated ? (
              // Password Form
              <div className="max-w-md mx-auto py-8">
                <div className="text-center mb-8">
                  <div className="w-20 h-20 bg-purple-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Lock className="w-10 h-10 text-purple-400" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">
                    Acesso Administrativo
                  </h3>
                  <p className="text-gray-400">
                    Digite a senha de administrador para continuar
                  </p>
                </div>

                <form onSubmit={handlePasswordSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Senha de Acesso
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-800/50 border border-purple-500/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/40"
                      placeholder="••••••••"
                      autoFocus
                    />
                  </div>

                  {error && (
                    <div className="bg-red-900/20 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full py-3 bg-gradient-to-r from-purple-600 to-purple-500 rounded-xl font-semibold hover:scale-105 transition-transform"
                  >
                    Acessar Configurações
                  </button>
                </form>

                <p className="text-center text-sm text-gray-500 mt-6">
                  Senha temporária: admin123
                </p>
              </div>
            ) : (
              // Configuration Interface
              <ConfigurationInterface
                personaEvaluation={personaEvaluation}
                setPersonaEvaluation={setPersonaEvaluation}
                showPersonaEvaluationModal={showPersonaEvaluationModal}
                setShowPersonaEvaluationModal={setShowPersonaEvaluationModal}
                objectionEvaluation={objectionEvaluation}
                setObjectionEvaluation={setObjectionEvaluation}
                showObjectionEvaluationModal={showObjectionEvaluationModal}
                setShowObjectionEvaluationModal={setShowObjectionEvaluationModal}
              />
            )}
          </div>
        </div>
      </div>
    </div>

    {/* Modal de Avaliação de Persona - Side Panel (fora do ConfigHub) */}
    {showPersonaEvaluationModal && personaEvaluation && (
      <div className="fixed top-0 right-0 h-screen w-full sm:w-[500px] z-[70] p-4">
        <style jsx>{`
          @keyframes slide-in {
            from {
              transform: translateX(100%);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }
          .animate-slide-in {
            animation: slide-in 0.3s ease-out;
          }
        `}</style>
        <div className="relative h-full animate-slide-in">
          <div className="absolute inset-0 bg-gradient-to-br from-green-600/20 to-transparent rounded-3xl blur-xl"></div>
          <div className="relative bg-gray-900/98 backdrop-blur-xl rounded-3xl border border-green-500/30 h-full flex flex-col overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-green-500/20 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-green-600/20 rounded-xl flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Avaliação</h2>
                  <p className="text-xs text-gray-400">{personaEvaluation.mensagem_motivacional}</p>
                </div>
              </div>
              <button
                onClick={() => setShowPersonaEvaluationModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              {/* Score Geral */}
              <div className="bg-gradient-to-br from-green-900/30 to-transparent border border-green-500/30 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-base font-bold text-white mb-0.5">Score Geral</h3>
                    <p className="text-xs text-gray-400 capitalize">{personaEvaluation.qualidade_geral} • {personaEvaluation.nivel_qualidade_textual}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-green-400">{personaEvaluation.score_geral.toFixed(1)}</div>
                    <div className="text-xs text-gray-500">/10</div>
                  </div>
                </div>

                {/* Barra de progresso */}
                <div className="w-full bg-gray-800 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-green-600 to-green-400 h-2 rounded-full transition-all"
                    style={{ width: `${(personaEvaluation.score_geral / 10) * 100}%` }}
                  ></div>
                </div>
              </div>

              {/* Scores Detalhados */}
              <div className="bg-gray-900/50 border border-purple-500/20 rounded-xl p-3">
                <h3 className="text-sm font-bold text-white mb-3">Scores por Campo</h3>
                <div className="space-y-2">
                  {Object.entries(personaEvaluation.score_detalhado).map(([campo, score]) => (
                    <div key={campo}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-300 capitalize">
                          {campo.replace(/_/g, ' ')}
                        </span>
                        <span className="text-xs font-bold text-purple-400">{score}/10</span>
                      </div>
                      <div className="w-full bg-gray-800 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full transition-all ${
                            score >= 9 ? 'bg-green-500' :
                            score >= 7 ? 'bg-blue-500' :
                            score >= 5 ? 'bg-yellow-500' :
                            'bg-orange-500'
                          }`}
                          style={{ width: `${(score / 10) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Destaques Positivos */}
              {personaEvaluation.destaques_positivos.length > 0 && (
                <div className="bg-green-900/20 border border-green-500/30 rounded-xl p-3">
                  <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    Destaques Positivos
                  </h3>
                  <ul className="space-y-1.5">
                    {personaEvaluation.destaques_positivos.map((destaque, idx) => (
                      <li key={idx} className="text-xs text-gray-300 flex items-start gap-1.5">
                        <span className="text-green-400 mt-0.5">•</span>
                        <span>{destaque}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* SPIN Readiness */}
              <div className="bg-gray-900/50 border border-purple-500/20 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-white">Prontidão SPIN</h3>
                  <span className="text-lg font-bold text-purple-400">
                    {personaEvaluation.spin_readiness.score_spin_total}/10
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(personaEvaluation.spin_readiness)
                    .filter(([key]) => key !== 'score_spin_total')
                    .map(([etapa, status]) => (
                      <div key={etapa} className="bg-gray-800/50 rounded-lg p-2">
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-medium text-gray-400 uppercase">
                            {etapa.replace(/_/g, ' ')}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold text-center ${
                            status === 'pronto' ? 'bg-green-500/20 text-green-400' :
                            status === 'precisa_ajuste' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-red-500/20 text-red-400'
                          }`}>
                            {status === 'pronto' ? '✓ Pronto' :
                             status === 'precisa_ajuste' ? '⚠ Ajustar' :
                             '✗ Insuf.'}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Campos Excelentes */}
              {personaEvaluation.campos_excelentes.length > 0 && (
                <div className="bg-purple-900/20 border border-purple-500/30 rounded-xl p-3">
                  <h3 className="text-sm font-bold text-white mb-2">
                    🌟 Excelentes (≥9)
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {personaEvaluation.campos_excelentes.map((campo, idx) => (
                      <span key={idx} className="px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded-full text-[10px]">
                        {campo.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Campos que Precisam Ajuste */}
              {personaEvaluation.campos_que_precisam_ajuste.length > 0 && (
                <div className="bg-orange-900/20 border border-orange-500/30 rounded-xl p-3">
                  <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-orange-400" />
                    Para Ajustar
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {personaEvaluation.campos_que_precisam_ajuste.map((campo, idx) => (
                      <span key={idx} className="px-2 py-0.5 bg-orange-500/20 text-orange-300 rounded-full text-[10px]">
                        {campo.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Sugestões de Melhoria */}
              {personaEvaluation.sugestoes_melhora_prioritarias.length > 0 && (
                <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-3">
                  <h3 className="text-sm font-bold text-white mb-2">
                    💡 Sugestões Prioritárias
                  </h3>
                  <ul className="space-y-1.5">
                    {personaEvaluation.sugestoes_melhora_prioritarias.map((sugestao, idx) => (
                      <li key={idx} className="text-xs text-gray-300 flex items-start gap-1.5">
                        <span className="text-blue-400 mt-0.5 font-bold text-[10px]">{idx + 1}.</span>
                        <span className="leading-tight">{sugestao}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Status e Recomendação */}
              <div className="grid grid-cols-2 gap-2">
                <div className={`rounded-lg p-2.5 border ${
                  personaEvaluation.pronto_para_roleplay
                    ? 'bg-green-900/20 border-green-500/30'
                    : 'bg-yellow-900/20 border-yellow-500/30'
                }`}>
                  <h4 className="text-xs font-semibold mb-1 text-white">Status</h4>
                  <p className={`text-xs font-bold ${
                    personaEvaluation.pronto_para_roleplay ? 'text-green-400' : 'text-yellow-400'
                  }`}>
                    {personaEvaluation.pronto_para_roleplay ? '✓ Pronto' : '⚠ Ajustar'}
                  </p>
                </div>
                <div className="bg-gray-900/50 border border-purple-500/20 rounded-lg p-2.5">
                  <h4 className="text-xs font-semibold mb-1 text-white">Nível</h4>
                  <p className="text-xs text-purple-400 capitalize font-bold">
                    {personaEvaluation.nivel_complexidade_roleplay}
                  </p>
                </div>
              </div>

              {/* Próxima Ação */}
              <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-500/30 rounded-xl p-3">
                <h3 className="text-sm font-bold text-white mb-1.5">🎯 Próxima Ação</h3>
                <p className="text-xs text-gray-300 capitalize leading-tight">
                  {personaEvaluation.proxima_acao_recomendada.replace(/_/g, ' ')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Modal de Avaliação de Objeção - Side Panel (fora do ConfigHub) */}
    {showObjectionEvaluationModal && objectionEvaluation && (
      <div className="fixed top-0 right-0 h-screen w-full sm:w-[500px] z-[70] p-4 bg-gradient-to-br from-green-950/90 via-gray-900/95 to-gray-900/95">
        <div className="h-full bg-gradient-to-b from-green-900/20 to-gray-900/50 border border-green-500/30 rounded-xl shadow-2xl overflow-y-auto animate-slide-in">
          <div className="sticky top-0 bg-gradient-to-b from-green-900/80 to-gray-900/80 backdrop-blur-sm border-b border-green-500/30 p-4 flex items-center justify-between z-10">
            <h3 className="font-bold text-white">Avaliação da Objeção</h3>
            <button
              onClick={() => setShowObjectionEvaluationModal(false)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 space-y-4">
            {/* Score Geral */}
            <div className={`rounded-xl p-4 text-center ${
              objectionEvaluation.status === 'APROVADA' ? 'bg-green-500/20 border border-green-500/30' :
              objectionEvaluation.status === 'REVISAR' ? 'bg-yellow-500/20 border border-yellow-500/30' :
              'bg-red-500/20 border border-red-500/30'
            }`}>
              <div className="text-4xl font-bold text-white mb-2">
                {objectionEvaluation.nota_final?.toFixed(1)}/10
              </div>
              <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                objectionEvaluation.status === 'APROVADA' ? 'bg-green-600/30 text-green-300' :
                objectionEvaluation.status === 'REVISAR' ? 'bg-yellow-600/30 text-yellow-300' :
                'bg-red-600/30 text-red-300'
              }`}>
                {objectionEvaluation.status}
              </div>
            </div>

            {/* Como Melhorar */}
            {objectionEvaluation.como_melhorar?.length > 0 && (
              <div className="bg-gray-800/50 border border-purple-500/20 rounded-xl p-4">
                <h4 className="font-semibold text-purple-400 mb-3 text-sm">
                  💡 Como Melhorar
                </h4>
                <ul className="space-y-2">
                  {objectionEvaluation.como_melhorar.map((sugestao: string, idx: number) => (
                    <li key={idx} className="text-sm text-gray-300 flex items-start">
                      <span className="text-purple-400 mr-2 font-bold">{idx + 1}.</span>
                      <span className="flex-1">{sugestao}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Mensagem de Aprovação */}
            {objectionEvaluation.status === 'APROVADA' && (
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-center">
                <p className="text-green-300 text-sm">
                  ✅ Objeção bem estruturada e pronta para usar no treinamento!
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    )}
  </>
  )
}
