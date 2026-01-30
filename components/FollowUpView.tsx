'use client'

import { useState, useRef, useEffect } from 'react'
import { Upload, Image as ImageIcon, Loader2, CheckCircle, AlertCircle, X, FileText, TrendingUp, Building2, Users, MessageSquare, Target, Lightbulb, BarChart3 } from 'lucide-react'

interface FollowUpAnalysis {
  notas: {
    valor_agregado: {
      nota: number
      peso: number
      comentario: string
    }
    personalizacao: {
      nota: number
      peso: number
      comentario: string
    }
    tom_consultivo: {
      nota: number
      peso: number
      comentario: string
    }
    objetividade: {
      nota: number
      peso: number
      comentario: string
    }
    cta: {
      nota: number
      peso: number
      comentario: string
    }
    timing: {
      nota: number
      peso: number
      comentario: string
    }
  }
  nota_final: number
  classificacao: string
  pontos_positivos: string[]
  pontos_melhorar: Array<{
    problema: string
    como_resolver: string
  }>
  versao_reescrita: string
  dica_principal: string
}

interface FunnelStage {
  id: string
  company_id: string
  stage_name: string
  description: string
  objective: string | null
  stage_order: number
  created_at: string
  updated_at: string
}

export default function FollowUpView() {
  const [selectedImages, setSelectedImages] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<FollowUpAnalysis | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [extractedText, setExtractedText] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [companyData, setCompanyData] = useState<any>(null)
  const [funnelStages, setFunnelStages] = useState<FunnelStage[]>([])

  // Context form state
  const [tipoVenda, setTipoVenda] = useState<'B2B' | 'B2C'>('B2B')
  const [canal, setCanal] = useState<string>('WhatsApp')
  const [faseFunil, setFaseFunil] = useState<string>('')

  // Carregar dados da empresa e fases do funil ao montar o componente
  useEffect(() => {
    const loadCompanyData = async () => {
      try {
        const { supabase } = await import('@/lib/supabase')
        const { getCompanyId } = await import('@/lib/utils/getCompanyFromSubdomain')

        // Buscar company_id (prioriza subdomínio, depois usuário)
        const companyId = await getCompanyId()
        if (!companyId) {
          console.warn('⚠️ company_id não encontrado')
          return
        }

        // Carregar dados da empresa
        const { data, error } = await supabase
          .from('company_data')
          .select('*')
          .eq('company_id', companyId)
          .single()

        if (data && !error) {
          setCompanyData(data)
          console.log('✅ Dados da empresa carregados:', data)
        }

        // Carregar fases do funil
        const { data: stagesData, error: stagesError } = await supabase
          .from('funnel_stages')
          .select('*')
          .eq('company_id', companyId)
          .order('stage_order', { ascending: true })

        if (stagesData && !stagesError) {
          setFunnelStages(stagesData)
          // Selecionar a primeira fase como padrão
          if (stagesData.length > 0) {
            setFaseFunil(stagesData[0].id)
          }
          console.log('✅ Fases do funil carregadas:', stagesData)
        } else if (stagesError) {
          console.warn('⚠️ Erro ao carregar fases do funil:', stagesError)
        }
      } catch (error) {
        console.error('Erro ao carregar dados:', error)
      }
    }

    loadCompanyData()
  }, [])


  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])

    if (files.length === 0) return

    // Verificar limite de 5 imagens
    if (selectedImages.length + files.length > 5) {
      setError('Você pode adicionar no máximo 5 imagens')
      return
    }

    // Verificar tamanho de cada arquivo
    const oversizedFiles = files.filter(file => file.size > 10 * 1024 * 1024)
    if (oversizedFiles.length > 0) {
      setError('Cada imagem deve ter no máximo 10MB')
      return
    }

    setError(null)
    setAnalysis(null)

    // Adicionar novos arquivos
    const newImages = [...selectedImages, ...files]
    setSelectedImages(newImages)

    // Criar previews para todas as imagens
    files.forEach(file => {
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreviews(prev => [...prev, reader.result as string])
      }
      reader.readAsDataURL(file)
    })
  }

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index))
    setImagePreviews(prev => prev.filter((_, i) => i !== index))
    setError(null)
  }

  const handleAnalyze = async () => {
    if (selectedImages.length === 0) {
      setError('Por favor, adicione pelo menos uma imagem')
      return
    }

    setIsAnalyzing(true)
    setError(null)

    try {
      // Convert all images to base64
      const base64Images = await Promise.all(
        selectedImages.map(image =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result as string)
            reader.onerror = reject
            reader.readAsDataURL(image)
          })
        )
      )

      // Obter o token de autenticação se disponível
      const { supabase } = await import('@/lib/supabase')
      const { data: { session } } = await supabase.auth.getSession()

      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      }

      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }

      // Formatar fases do funil para N8N com todos os 3 campos
      const funnelFormatted = funnelStages
        .map((stage, index) => {
          const parts = [`Fase ${index + 1}: ${stage.stage_name}`]
          if (stage.description) {
            parts.push(`Descrição: ${stage.description}`)
          }
          if (stage.objective) {
            parts.push(`Objetivo: ${stage.objective}`)
          }
          return parts.join(' | ')
        })
        .join(' || ')

      // Encontrar fase atual do lead
      const currentStageIndex = funnelStages.findIndex(s => s.id === faseFunil)
      const currentStage = funnelStages[currentStageIndex]
      const leadStage = currentStage
        ? `Fase ${currentStageIndex + 1}: ${currentStage.stage_name}`
        : 'Não definida'

      // Send to API for OCR and analysis with context
      const response = await fetch('/api/followup/analyze', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          images: base64Images, // Agora enviando array de imagens
          filenames: selectedImages.map(img => img.name),
          avaliacao: {
            tipo_venda: tipoVenda,
            canal: canal,
            fase_funil: faseFunil
          },
          dados_empresa: companyData, // Enviando todos os dados da empresa
          funil: funnelFormatted, // String formatada: "Fase 1: xxx, Fase 2: xxx, etc"
          fase_do_lead: leadStage // String: "Fase X: Nome da Fase"
        })
      })

      const data = await response.json()

      if (!response.ok) {
        console.error('Erro na API:', data)
        const errorMessage = data.details || data.error || 'Erro ao analisar follow-up'
        const suggestion = data.suggestion || ''
        throw new Error(`${errorMessage}${suggestion ? '\n\n' + suggestion : ''}`)
      }

      setExtractedText(data.extractedText)
      setAnalysis(data.analysis)

    } catch (err) {
      console.error('Erro na análise:', err)
      setError(err instanceof Error ? err.message : 'Erro ao analisar o follow-up')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const getClassificationColor = (classification: string) => {
    const colors: Record<string, string> = {
      'pessimo': 'text-red-600 bg-red-50',
      'ruim': 'text-orange-600 bg-orange-50',
      'medio': 'text-yellow-600 bg-yellow-50',
      'bom': 'text-green-600 bg-green-50',
      'excelente': 'text-purple-600 bg-purple-50'
    }
    return colors[classification] || 'text-gray-600 bg-gray-50'
  }

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-600'
    if (score >= 6) return 'text-yellow-600'
    if (score >= 4) return 'text-orange-600'
    return 'text-red-600'
  }

  return (
    <div className="flex-1 p-4 md:p-6 overflow-y-auto min-h-screen">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center">
              <Upload className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Análise de Follow-up</h1>
              <p className="text-gray-500 text-sm">Preencha o contexto e faça upload de um print para receber feedback detalhado</p>
            </div>
          </div>
        </div>

        {/* Context Form */}
        {!analysis && (
          <div className="bg-white rounded-2xl p-6 mb-6 border border-gray-200 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center">
                <Target className="w-4 h-4 text-green-600" />
              </div>
              Contexto do Follow-up
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Tipo de Venda */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                  <Building2 className="w-4 h-4 text-gray-500" />
                  Tipo de Venda
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setTipoVenda('B2B')}
                    className={`flex-1 py-2 px-4 rounded-lg border transition-all font-medium ${
                      tipoVenda === 'B2B'
                        ? 'bg-green-500 text-white border-green-500 shadow-sm'
                        : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
                    }`}
                  >
                    B2B
                  </button>
                  <button
                    onClick={() => setTipoVenda('B2C')}
                    className={`flex-1 py-2 px-4 rounded-lg border transition-all font-medium ${
                      tipoVenda === 'B2C'
                        ? 'bg-green-500 text-white border-green-500 shadow-sm'
                        : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
                    }`}
                  >
                    B2C
                  </button>
                </div>
              </div>

              {/* Canal */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                  <MessageSquare className="w-4 h-4 text-gray-500" />
                  Canal
                </label>
                <select
                  value={canal}
                  onChange={(e) => setCanal(e.target.value)}
                  className="w-full px-4 py-2 bg-white text-gray-900 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                >
                  <option value="WhatsApp">WhatsApp</option>
                  <option value="E-mail">E-mail</option>
                  <option value="Telefone">Telefone</option>
                  <option value="SMS">SMS</option>
                  <option value="LinkedIn">LinkedIn</option>
                </select>
              </div>

              {/* Fase do Funil */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                  <Target className="w-4 h-4 text-gray-500" />
                  Fase do Funil
                </label>
                <select
                  value={faseFunil}
                  onChange={(e) => setFaseFunil(e.target.value)}
                  className="w-full px-4 py-2 bg-white text-gray-900 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                >
                  {funnelStages.length === 0 ? (
                    <option value="">Configure as fases no Config Hub</option>
                  ) : (
                    funnelStages.map((stage) => (
                      <option key={stage.id} value={stage.id}>
                        {stage.stage_name}
                      </option>
                    ))
                  )}
                </select>
                {funnelStages.length === 0 && (
                  <p className="text-xs text-yellow-600 mt-1">
                    Nenhuma fase cadastrada. Configure no Config Hub primeiro.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Upload Area */}
        {!analysis && (
          <div className="bg-white rounded-2xl p-6 mb-6 border border-gray-200 shadow-sm">
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
                imagePreviews.length > 0
                  ? 'border-green-400 bg-green-50'
                  : 'border-gray-300 bg-gray-50 hover:border-green-400 hover:bg-green-50'
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageSelect}
                className="hidden"
              />

              {imagePreviews.length > 0 ? (
                <div className="space-y-4">
                  {/* Grid de imagens */}
                  <div className={`grid gap-4 ${
                    imagePreviews.length === 1 ? 'grid-cols-1' :
                    imagePreviews.length === 2 ? 'grid-cols-2' :
                    'grid-cols-3'
                  }`}>
                    {imagePreviews.map((preview, index) => (
                      <div key={index} className="relative">
                        <img
                          src={preview}
                          alt={`Preview ${index + 1}`}
                          className="w-full h-32 object-cover rounded-lg shadow-sm border border-green-200"
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            removeImage(index)
                          }}
                          className="absolute top-2 right-2 bg-white rounded-full p-1 hover:bg-gray-100 transition-colors border border-gray-200 shadow-sm"
                        >
                          <X className="w-4 h-4 text-gray-600" />
                        </button>
                        <span className="absolute bottom-2 left-2 bg-white px-2 py-1 rounded text-xs text-gray-600 shadow-sm">
                          {index + 1}/{imagePreviews.length}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Botão para adicionar mais imagens */}
                  {imagePreviews.length < 5 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        fileInputRef.current?.click()
                      }}
                      className="mx-auto flex items-center gap-2 px-4 py-2 bg-green-50 text-green-600 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
                    >
                      <Upload className="w-4 h-4" />
                      Adicionar mais imagens ({imagePreviews.length}/5)
                    </button>
                  )}

                  <p className="text-sm text-gray-500 text-center">
                    {selectedImages.map(img => img.name).join(', ')}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <Upload className="w-12 h-12 mx-auto text-gray-400" />
                  <div>
                    <p className="text-lg font-medium text-gray-700">
                      Clique ou arraste para fazer upload
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      PNG, JPG, JPEG até 10MB (máximo 5 imagens)
                    </p>
                  </div>
                </div>
              )}
            </div>

            {error && !error.includes('contexto') && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {imagePreviews.length > 0 && !isAnalyzing && (
              <button
                onClick={handleAnalyze}
                className="mt-6 w-full bg-green-500 hover:bg-green-600 text-white py-3 px-6 rounded-xl font-medium transition-all shadow-sm"
              >
                Analisar Follow-up ({imagePreviews.length} {imagePreviews.length === 1 ? 'imagem' : 'imagens'})
              </button>
            )}

            {isAnalyzing && (
              <div className="mt-6 flex items-center justify-center gap-3 text-green-600">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="font-medium">Analisando seu follow-up...</span>
              </div>
            )}
          </div>
        )}

        {/* Analysis Results */}
        {analysis && (
          <div className="space-y-6">
            {/* Overall Score Card */}
            <div className={`rounded-2xl p-6 border ${
              analysis.nota_final >= 8 ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200' :
              analysis.nota_final >= 6 ? 'bg-gradient-to-br from-yellow-50 to-amber-50 border-yellow-200' :
              analysis.nota_final >= 4 ? 'bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200' :
              'bg-gradient-to-br from-red-50 to-rose-50 border-red-200'
            }`}>
              <div>
                <p className={`text-xs font-medium mb-2 uppercase tracking-wider ${
                  analysis.nota_final >= 8 ? 'text-green-600' :
                  analysis.nota_final >= 6 ? 'text-yellow-600' :
                  analysis.nota_final >= 4 ? 'text-orange-600' :
                  'text-red-600'
                }`}>Nota Final</p>
                <div className="flex items-baseline gap-3">
                  <p className={`text-5xl font-bold ${
                    analysis.nota_final >= 8 ? 'text-green-600' :
                    analysis.nota_final >= 6 ? 'text-yellow-600' :
                    analysis.nota_final >= 4 ? 'text-orange-600' :
                    'text-red-600'
                  }`}>{analysis.nota_final.toFixed(1)}</p>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    analysis.nota_final >= 8 ? 'bg-green-100 text-green-700' :
                    analysis.nota_final >= 6 ? 'bg-yellow-100 text-yellow-700' :
                    analysis.nota_final >= 4 ? 'bg-orange-100 text-orange-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {analysis.classificacao.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>

            {/* Detailed Scores */}
            <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Análise Detalhada</h3>
                  <p className="text-xs text-gray-500">Avaliação critério por critério</p>
                </div>
              </div>

              <div className="grid gap-4">
                {Object.entries(analysis.notas).map(([key, value]) => {
                  const fieldLabels: Record<string, string> = {
                    'valor_agregado': 'Agregação de Valor',
                    'personalizacao': 'Personalização',
                    'tom_consultivo': 'Tom Consultivo',
                    'objetividade': 'Objetividade',
                    'cta': 'Call to Action (CTA)',
                    'timing': 'Timing'
                  }

                  const getColorScheme = (nota: number) => {
                    if (nota >= 8) return {
                      bg: 'bg-green-50',
                      border: 'border-green-100',
                      text: 'text-green-600',
                      bar: 'bg-green-500',
                      badge: 'bg-green-100 text-green-700'
                    }
                    if (nota >= 6) return {
                      bg: 'bg-yellow-50',
                      border: 'border-yellow-100',
                      text: 'text-yellow-600',
                      bar: 'bg-yellow-500',
                      badge: 'bg-yellow-100 text-yellow-700'
                    }
                    if (nota >= 4) return {
                      bg: 'bg-orange-50',
                      border: 'border-orange-100',
                      text: 'text-orange-600',
                      bar: 'bg-orange-500',
                      badge: 'bg-orange-100 text-orange-700'
                    }
                    return {
                      bg: 'bg-red-50',
                      border: 'border-red-100',
                      text: 'text-red-600',
                      bar: 'bg-red-500',
                      badge: 'bg-red-100 text-red-700'
                    }
                  }

                  const colors = getColorScheme(value.nota)

                  return (
                    <div
                      key={key}
                      className={`${colors.bg} rounded-xl p-4 border ${colors.border}`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <span className="font-medium text-gray-900">
                            {fieldLabels[key] || key.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className={`text-2xl font-bold ${colors.text}`}>
                            {value.nota.toFixed(1)}
                          </span>
                          <p className={`text-xs mt-1 px-2 py-0.5 rounded-full inline-block ${colors.badge}`}>
                            {value.nota >= 8 ? 'Excelente' :
                             value.nota >= 6 ? 'Bom' :
                             value.nota >= 4 ? 'Regular' : 'Precisa Melhorar'}
                          </p>
                        </div>
                      </div>

                      <div className="bg-white rounded-lg p-3 border border-gray-100 mb-3">
                        <p className="text-sm text-gray-700 leading-relaxed">{value.comentario}</p>
                      </div>

                      {/* Progress bar */}
                      <div className="bg-gray-200 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${colors.bar}`}
                          style={{ width: `${value.nota * 10}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Positive Points */}
            {analysis.pontos_positivos.length > 0 && (
              <div className="bg-green-50 rounded-2xl p-6 border border-green-100">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-green-700">Pontos Positivos</h3>
                    <p className="text-xs text-green-600">Você acertou nestes aspectos</p>
                  </div>
                </div>

                <div className="space-y-2">
                  {analysis.pontos_positivos.map((ponto, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-3 bg-white rounded-lg border border-green-100">
                      <div className="mt-0.5 w-5 h-5 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <CheckCircle className="w-3 h-3 text-green-600" />
                      </div>
                      <span className="text-gray-700 flex-1 leading-relaxed text-sm">{ponto}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Points to Improve */}
            {analysis.pontos_melhorar.length > 0 && (
              <div className="bg-orange-50 rounded-2xl p-6 border border-orange-100">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                    <AlertCircle className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-orange-700">Pontos para Melhorar</h3>
                    <p className="text-xs text-orange-600">Oportunidades de desenvolvimento</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {analysis.pontos_melhorar.map((item, idx) => (
                    <div key={idx} className="bg-white rounded-xl p-4 border border-orange-100">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-6 h-6 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                          <AlertCircle className="w-3.5 h-3.5 text-orange-600" />
                        </div>
                        <p className="font-medium text-gray-900 flex-1">
                          {item.problema}
                        </p>
                      </div>
                      <div className="flex items-start gap-3 ml-9">
                        <div className="w-5 h-5 bg-green-100 rounded-md flex items-center justify-center mt-0.5 flex-shrink-0">
                          <Lightbulb className="w-3 h-3 text-green-600" />
                        </div>
                        <div>
                          <span className="text-xs font-semibold text-green-600 uppercase tracking-wider">Solução:</span>
                          <p className="text-sm text-gray-700 mt-1 leading-relaxed">{item.como_resolver}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Main Tip */}
            <div className="bg-purple-50 rounded-2xl p-6 border border-purple-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                  <Lightbulb className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-purple-700">Dica Principal</h3>
                  <p className="text-xs text-purple-600">Foque neste insight para melhorar rapidamente</p>
                </div>
              </div>

              <div className="bg-white rounded-xl p-4 border border-purple-100">
                <p className="text-gray-700 leading-relaxed">{analysis.dica_principal}</p>
              </div>
            </div>

            {/* Rewritten Version */}
            <div className="bg-blue-50 rounded-2xl p-6 border border-blue-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-blue-700">Versão Melhorada</h3>
                  <p className="text-xs text-blue-600">Exemplo otimizado do seu follow-up</p>
                </div>
              </div>

              <div className="bg-white rounded-xl p-4 border border-blue-100">
                <pre className="whitespace-pre-wrap text-gray-700 leading-relaxed font-sans text-sm">
                  {analysis.versao_reescrita}
                </pre>
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Copie e adapte ao seu estilo</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 mt-6">
              <button
                onClick={() => {
                  setAnalysis(null)
                  setSelectedImages([])
                  setImagePreviews([])
                  setExtractedText(null)
                  setError(null)
                  // Reset form but keep previous context values for convenience
                  // User can change if needed
                }}
                className="flex-1 bg-green-500 hover:bg-green-600 text-white rounded-xl py-3 px-6 font-medium transition-colors shadow-sm flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Fazer Nova Análise
              </button>

              <button
                onClick={() => {
                  // Simply clear the analysis to return to form
                  setAnalysis(null)
                  setSelectedImages([])
                  setImagePreviews([])
                  setExtractedText(null)
                  setError(null)
                }}
                className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors border border-gray-200 flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Fechar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}