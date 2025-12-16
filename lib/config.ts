import { supabase } from './supabase'
import { getCompanyIdFromUser } from './utils/getCompanyId'
import { getCompanyId } from './utils/getCompanyFromSubdomain'

export interface Employee {
  id: string
  name: string
  email: string
  role: string
  created_at: string
  updated_at: string
}

export interface CustomerSegment {
  id: string
  name: string
  created_at: string
  updated_at: string
}

export interface CompanyType {
  id: string
  type: 'B2B' | 'B2C'
  created_at: string
  updated_at: string
}

export interface Objection {
  id: string
  name: string
  rebuttals: string[]
  evaluation_score: number | null
  created_at: string
  updated_at: string
}

// Gerar senha aleatória
function generatePassword(length: number = 12): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%'
  let password = ''
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

// Employees
export async function getEmployees(): Promise<Employee[]> {
  const companyId = await getCompanyId() // Usa subdomínio primeiro, depois usuário

  if (!companyId) {
    console.error('[getEmployees] Company ID não encontrado')
    return []
  }

  console.log('[getEmployees] Buscando funcionários para company_id:', companyId)

  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[getEmployees] Erro ao buscar funcionários:', error)
    return []
  }

  console.log('[getEmployees] Funcionários encontrados:', data?.length || 0)
  return data || []
}

export async function addEmployee(employee: { name: string; email: string; role: string }): Promise<{ employee: Employee; password: string } | null> {
  try {
    const response = await fetch('/api/employees', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(employee),
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('Erro ao adicionar funcionário:', error)
      return null
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Erro ao adicionar funcionário:', error)
    return null
  }
}

export async function updateEmployee(id: string, employee: { name: string; email: string; role: string }): Promise<boolean> {
  const { error } = await supabase
    .from('employees')
    .update(employee)
    .eq('id', id)

  if (error) {
    console.error('Erro ao atualizar funcionário:', error)
    return false
  }

  return true
}

export async function deleteEmployee(id: string, email: string): Promise<boolean> {
  try {
    const response = await fetch('/api/employees/delete', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id, email }),
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('Erro ao deletar funcionário:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Erro ao deletar funcionário:', error)
    return false
  }
}

// Customer Segments
export async function getCustomerSegments(): Promise<CustomerSegment[]> {
  const { data, error } = await supabase
    .from('customer_segments')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Erro ao buscar segmentos:', error)
    return []
  }

  return data || []
}

export async function addCustomerSegment(name: string): Promise<CustomerSegment | null> {
  const { data, error } = await supabase
    .from('customer_segments')
    .insert([{ name }])
    .select()
    .single()

  if (error) {
    console.error('Erro ao adicionar segmento:', error)
    return null
  }

  return data
}

export async function deleteCustomerSegment(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('customer_segments')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Erro ao deletar segmento:', error)
    return false
  }

  return true
}

// Company Type
export async function getCompanyType(): Promise<'B2B' | 'B2C' | 'Ambos'> {
  const companyId = await getCompanyId() // Usa subdomínio primeiro, depois usuário

  if (!companyId) {
    console.error('[getCompanyType] Company ID não encontrado')
    return 'B2C' // Default
  }

  console.log('[getCompanyType] Buscando tipo de empresa para company_id:', companyId)

  const { data, error } = await supabase
    .from('company_type')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) {
    console.log('[getCompanyType] Tipo não encontrado, retornando default B2C')
    return 'B2C' // Default
  }

  console.log('[getCompanyType] Tipo encontrado:', data.name)
  return data.name
}

export async function setCompanyType(type: 'B2B' | 'B2C' | 'Ambos'): Promise<boolean> {
  const companyId = await getCompanyId() // Usa subdomínio primeiro, depois usuário

  if (!companyId) {
    console.error('[setCompanyType] Company ID não encontrado')
    return false
  }

  console.log('[setCompanyType] Definindo tipo de empresa para company_id:', companyId)

  // Deletar tipo anterior para esta empresa
  await supabase
    .from('company_type')
    .delete()
    .eq('company_id', companyId)

  const { error } = await supabase
    .from('company_type')
    .insert([{
      name: type,
      company_id: companyId
    }])

  if (error) {
    console.error('[setCompanyType] Erro ao definir tipo de empresa:', error)
    return false
  }

  console.log('[setCompanyType] Tipo de empresa definido com sucesso:', type)
  return true
}

// Objections
export async function getObjections(): Promise<Objection[]> {
  const companyId = await getCompanyId() // Usa subdomínio primeiro, depois usuário

  if (!companyId) {
    console.error('[getObjections] Company ID não encontrado')
    return []
  }

  console.log('[getObjections] Buscando objeções para company_id:', companyId)

  const { data, error } = await supabase
    .from('objections')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[getObjections] Erro ao buscar objeções:', error)
    return []
  }

  console.log('[getObjections] Objeções encontradas:', data?.length || 0)
  return data || []
}

export async function addObjection(name: string, rebuttals: string[] = []): Promise<Objection | null> {
  const companyId = await getCompanyId() // Usa subdomínio primeiro, depois usuário

  if (!companyId) {
    console.error('[addObjection] Company ID não encontrado')
    return null
  }

  console.log('[addObjection] Inserindo objeção com company_id:', companyId)

  const { data, error } = await supabase
    .from('objections')
    .insert([{
      name,
      rebuttals,
      company_id: companyId
    }])
    .select()
    .single()

  if (error) {
    console.error('[addObjection] Erro ao adicionar objeção:', error)
    return null
  }

  console.log('[addObjection] Objeção criada com sucesso:', data)
  return data
}

export async function updateObjection(id: string, name: string, rebuttals: string[]): Promise<boolean> {
  const { error } = await supabase
    .from('objections')
    .update({
      name,
      rebuttals,
      evaluation_score: null // Reset score quando editado
    })
    .eq('id', id)

  if (error) {
    console.error('Erro ao atualizar objeção:', error)
    return false
  }

  return true
}

export async function updateObjectionScore(id: string, score: number): Promise<boolean> {
  const { error } = await supabase
    .from('objections')
    .update({ evaluation_score: score })
    .eq('id', id)

  if (error) {
    console.error('Erro ao atualizar score da objeção:', error)
    return false
  }

  return true
}

export async function deleteObjection(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('objections')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Erro ao deletar objeção:', error)
    return false
  }

  return true
}

// Personas
export interface PersonaB2C {
  id?: string
  business_type: 'B2C'
  photo_url?: string
  context?: string
  profession: string
  what_seeks?: string
  main_pains?: string
  prior_knowledge?: string
  evaluation_score?: number
  created_at?: string
  updated_at?: string
}

export interface PersonaB2B {
  id?: string
  business_type: 'B2B'
  photo_url?: string
  context?: string
  job_title: string
  company_type?: string
  company_goals?: string
  business_challenges?: string
  prior_knowledge?: string
  evaluation_score?: number
  created_at?: string
  updated_at?: string
}

export type Persona = PersonaB2C | PersonaB2B

export async function getPersonas(): Promise<Persona[]> {
  const companyId = await getCompanyId() // Usa subdomínio primeiro, depois usuário

  if (!companyId) {
    console.error('[getPersonas] Company ID não encontrado')
    return []
  }

  console.log('[getPersonas] Buscando personas para company_id:', companyId)

  const { data, error } = await supabase
    .from('personas')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[getPersonas] Erro ao buscar personas:', error)
    return []
  }

  console.log('[getPersonas] Personas encontradas:', data?.length || 0)
  return data || []
}

export async function addPersona(persona: Omit<Persona, 'id' | 'created_at' | 'updated_at'>): Promise<Persona | null> {
  const companyId = await getCompanyId() // Usa subdomínio primeiro, depois usuário

  if (!companyId) {
    console.error('[addPersona] company_id não encontrado')
    return null
  }

  console.log('[addPersona] Inserindo persona com company_id:', companyId)
  console.log('[addPersona] Dados da persona:', { ...persona, company_id: companyId })

  const { data, error } = await supabase
    .from('personas')
    .insert([{
      ...persona,
      company_id: companyId
    }])
    .select()
    .single()

  if (error) {
    console.error('[addPersona] Erro detalhado:', error)
    console.error('[addPersona] Erro message:', error.message)
    console.error('[addPersona] Erro code:', error.code)
    console.error('[addPersona] Erro details:', error.details)
    return null
  }

  return data
}

export async function updatePersona(id: string, persona: Partial<Persona>): Promise<boolean> {
  const { error } = await supabase
    .from('personas')
    .update(persona)
    .eq('id', id)

  if (error) {
    console.error('Erro ao atualizar persona:', error)
    return false
  }

  return true
}

export async function deletePersona(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('personas')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Erro ao deletar persona:', error)
    return false
  }

  return true
}

// Tags
export interface Tag {
  id: string
  company_id: string
  name: string
  color: string
  created_at: string
  updated_at: string
}

export async function getTags(): Promise<Tag[]> {
  const companyId = await getCompanyId()

  if (!companyId) {
    console.error('[getTags] Company ID não encontrado')
    return []
  }

  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .eq('company_id', companyId)
    .order('name', { ascending: true })

  if (error) {
    console.error('[getTags] Erro ao buscar tags:', error)
    return []
  }

  return data || []
}

export async function createTag(name: string, color: string = '#6B46C1'): Promise<Tag | null> {
  const companyId = await getCompanyId()

  if (!companyId) {
    console.error('[createTag] Company ID não encontrado')
    return null
  }

  const { data, error } = await supabase
    .from('tags')
    .insert({
      company_id: companyId,
      name,
      color
    })
    .select()
    .single()

  if (error) {
    console.error('[createTag] Erro ao criar tag:', error)
    return null
  }

  return data
}

export async function updateTag(id: string, name: string, color: string): Promise<boolean> {
  const { error } = await supabase
    .from('tags')
    .update({
      name,
      color,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)

  if (error) {
    console.error('[updateTag] Erro ao atualizar tag:', error)
    return false
  }

  return true
}

export async function deleteTag(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('tags')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('[deleteTag] Erro ao deletar tag:', error)
    return false
  }

  return true
}

// Personas Tags (relacionamento)
export async function getPersonaTags(personaId: string): Promise<Tag[]> {
  const { data, error } = await supabase
    .from('personas_tags')
    .select('tags(*)')
    .eq('persona_id', personaId)

  if (error) {
    console.error('[getPersonaTags] Erro ao buscar tags da persona:', error)
    return []
  }

  return data?.map(item => item.tags).filter(Boolean).flat() as Tag[] || []
}

export async function addTagToPersona(personaId: string, tagId: string): Promise<boolean> {
  const { error } = await supabase
    .from('personas_tags')
    .insert({
      persona_id: personaId,
      tag_id: tagId
    })

  if (error) {
    console.error('[addTagToPersona] Erro ao adicionar tag à persona:', error)
    return false
  }

  return true
}

export async function removeTagFromPersona(personaId: string, tagId: string): Promise<boolean> {
  const { error } = await supabase
    .from('personas_tags')
    .delete()
    .eq('persona_id', personaId)
    .eq('tag_id', tagId)

  if (error) {
    console.error('[removeTagFromPersona] Erro ao remover tag da persona:', error)
    return false
  }

  return true
}

export async function updatePersonaTags(personaId: string, tagIds: string[]): Promise<boolean> {
  // Primeiro remove todas as tags existentes
  const { error: deleteError } = await supabase
    .from('personas_tags')
    .delete()
    .eq('persona_id', personaId)

  if (deleteError) {
    console.error('[updatePersonaTags] Erro ao remover tags existentes:', deleteError)
    return false
  }

  // Se não houver novas tags, termina aqui
  if (tagIds.length === 0) {
    return true
  }

  // Adiciona as novas tags
  const inserts = tagIds.map(tagId => ({
    persona_id: personaId,
    tag_id: tagId
  }))

  const { error: insertError } = await supabase
    .from('personas_tags')
    .insert(inserts)

  if (insertError) {
    console.error('[updatePersonaTags] Erro ao adicionar novas tags:', insertError)
    return false
  }

  return true
}
