'use client'

import { useState, useRef, useEffect } from 'react'
import { Upload, Image as ImageIcon, Loader2, CheckCircle, AlertCircle, X, FileText, TrendingUp, Building2, Users, MessageSquare, Target, Sparkles, BarChart3 } from 'lucide-react'

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

export default function FollowUpView() {
  const [selectedImages, setSelectedImages] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<FollowUpAnalysis | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [extractedText, setExtractedText] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [companyData, setCompanyData] = useState<any>(null)


  // Context form state
  const [tipoVenda, setTipoVenda] = useState<'B2B' | 'B2C'>('B2B')
  const [contexto, setContexto] = useState<string>('')
  const [canal, setCanal] = useState<string>('WhatsApp')
  const [faseFunil, setFaseFunil] = useState<string>('prospeccao')

  // Carregar dados da empresa ao montar o componente
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

        const { data, error } = await supabase
          .from('company_data')
          .select('*')
          .eq('company_id', companyId)
          .single()

        if (data && !error) {
          setCompanyData(data)
          console.log('✅ Dados da empresa carregados:', data)
        }
      } catch (error) {
        console.error('Erro ao carregar dados da empresa:', error)
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

    // Validate context form
    if (!contexto.trim()) {
      setError('Por favor, descreva o contexto do follow-up')
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

      // Send to API for OCR and analysis with context
      const response = await fetch('/api/followup/analyze', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          images: base64Images, // Agora enviando array de imagens
          filenames: selectedImages.map(img => img.name),
          avaliacao: {
            tipo_venda: tipoVenda,
            contexto: contexto,
            canal: canal,
            fase_funil: faseFunil
          },
          dados_empresa: companyData // Enviando todos os dados da empresa
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
    <div className="flex-1 p-4 md:p-6 overflow-y-auto bg-black min-h-screen">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Análise de Follow-up
          </h1>
          <p className="text-gray-400">
            Preencha o contexto e faça upload de um print para receber feedback detalhado sobre seu follow-up
          </p>
        </div>

        {/* Context Form */}
        {!analysis && (
          <div className="bg-gray-900/60 backdrop-blur-sm rounded-2xl p-6 mb-6 border border-green-500/20 shadow-[0_0_40px_rgba(34,197,94,0.2)]">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-green-500/20 to-green-600/20 rounded-lg flex items-center justify-center border border-green-500/30">
                <Target className="w-4 h-4 text-green-400" />
              </div>
              Contexto do Follow-up
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Tipo de Venda */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-1">
                  <Building2 className="w-4 h-4 text-gray-400" />
                  Tipo de Venda
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setTipoVenda('B2B')}
                    className={`flex-1 py-2 px-4 rounded-lg border transition-all font-medium ${
                      tipoVenda === 'B2B'
                        ? 'bg-gradient-to-r from-green-600 to-lime-500 text-white border-green-500 shadow-lg shadow-green-500/30'
                        : 'bg-gray-800/50 text-gray-400 border-gray-700 hover:border-green-500/50'
                    }`}
                  >
                    B2B
                  </button>
                  <button
                    onClick={() => setTipoVenda('B2C')}
                    className={`flex-1 py-2 px-4 rounded-lg border transition-all font-medium ${
                      tipoVenda === 'B2C'
                        ? 'bg-gradient-to-r from-green-600 to-lime-500 text-white border-green-500 shadow-lg shadow-green-500/30'
                        : 'bg-gray-800/50 text-gray-400 border-gray-700 hover:border-green-500/50'
                    }`}
                  >
                    B2C
                  </button>
                </div>
              </div>

              {/* Canal */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-1">
                  <MessageSquare className="w-4 h-4 text-gray-400" />
                  Canal
                </label>
                <select
                  value={canal}
                  onChange={(e) => setCanal(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-800/50 text-white border border-gray-700 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                >
                  <option value="WhatsApp">WhatsApp</option>
                  <option value="E-mail">E-mail</option>
                  <option value="Telefone">Telefone</option>
                  <option value="SMS">SMS</option>
                  <option value="LinkedIn">LinkedIn</option>
                </select>
              </div>

              {/* Fase do Funil */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-1">
                  <Target className="w-4 h-4 text-gray-400" />
                  Fase do Funil
                </label>
                <select
                  value={faseFunil}
                  onChange={(e) => setFaseFunil(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-800/50 text-white border border-gray-700 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                >
                  <option value="prospeccao">Prospecção</option>
                  <option value="qualificacao">Qualificação</option>
                  <option value="negociacao">Negociação</option>
                  <option value="fechamento">Fechamento</option>
                </select>
              </div>

              {/* Contexto */}
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-1">
                  <Users className="w-4 h-4 text-gray-400" />
                  Contexto do Momento
                  <span className="text-red-400 ml-1">*</span>
                </label>
                <input
                  type="text"
                  value={contexto}
                  onChange={(e) => setContexto(e.target.value)}
                  placeholder="Ex: pós-proposta, cold, pós-demo, retomada"
                  className="w-full px-4 py-2 bg-gray-800/50 text-white placeholder-gray-500 border border-gray-700 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                />
                {contexto.trim() === '' && error?.includes('contexto') && (
                  <p className="text-red-400 text-xs mt-1">Campo obrigatório</p>
                )}
              </div>
            </div>

            <div className="mt-4 p-3 bg-green-900/20 border border-green-500/20 rounded-lg">
              <p className="text-xs text-green-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                <strong>Dica:</strong> Quanto mais detalhado o contexto, mais precisa será a análise do seu follow-up
              </p>
            </div>
          </div>
        )}

        {/* Upload Area */}
        {!analysis && (
          <div className="bg-gray-900/60 backdrop-blur-sm rounded-2xl p-8 mb-6 border border-green-500/20 shadow-[0_0_40px_rgba(34,197,94,0.2)]">
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
                imagePreviews.length > 0
                  ? 'border-green-400 bg-green-900/10'
                  : 'border-gray-700 hover:border-green-500/50 hover:bg-green-900/5'
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple // Permitir múltiplas imagens
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
                          className="w-full h-32 object-cover rounded-lg shadow-lg shadow-green-500/20 border border-green-500/30"
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            removeImage(index)
                          }}
                          className="absolute top-2 right-2 bg-gray-900/80 backdrop-blur-sm rounded-full p-1 hover:bg-gray-800 transition-colors border border-gray-700"
                        >
                          <X className="w-4 h-4 text-gray-300" />
                        </button>
                        <span className="absolute bottom-2 left-2 bg-gray-900/80 backdrop-blur-sm px-2 py-1 rounded text-xs text-gray-300">
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
                      className="mx-auto flex items-center gap-2 px-4 py-2 bg-green-900/20 text-green-400 border border-green-500/30 rounded-lg hover:bg-green-900/30 transition-colors"
                    >
                      <Upload className="w-4 h-4" />
                      Adicionar mais imagens ({imagePreviews.length}/5)
                    </button>
                  )}

                  <p className="text-sm text-gray-400 text-center">
                    {selectedImages.map(img => img.name).join(', ')}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <Upload className="w-12 h-12 mx-auto text-gray-600" />
                  <div>
                    <p className="text-lg font-medium text-gray-300">
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
              <div className="mt-4 p-4 bg-red-900/20 border border-red-500/30 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {imagePreviews.length > 0 && !isAnalyzing && (
              <button
                onClick={handleAnalyze}
                className="mt-6 w-full bg-gradient-to-r from-green-600 to-lime-500 text-white py-3 px-6 rounded-xl font-medium hover:from-green-700 hover:to-lime-600 transition-all transform hover:scale-[1.02] shadow-lg shadow-green-500/30"
              >
                Analisar Follow-up ({imagePreviews.length} {imagePreviews.length === 1 ? 'imagem' : 'imagens'})
              </button>
            )}

            {isAnalyzing && (
              <div className="mt-6 flex items-center justify-center gap-3 text-green-400">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="font-medium">Analisando seu follow-up...</span>
              </div>
            )}
          </div>
        )}

        {/* Analysis Results */}
        {analysis && (
          <div className="space-y-8 animate-fadeIn">
            {/* Overall Score Card - Redesigned */}
            <div className={`relative overflow-hidden rounded-2xl p-6 border ${
              analysis.nota_final >= 8 ? 'bg-gradient-to-br from-green-900/20 to-emerald-900/20 border-green-500/30' :
              analysis.nota_final >= 6 ? 'bg-gradient-to-br from-yellow-900/20 to-amber-900/20 border-yellow-500/30' :
              analysis.nota_final >= 4 ? 'bg-gradient-to-br from-orange-900/20 to-red-900/20 border-orange-500/30' :
              'bg-gradient-to-br from-red-900/20 to-red-950/20 border-red-500/30'
            }`}>
              <div className="relative">
                <div>
                  <p className={`text-xs font-medium mb-2 uppercase tracking-wider ${
                    analysis.nota_final >= 8 ? 'text-green-400/70' :
                    analysis.nota_final >= 6 ? 'text-yellow-400/70' :
                    analysis.nota_final >= 4 ? 'text-orange-400/70' :
                    'text-red-400/70'
                  }`}>Nota Final</p>
                  <div className="flex items-baseline gap-3">
                    <p className={`text-5xl font-bold ${
                      analysis.nota_final >= 8 ? 'text-green-400' :
                      analysis.nota_final >= 6 ? 'text-yellow-400' :
                      analysis.nota_final >= 4 ? 'text-orange-400' :
                      'text-red-400'
                    }`}>{analysis.nota_final.toFixed(1)}</p>
                    <div>
                      <span className={`px-3 py-1 rounded-lg text-xs font-medium ${
                        analysis.nota_final >= 8 ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                        analysis.nota_final >= 6 ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
                        analysis.nota_final >= 4 ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' :
                        'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}>
                        {analysis.classificacao.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Detailed Scores - Redesigned with Green Theme */}
            <div className="group relative bg-gradient-to-br from-green-900/30 to-emerald-900/30 backdrop-blur-sm rounded-3xl p-8 border border-green-500/40 hover:border-green-400/60 transition-all duration-500 hover:shadow-[0_0_40px_rgba(34,197,94,0.2)] overflow-hidden">
              {/* Animated background gradient */}
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

              {/* Animated dots pattern */}
              <div className="absolute inset-0 opacity-5">
                <div className="absolute top-10 left-10 w-3 h-3 bg-green-400 rounded-full animate-ping"></div>
                <div className="absolute bottom-10 right-10 w-3 h-3 bg-emerald-400 rounded-full animate-ping" style={{ animationDelay: '200ms' }}></div>
                <div className="absolute top-20 right-20 w-3 h-3 bg-green-400 rounded-full animate-ping" style={{ animationDelay: '400ms' }}></div>
              </div>

              <div className="relative">
                <div className="flex items-center gap-3 mb-6">
                  <div className="relative">
                    <div className="absolute inset-0 bg-green-500/30 blur-xl animate-pulse"></div>
                    <div className="relative w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-green-500/50">
                      <BarChart3 className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-400">
                      Análise Detalhada
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5">Avaliação critério por critério</p>
                  </div>
                </div>

                <div className="grid gap-4">
                  {Object.entries(analysis.notas).map(([key, value], index) => {
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
                        bg: 'from-green-900/40 to-emerald-900/40',
                        border: 'border-green-500/30 hover:border-green-400/50',
                        text: 'text-green-400',
                        bar: 'from-green-400 to-emerald-500',
                        glow: 'shadow-green-500/20'
                      }
                      if (nota >= 6) return {
                        bg: 'from-yellow-900/40 to-amber-900/40',
                        border: 'border-yellow-500/30 hover:border-yellow-400/50',
                        text: 'text-yellow-400',
                        bar: 'from-yellow-400 to-amber-500',
                        glow: 'shadow-yellow-500/20'
                      }
                      if (nota >= 4) return {
                        bg: 'from-orange-900/40 to-amber-900/40',
                        border: 'border-orange-500/30 hover:border-orange-400/50',
                        text: 'text-orange-400',
                        bar: 'from-orange-400 to-amber-500',
                        glow: 'shadow-orange-500/20'
                      }
                      return {
                        bg: 'from-red-900/40 to-rose-900/40',
                        border: 'border-red-500/30 hover:border-red-400/50',
                        text: 'text-red-400',
                        bar: 'from-red-400 to-rose-500',
                        glow: 'shadow-red-500/20'
                      }
                    }

                    const colors = getColorScheme(value.nota)

                    return (
                      <div
                        key={key}
                        className={`group/item relative bg-gradient-to-br ${colors.bg} rounded-2xl p-5 border ${colors.border} transition-all duration-300 hover:shadow-lg hover:scale-[1.01]`}
                        style={{ animationDelay: `${index * 100}ms` }}
                      >
                        {/* Shine effect on hover */}
                        <div className="absolute inset-0 opacity-0 group-hover/item:opacity-100 transition-opacity duration-500 rounded-2xl overflow-hidden">
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover/item:translate-x-full transition-transform duration-1000" />
                        </div>

                        <div className="relative">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-start gap-3">
                              <div>
                                <span className="font-semibold text-white text-lg">
                                  {fieldLabels[key] || key.replace(/_/g, ' ')}
                                </span>
                                <span className="ml-2 text-xs text-gray-400 bg-gray-800/50 px-2 py-1 rounded-full">
                                  {value.peso}% do peso
                                </span>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className={`text-3xl font-black ${colors.text}`}>
                                {value.nota.toFixed(1)}
                              </span>
                              <p className={`text-xs mt-1 ${colors.text} opacity-70`}>
                                {value.nota >= 8 ? 'Excelente' :
                                 value.nota >= 6 ? 'Bom' :
                                 value.nota >= 4 ? 'Regular' : 'Precisa Melhorar'}
                              </p>
                            </div>
                          </div>

                          <div className="bg-gray-900/40 backdrop-blur-sm rounded-lg p-3 border border-gray-700/50 mb-3">
                            <p className="text-sm text-gray-200 leading-relaxed">{value.comentario}</p>
                          </div>

                          {/* Enhanced Progress bar */}
                          <div className="relative">
                            <div className="bg-gray-900/60 h-3 rounded-full overflow-hidden backdrop-blur-sm">
                              <div
                                className={`h-full rounded-full transition-all duration-1000 ease-out relative overflow-hidden bg-gradient-to-r ${colors.bar}`}
                                style={{
                                  width: `${value.nota * 10}%`,
                                  animation: 'slideIn 1s ease-out'
                                }}
                              >
                                <div className="absolute inset-0 bg-white/30 animate-pulse" />
                              </div>
                            </div>
                            {/* Floating percentage */}
                            <div
                              className="absolute -top-8 transition-all duration-1000 ease-out"
                              style={{ left: `calc(${value.nota * 10}% - 20px)` }}
                            >
                              <div className={`${colors.text} text-xs px-2 py-1 rounded-lg font-bold bg-gray-900/80 border ${colors.border} backdrop-blur-sm`}>
                                {(value.nota * 10).toFixed(0)}%
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Positive Points */}
            {analysis.pontos_positivos.length > 0 && (
              <div className="group relative bg-gradient-to-br from-green-900/30 to-emerald-900/30 backdrop-blur-sm rounded-3xl p-8 border border-green-500/40 hover:border-green-400/60 transition-all duration-500 hover:shadow-[0_0_40px_rgba(34,197,94,0.2)] overflow-hidden">
                {/* Animated background gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                <div className="relative">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="relative">
                      <div className="absolute inset-0 bg-green-500/30 blur-xl animate-pulse"></div>
                      <div className="relative w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-green-500/50">
                        <CheckCircle className="w-6 h-6 text-white" />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-400">
                        Pontos Positivos
                      </h3>
                      <p className="text-xs text-gray-400 mt-0.5">Você acertou nestes aspectos</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {analysis.pontos_positivos.map((ponto, idx) => (
                      <div key={idx} className="group/item flex items-start gap-3 p-3 rounded-xl hover:bg-green-500/10 transition-all duration-300">
                        <div className="mt-1 w-6 h-6 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-lg flex items-center justify-center group-hover/item:scale-110 transition-transform">
                          <span className="text-green-400 text-sm">✓</span>
                        </div>
                        <span className="text-gray-200 flex-1 leading-relaxed">{ponto}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Points to Improve */}
            {analysis.pontos_melhorar.length > 0 && (
              <div className="group relative bg-gradient-to-br from-orange-900/30 to-amber-900/30 backdrop-blur-sm rounded-3xl p-8 border border-orange-500/40 hover:border-orange-400/60 transition-all duration-500 hover:shadow-[0_0_40px_rgba(251,146,60,0.2)] overflow-hidden">
                {/* Animated background gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-amber-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                <div className="relative">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="relative">
                      <div className="absolute inset-0 bg-orange-500/30 blur-xl animate-pulse"></div>
                      <div className="relative w-12 h-12 bg-gradient-to-br from-orange-500 to-amber-600 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/50">
                        <AlertCircle className="w-6 h-6 text-white" />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-400">
                        Pontos para Melhorar
                      </h3>
                      <p className="text-xs text-gray-400 mt-0.5">Oportunidades de desenvolvimento</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {analysis.pontos_melhorar.map((item, idx) => (
                      <div key={idx} className="group/item bg-gradient-to-br from-gray-900/60 to-gray-800/60 rounded-2xl p-5 border border-gray-700 hover:border-orange-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-orange-500/10 hover:scale-[1.02]">
                        <div className="flex items-start gap-3 mb-3">
                          <div className="w-8 h-8 bg-gradient-to-br from-red-500/20 to-orange-500/20 rounded-lg flex items-center justify-center">
                            <span className="text-lg">⚠️</span>
                          </div>
                          <p className="font-semibold text-orange-300 flex-1">
                            {item.problema}
                          </p>
                        </div>
                        <div className="flex items-start gap-3 ml-11">
                          <div className="w-6 h-6 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-md flex items-center justify-center mt-0.5">
                            <span className="text-xs">💡</span>
                          </div>
                          <div>
                            <span className="text-xs font-semibold text-green-400 uppercase tracking-wider">Solução:</span>
                            <p className="text-sm text-gray-200 mt-1 leading-relaxed">{item.como_resolver}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Main Tip */}
            <div className="group relative bg-gradient-to-br from-purple-900/30 to-pink-900/30 backdrop-blur-sm rounded-3xl p-8 border border-purple-500/40 hover:border-purple-400/60 transition-all duration-500 hover:shadow-[0_0_40px_rgba(168,85,247,0.2)] overflow-hidden">
              {/* Animated sparkles effect */}
              <div className="absolute inset-0">
                <div className="absolute top-10 left-10 w-2 h-2 bg-purple-400 rounded-full animate-ping"></div>
                <div className="absolute bottom-10 right-10 w-2 h-2 bg-pink-400 rounded-full animate-ping" style={{ animationDelay: '200ms' }}></div>
                <div className="absolute top-20 right-20 w-2 h-2 bg-purple-400 rounded-full animate-ping" style={{ animationDelay: '400ms' }}></div>
              </div>

              <div className="relative">
                <div className="flex items-center gap-3 mb-6">
                  <div className="relative">
                    <div className="absolute inset-0 bg-purple-500/30 blur-xl animate-pulse"></div>
                    <div className="relative w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/50 animate-bounce">
                      <Sparkles className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
                      Dica Principal
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5">Foque neste insight para melhorar rapidamente</p>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-2xl p-6 border border-purple-500/20">
                  <p className="text-gray-100 leading-relaxed text-lg">{analysis.dica_principal}</p>
                </div>
              </div>
            </div>

            {/* Rewritten Version */}
            <div className="group relative bg-gradient-to-br from-blue-900/30 to-cyan-900/30 backdrop-blur-sm rounded-3xl p-8 border border-blue-500/40 hover:border-blue-400/60 transition-all duration-500 hover:shadow-[0_0_40px_rgba(59,130,246,0.2)] overflow-hidden">
              {/* Animated background pattern */}
              <div className="absolute inset-0 opacity-10">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 bg-[size:20px_20px] bg-repeat"
                     style={{ backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)' }}></div>
              </div>

              <div className="relative">
                <div className="flex items-center gap-3 mb-6">
                  <div className="relative">
                    <div className="absolute inset-0 bg-blue-500/30 blur-xl animate-pulse"></div>
                    <div className="relative w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/50">
                      <FileText className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
                      Versão Melhorada
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5">Exemplo otimizado do seu follow-up</p>
                  </div>
                </div>

                <div className="relative">
                  <div className="absolute -top-2 -left-2 text-6xl text-blue-500/20 font-serif">"</div>
                  <div className="absolute -bottom-2 -right-2 text-6xl text-blue-500/20 font-serif rotate-180">"</div>
                  <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/80 rounded-2xl p-6 border border-blue-500/20 backdrop-blur-sm">
                    <pre className="whitespace-pre-wrap text-gray-100 leading-relaxed font-sans">
                      {analysis.versao_reescrita}
                    </pre>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span>Copie e adapte ao seu estilo</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 mt-8">
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
                className="group flex-1 relative overflow-hidden bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-2xl py-4 px-8 font-bold hover:from-green-700 hover:to-emerald-700 transition-all transform hover:scale-[1.02] shadow-xl shadow-green-500/30"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-green-400/30 to-emerald-400/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <span className="relative flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Fazer Nova Análise
                </span>
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
                className="group px-8 py-4 relative bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-sm text-gray-300 rounded-2xl font-bold hover:from-gray-700/60 hover:to-gray-800/60 hover:text-white transition-all border border-gray-700 hover:border-gray-600 hover:shadow-lg"
              >
                <span className="relative flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Fechar
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}