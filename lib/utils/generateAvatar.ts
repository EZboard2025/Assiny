/**
 * Utilitário para geração de avatares de personas usando DALL-E 3
 * Gera headshots corporativos profissionais hiper-realistas
 */

export interface PersonaBase {
  id?: string
  business_type: 'B2B' | 'B2C'
  job_title?: string
  cargo?: string
  profession?: string
  profissao?: string
}

interface GenerateAvatarResponse {
  success: boolean
  imageUrl?: string
  error?: string
}

/**
 * Gera avatar usando DALL-E 3 via API interna
 * Retorna URL temporária da imagem (expira em ~1 hora)
 */
export async function generateAvatarWithAI(
  persona: PersonaBase,
  age: number,
  temperament: string
): Promise<string | null> {
  try {
    const response = await fetch('/api/avatar/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personaId: persona.id,
        cargo: persona.cargo,
        job_title: persona.job_title,
        profession: persona.profession,
        profissao: persona.profissao,
        age,
        temperament,
        business_type: persona.business_type,
      }),
    })

    const data: GenerateAvatarResponse = await response.json()

    if (data.success && data.imageUrl) {
      return data.imageUrl
    }

    console.error('Failed to generate avatar:', data.error)
    return null
  } catch (error) {
    console.error('Error calling avatar API:', error)
    return null
  }
}

/**
 * Fallback: URL de avatar usando Pravatar (gratuito)
 */
export function generateAvatarUrl(
  persona: PersonaBase,
  age: number,
  temperament: string
): string {
  const seed = generateSeed(persona.id, age, temperament)
  return `https://i.pravatar.cc/512?u=${seed}`
}

/**
 * Gera seed determinístico baseado nos parâmetros
 */
function generateSeed(
  personaId: string | undefined,
  age: number,
  temperament: string
): number {
  const baseString = `${personaId || 'default'}-${age}-${temperament}`

  let hash = 0
  for (let i = 0; i < baseString.length; i++) {
    const char = baseString.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }

  return Math.abs(hash)
}

/**
 * Pré-carrega uma imagem e retorna uma Promise
 */
export function preloadImage(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(url)
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = url
  })
}
