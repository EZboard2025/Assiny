'use client'

import { useState, useRef } from 'react'
import { Upload, Image as ImageIcon, Loader2, CheckCircle, AlertCircle, X, FileText, TrendingUp, Building2, Users, MessageSquare, Target, Sparkles } from 'lucide-react'

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


  // Context form state
  const [tipoVenda, setTipoVenda] = useState<'B2B' | 'B2C'>('B2B')
  const [contexto, setContexto] = useState<string>('')
  const [canal, setCanal] = useState<string>('WhatsApp')
  const [faseFunil, setFaseFunil] = useState<string>('prospeccao')


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
          }
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
          <div className="space-y-6 animate-fadeIn">
            {/* Overall Score Card */}
            <div className="bg-gradient-to-r from-green-600 to-lime-500 rounded-2xl p-6 text-white shadow-2xl shadow-green-500/30">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm mb-1">Nota Final</p>
                  <p className="text-5xl font-bold">{analysis.nota_final.toFixed(1)}</p>
                  <div className={`inline-block mt-2 px-3 py-1 rounded-full text-sm font-medium ${getClassificationColor(analysis.classificacao)}`}>
                    {analysis.classificacao.toUpperCase()}
                  </div>
                </div>
                <TrendingUp className="w-16 h-16 text-green-200" />
              </div>
            </div>

            {/* Detailed Scores */}
            <div className="bg-gray-900/60 backdrop-blur-sm rounded-2xl p-6 border border-green-500/20 shadow-[0_0_40px_rgba(34,197,94,0.2)]">
              <h3 className="text-lg font-semibold text-white mb-4">Análise Detalhada</h3>
              <div className="space-y-4">
                {Object.entries(analysis.notas).map(([key, value]) => {
                  // Better formatted labels for each field
                  const fieldLabels: Record<string, string> = {
                    'valor_agregado': 'Agregação de Valor',
                    'personalizacao': 'Personalização',
                    'tom_consultivo': 'Tom Consultivo',
                    'objetividade': 'Objetividade',
                    'cta': 'Call to Action (CTA)',
                    'timing': 'Timing'
                  }

                  return (
                    <div key={key} className="border-b border-gray-800 pb-4 last:border-0">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-300">
                            {fieldLabels[key] || key.replace(/_/g, ' ')}
                          </span>
                          <span className="text-xs text-gray-500">
                            ({value.peso}%)
                          </span>
                        </div>
                        <span className={`text-lg font-bold ${
                          value.nota >= 8 ? 'text-green-400' :
                          value.nota >= 6 ? 'text-yellow-400' :
                          value.nota >= 4 ? 'text-orange-400' :
                          'text-red-400'
                        }`}>
                          {value.nota.toFixed(1)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-400">{value.comentario}</p>
                      <div className="mt-2 bg-gray-800 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            value.nota >= 8 ? 'bg-gradient-to-r from-green-500 to-green-400' :
                            value.nota >= 6 ? 'bg-gradient-to-r from-yellow-500 to-yellow-400' :
                            value.nota >= 4 ? 'bg-gradient-to-r from-orange-500 to-orange-400' :
                            'bg-gradient-to-r from-red-500 to-red-400'
                          }`}
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
              <div className="bg-green-900/20 border border-green-500/30 rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-gradient-to-br from-green-500/20 to-green-600/20 rounded-lg flex items-center justify-center border border-green-500/30">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-green-400">Pontos Positivos</h3>
                </div>
                <ul className="space-y-2">
                  {analysis.pontos_positivos.map((ponto, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-green-400 mt-1">•</span>
                      <span className="text-gray-300">{ponto}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Points to Improve */}
            {analysis.pontos_melhorar.length > 0 && (
              <div className="bg-orange-900/20 border border-orange-500/30 rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-gradient-to-br from-orange-500/20 to-orange-600/20 rounded-lg flex items-center justify-center border border-orange-500/30">
                    <AlertCircle className="w-4 h-4 text-orange-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-orange-400">Pontos para Melhorar</h3>
                </div>
                <div className="space-y-4">
                  {analysis.pontos_melhorar.map((item, idx) => (
                    <div key={idx} className="bg-gray-900/50 rounded-lg p-4 border border-gray-800">
                      <p className="font-medium text-orange-400 mb-2">
                        ❌ {item.problema}
                      </p>
                      <p className="text-sm text-gray-300">
                        ✅ <span className="font-medium text-green-400">Como resolver:</span> {item.como_resolver}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Main Tip */}
            <div className="bg-green-900/20 border border-green-500/30 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-green-500/20 to-green-600/20 rounded-lg flex items-center justify-center border border-green-500/30">
                  <Sparkles className="w-4 h-4 text-green-400" />
                </div>
                <h3 className="text-lg font-semibold text-green-400">Dica Principal</h3>
              </div>
              <p className="text-gray-300">{analysis.dica_principal}</p>
            </div>

            {/* Rewritten Version */}
            <div className="bg-blue-900/20 border border-blue-500/30 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500/20 to-blue-600/20 rounded-lg flex items-center justify-center border border-blue-500/30">
                  <FileText className="w-4 h-4 text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold text-blue-400">Versão Melhorada</h3>
              </div>
              <div className="bg-gray-900/50 rounded-lg p-4 whitespace-pre-wrap text-gray-300 border border-gray-800">
                {analysis.versao_reescrita}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
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
                className="flex-1 bg-gradient-to-r from-green-600 to-lime-500 text-white rounded-xl py-3 px-6 font-medium hover:from-green-700 hover:to-lime-600 transition-all transform hover:scale-[1.02] shadow-lg shadow-green-500/30"
              >
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
                className="px-6 py-3 bg-gray-800/50 backdrop-blur-sm text-white rounded-xl font-medium hover:bg-gray-700/50 transition-colors border border-gray-600"
              >
                Fechar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}