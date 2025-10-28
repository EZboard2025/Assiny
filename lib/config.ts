import { supabase } from './supabase'
import { getCompanyIdFromUser } from './utils/getCompanyId'

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
  const companyId = await getCompanyIdFromUser()

  if (!companyId) {
    console.error('Company ID não encontrado')
    return []
  }

  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Erro ao buscar funcionários:', error)
    return []
  }

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
export async function getCompanyType(): Promise<'B2B' | 'B2C'> {
  const { data, error } = await supabase
    .from('company_type')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) {
    return 'B2C' // Default
  }

  return data.name
}

export async function setCompanyType(type: 'B2B' | 'B2C'): Promise<boolean> {
  // Deletar tipo anterior (mantemos apenas um registro)
  await supabase.from('company_type').delete().neq('id', '00000000-0000-0000-0000-000000000000')

  const { error } = await supabase
    .from('company_type')
    .insert([{ name: type }])

  if (error) {
    console.error('Erro ao definir tipo de empresa:', error)
    return false
  }

  return true
}

// Objections
export async function getObjections(): Promise<Objection[]> {
  const companyId = await getCompanyIdFromUser()

  if (!companyId) {
    console.error('Company ID não encontrado')
    return []
  }

  const { data, error } = await supabase
    .from('objections')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Erro ao buscar objeções:', error)
    return []
  }

  return data || []
}

export async function addObjection(name: string, rebuttals: string[] = []): Promise<Objection | null> {
  const { data, error } = await supabase
    .from('objections')
    .insert([{ name, rebuttals }])
    .select()
    .single()

  if (error) {
    console.error('Erro ao adicionar objeção:', error)
    return null
  }

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
  const companyId = await getCompanyIdFromUser()

  if (!companyId) {
    console.error('Company ID não encontrado')
    return []
  }

  const { data, error } = await supabase
    .from('personas')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Erro ao buscar personas:', error)
    return []
  }

  return data || []
}

export async function addPersona(persona: Omit<Persona, 'id' | 'created_at' | 'updated_at'>): Promise<Persona | null> {
  const companyId = await getCompanyIdFromUser()

  if (!companyId) {
    console.error('[addPersona] company_id não encontrado')
    return null
  }

  console.log('[addPersona] Inserindo persona com company_id:', companyId)
  console.log('[addPersona] Dados da persona:', { ...persona, company_id: companyId })

  const { data, error } = await supabase
    .from('personas')
    .insert([persona])
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
