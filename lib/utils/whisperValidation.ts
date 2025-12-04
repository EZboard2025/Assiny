/**
 * Validação e limpeza de transcrições do Whisper
 * Detecta e corrige problemas comuns de transcrição
 */

/**
 * Detecta se há repetições excessivas na transcrição
 * @param text Texto da transcrição
 * @returns true se houver repetições problemáticas
 */
export function hasRepetitionProblem(text: string): boolean {
  // Detecta repetições de sílabas/palavras curtas (2-4 caracteres)
  const repetitionPattern = /(\b\w{2,4}\b)(\1){4,}/gi

  // Detecta repetições de sequências sem sentido
  const nonsensePattern = /([a-z]{2,5})\1{4,}/gi

  return repetitionPattern.test(text) || nonsensePattern.test(text)
}

/**
 * Limpa repetições excessivas do texto
 * @param text Texto com possíveis repetições
 * @returns Texto limpo
 */
export function cleanRepetitions(text: string): string {
  // Remove repetições de palavras/sílabas curtas
  let cleaned = text.replace(/(\b\w{2,4}\b)(\1){4,}/gi, '$1')

  // Remove repetições de sequências sem sentido
  cleaned = cleaned.replace(/([a-z]{2,5})\1{4,}/gi, '$1')

  // Remove espaços múltiplos
  cleaned = cleaned.replace(/\s+/g, ' ').trim()

  return cleaned
}

/**
 * Valida se a transcrição é válida
 * @param text Texto da transcrição
 * @returns true se a transcrição parecer válida
 */
export function isValidTranscription(text: string): boolean {
  if (!text || text.trim().length === 0) return false

  // Transcrição muito curta provavelmente é ruído
  if (text.trim().length < 3) return false

  // Se mais de 50% do texto é repetição, provavelmente é erro
  const originalLength = text.length
  const cleanedLength = cleanRepetitions(text).length
  if (cleanedLength < originalLength * 0.5) return false

  // Verifica se há palavras reconhecíveis em português (expandido)
  const portugueseWords = /\b(não|sim|eu|você|nós|com|para|que|de|em|um|uma|o|a|os|as|é|são|está|estão|foi|ser|ter|fazer|pode|vai|tem|mais|muito|bem|bom|boa|hoje|agora|depois|antes|aqui|ali|assim|então|mas|e|ou|tudo|cara|oi|olá|tchau|obrigado|por favor|claro|certo|errado|talvez|quando|onde|como|porque|qual|quais|este|esse|aquele|meu|seu|nosso|dela|dele|nome|falar|quero|queria|preciso|posso|ajudar|ajuda)\b/gi
  const matches = text.match(portugueseWords)

  // Para textos curtos (cumprimentos), 1 palavra é suficiente
  // Para textos maiores, precisa de pelo menos 2 palavras
  const minWords = text.length < 20 ? 1 : 2
  return matches ? matches.length >= minWords : false
}

/**
 * Processa e valida transcrição do Whisper
 * @param rawText Texto bruto da transcrição
 * @returns Objeto com texto processado e flags de validação
 */
export function processWhisperTranscription(rawText: string): {
  text: string
  isValid: boolean
  hasRepetition: boolean
  confidence: 'high' | 'medium' | 'low'
} {
  const hasRepetition = hasRepetitionProblem(rawText)
  const cleanedText = hasRepetition ? cleanRepetitions(rawText) : rawText
  const isValid = isValidTranscription(cleanedText)

  let confidence: 'high' | 'medium' | 'low' = 'high'

  if (!isValid) {
    confidence = 'low'
  } else if (hasRepetition) {
    confidence = 'medium'
  }

  return {
    text: cleanedText,
    isValid,
    hasRepetition,
    confidence
  }
}