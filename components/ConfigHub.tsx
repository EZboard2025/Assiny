'use client'

import { useState, useEffect } from 'react'
import { X, Lock, Settings, Building2, Users, Target, Upload, Plus, Trash2, ChevronRight } from 'lucide-react'
import {
  getEmployees,
  addEmployee as addEmployeeDB,
  updateEmployee,
  deleteEmployee,
  getCustomerSegments,
  addCustomerSegment,
  deleteCustomerSegment,
  getCompanyType,
  setCompanyType,
  getObjections,
  addObjection,
  deleteObjection,
  type Employee,
  type CustomerSegment,
  type Objection
} from '@/lib/config'

interface ConfigHubProps {
  onClose: () => void
}

// Component for the main configuration interface
function ConfigurationInterface() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [newEmployeeName, setNewEmployeeName] = useState('')
  const [newEmployeeEmail, setNewEmployeeEmail] = useState('')
  const [newEmployeePassword, setNewEmployeePassword] = useState('')
  const [addingEmployee, setAddingEmployee] = useState(false)
  const [segments, setSegments] = useState<CustomerSegment[]>([])
  const [newSegment, setNewSegment] = useState('')
  const [businessType, setBusinessType] = useState<'B2B' | 'B2C'>('B2C')
  const [objections, setObjections] = useState<Objection[]>([])
  const [newObjection, setNewObjection] = useState('')
  const [feedbackQuality, setFeedbackQuality] = useState('Suficiente')
  const [feedbackItems, setFeedbackItems] = useState({
    videos: true,
    audio: false,
    pdfs: false
  })
  const [loading, setLoading] = useState(true)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([])

  // Carregar dados do Supabase
  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [employeesData, segmentsData, companyTypeData, objectionsData] = await Promise.all([
        getEmployees(),
        getCustomerSegments(),
        getCompanyType(),
        getObjections()
      ])

      setEmployees(employeesData)
      setSegments(segmentsData)
      setBusinessType(companyTypeData)
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

  const handleDeleteEmployee = async (id: string) => {
    const success = await deleteEmployee(id)
    if (success) {
      setEmployees(employees.filter(e => e.id !== id))
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    setUploadingFile(true)

    try {
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('fileName', file.name)
        formData.append('fileType', file.type)

        console.log(`📤 Enviando ${file.name} para N8N...`)

        // Enviar para N8N (só envia, não espera resposta)
        const response = await fetch('https://ezboard.app.n8n.cloud/webhook/43795ad1-2faa-473d-925c-dab2c3227dbb', {
          method: 'POST',
          body: formData,
        })

        if (response.ok) {
          setUploadedFiles([...uploadedFiles, file.name])
          console.log(`✅ Arquivo ${file.name} enviado para processamento!`)
        } else {
          console.error(`❌ Erro ao enviar ${file.name}`)
          alert(`Erro ao enviar arquivo: ${file.name}`)
        }
      }

      alert('Arquivos enviados para processamento! Os embeddings serão criados em alguns instantes.')
    } catch (error) {
      console.error('Erro ao fazer upload:', error)
      alert('Erro ao fazer upload dos arquivos!')
    } finally {
      setUploadingFile(false)
      // Limpar input
      event.target.value = ''
    }
  }

  const handleAddSegment = async () => {
    if (newSegment.trim()) {
      const segment = await addCustomerSegment(newSegment.trim())
      if (segment) {
        setSegments([...segments, segment])
        setNewSegment('')
      }
    }
  }

  const handleRemoveSegment = async (id: string) => {
    const success = await deleteCustomerSegment(id)
    if (success) {
      setSegments(segments.filter(s => s.id !== id))
    }
  }

  const handleSetBusinessType = async (type: 'B2B' | 'B2C') => {
    const success = await setCompanyType(type)
    if (success) {
      setBusinessType(type)
    }
  }

  const handleAddObjection = async () => {
    if (newObjection.trim()) {
      const objection = await addObjection(newObjection.trim())
      if (objection) {
        setObjections([...objections, objection])
        setNewObjection('')
      }
    }
  }

  const handleRemoveObjection = async (id: string) => {
    const success = await deleteObjection(id)
    if (success) {
      setObjections(objections.filter(o => o.id !== id))
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-600">Carregando configurações...</div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Minha Empresa */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">MINHA EMPRESA</h3>

        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-3">GERENCIAR FUNCIONÁRIOS</h4>

          {/* Lista de funcionários existentes */}
          {employees.length > 0 && (
            <div className="mb-4">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-gray-600 border-b">
                    <th className="pb-2">Nome</th>
                    <th className="pb-2">Email</th>
                    <th className="pb-2">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp) => (
                    <tr key={emp.id} className="border-b">
                      <td className="py-2 text-sm">{emp.name}</td>
                      <td className="py-2 text-sm">{emp.email}</td>
                      <td className="py-2">
                        <button
                          onClick={() => handleDeleteEmployee(emp.id)}
                          className="text-red-500 hover:text-red-700"
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

          {/* Formulário para adicionar novo funcionário */}
          {!addingEmployee ? (
            <button
              onClick={() => setAddingEmployee(true)}
              className="mt-4 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Adicionar Novo Funcionário
            </button>
          ) : (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <h5 className="text-sm font-medium text-gray-900 mb-3">Novo Funcionário</h5>
              <div className="space-y-3">
                <input
                  type="text"
                  value={newEmployeeName}
                  onChange={(e) => setNewEmployeeName(e.target.value)}
                  placeholder="Nome completo"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-primary"
                />
                <input
                  type="email"
                  value={newEmployeeEmail}
                  onChange={(e) => setNewEmployeeEmail(e.target.value)}
                  placeholder="Email"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-primary"
                />
                <input
                  type="password"
                  value={newEmployeePassword}
                  onChange={(e) => setNewEmployeePassword(e.target.value)}
                  placeholder="Senha"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-primary"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveEmployee}
                    className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
                  >
                    Salvar
                  </button>
                  <button
                    onClick={() => {
                      setAddingEmployee(false)
                      setNewEmployeeName('')
                      setNewEmployeeEmail('')
                      setNewEmployeePassword('')
                    }}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}
          <p className="text-xs text-gray-500 mt-2">* Protegido por senha que só o gestor sabe</p>
        </div>
      </div>

      {/* Segmentação de Clientes */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">SEGMENTAÇÃO DE CLIENTES</h3>
        <p className="text-sm text-gray-600 mb-4">O gestor escolhe e cadastra os segmentos/nicho da empresa</p>

        <div className="flex flex-wrap gap-2 mb-4">
          {segments.map((segment) => (
            <div key={segment.id} className="flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-full">
              <span className="text-sm">{segment.name}</span>
              <button
                onClick={() => handleRemoveSegment(segment.id)}
                className="text-blue-500 hover:text-blue-700"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={newSegment}
            onChange={(e) => setNewSegment(e.target.value)}
            placeholder="Adicionar novo segmento"
            className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-primary"
            onKeyPress={(e) => e.key === 'Enter' && handleAddSegment()}
          />
          <button
            onClick={handleAddSegment}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-6">
          <h4 className="text-sm font-medium text-gray-900 mb-3">TIPO DE EMPRESA</h4>
          <p className="text-sm text-gray-600 mb-3">O gestor escolhe baseado nas objeções dos clientes da empresa</p>
          <div className="flex gap-4">
            <button
              onClick={() => handleSetBusinessType('B2B')}
              className={`px-6 py-2 rounded-full transition-colors ${
                businessType === 'B2B'
                  ? 'bg-white text-primary border-2 border-primary'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              B2B
            </button>
            <button
              onClick={() => handleSetBusinessType('B2C')}
              className={`px-6 py-2 rounded-full transition-colors ${
                businessType === 'B2C'
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              B2C
            </button>
          </div>
        </div>
      </div>

      {/* Principais Objeções */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">PRINCIPAIS OBJEÇÕES</h3>
        <p className="text-sm text-gray-600 mb-4">Selecione tipo objeção de vendas da sua empresa</p>

        <div className="flex flex-wrap gap-2 mb-4">
          {objections.map((objection) => (
            <div key={objection.id} className="flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-full">
              <X className="w-3 h-3 text-gray-500" />
              <span className="text-sm text-gray-700">{objection.name}</span>
              <button
                onClick={() => handleRemoveObjection(objection.id)}
                className="ml-1 text-gray-500 hover:text-gray-700"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={newObjection}
            onChange={(e) => setNewObjection(e.target.value)}
            placeholder="Adicionar nova objeção"
            className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-primary"
            onKeyPress={(e) => e.key === 'Enter' && handleAddObjection()}
          />
          <button
            onClick={handleAddObjection}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 text-sm text-gray-600">
          <p>Analisadas em vendas: <span className="font-medium">Atendimento abordado</span></p>
          <select className="mt-2 px-3 py-1 border border-gray-200 rounded-lg">
            <option>Setembro</option>
            <option>Outubro</option>
            <option>Novembro</option>
          </select>
        </div>
      </div>

      {/* Gerenciar Arquivos */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">GERENCIAR ARQUIVOS</h3>

        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
          <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-2">
            {uploadingFile ? 'Enviando arquivos...' : 'Selecione os arquivos para upload'}
          </p>
          <p className="text-sm text-gray-500 mb-4">
            (PDF, vídeo, áudio e texto)
          </p>
          <input
            type="file"
            id="fileUpload"
            multiple
            accept=".pdf,.mp4,.mp3,.wav,.m4a,.txt,.doc,.docx"
            onChange={handleFileUpload}
            disabled={uploadingFile}
            className="hidden"
          />
          <label
            htmlFor="fileUpload"
            className={`inline-block px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors cursor-pointer ${uploadingFile ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {uploadingFile ? 'ENVIANDO...' : 'SELECIONAR ARQUIVOS'}
          </label>
        </div>

        {uploadedFiles.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-medium text-gray-900 mb-2">Arquivos enviados:</h4>
            <ul className="space-y-1">
              {uploadedFiles.map((fileName, index) => (
                <li key={index} className="text-sm text-green-600">✓ {fileName}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-600">Qualidade dos arquivos</span>
            <span className="text-sm font-medium">{feedbackQuality}</span>
          </div>
          <div className="relative h-4 bg-gray-200 rounded-full overflow-hidden">
            <div className="absolute inset-0 flex">
              <div className="w-1/5 bg-red-400"></div>
              <div className="w-1/5 bg-orange-400"></div>
              <div className="w-1/5 bg-yellow-400"></div>
              <div className="w-1/5 bg-green-400"></div>
              <div className="w-1/5 bg-blue-600"></div>
            </div>
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-600">
            <span>Insuficiente</span>
            <span>Ruim</span>
            <span>Ok</span>
            <span>Suficiente</span>
            <span>Ótimo</span>
            <span>Perfeito</span>
          </div>
        </div>

        <div className="mt-6">
          <h4 className="text-sm font-medium text-gray-900 mb-3">FEEDBACK DE QUALIDADE DOS AGENTES</h4>
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={feedbackItems.videos}
                onChange={(e) => setFeedbackItems({...feedbackItems, videos: e.target.checked})}
                className="w-4 h-4 text-primary rounded"
              />
              <span className="text-sm text-gray-700">Os vídeos estão bons</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={feedbackItems.audio}
                onChange={(e) => setFeedbackItems({...feedbackItems, audio: e.target.checked})}
                className="w-4 h-4 text-primary rounded"
              />
              <span className="text-sm text-gray-700">Arquivos de áudio podem delatar o Roleplay mais preciso</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={feedbackItems.pdfs}
                onChange={(e) => setFeedbackItems({...feedbackItems, pdfs: e.target.checked})}
                className="w-4 h-4 text-primary rounded"
              />
              <span className="text-sm text-gray-700">PDFS precisam ser mais completos</span>
            </label>
          </div>

          <div className="flex gap-2 mt-4">
            <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Adicionar
            </button>
            <button className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors">
              Nova Sugestão
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ConfigHub({ onClose }: ConfigHubProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Settings className="w-6 h-6 text-primary" />
            <h2 className="text-2xl font-bold text-gray-900">Centro de Gerenciamento</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          {!isAuthenticated ? (
            // Password Form
            <div className="max-w-md mx-auto">
              <div className="text-center mb-8">
                <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Lock className="w-10 h-10 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Acesso Administrativo
                </h3>
                <p className="text-gray-600">
                  Digite a senha de administrador para continuar
                </p>
              </div>

              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Senha de Acesso
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-primary transition-colors"
                    placeholder="••••••••"
                    autoFocus
                  />
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-3 text-white btn-gradient rounded-lg font-semibold hover:scale-105 transition-transform"
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
            <ConfigurationInterface />
          )}
        </div>
      </div>
    </div>
  )
}