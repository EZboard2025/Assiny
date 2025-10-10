import { supabase } from './supabase'

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
  const { data, error } = await supabase
    .from('employees')
    .select('*')
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

export async function deleteEmployee(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('employees')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Erro ao deletar funcionário:', error)
    return false
  }

  return true
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

  return data.type
}

export async function setCompanyType(type: 'B2B' | 'B2C'): Promise<boolean> {
  // Deletar tipo anterior (mantemos apenas um registro)
  await supabase.from('company_type').delete().neq('id', '00000000-0000-0000-0000-000000000000')

  const { error } = await supabase
    .from('company_type')
    .insert([{ type }])

  if (error) {
    console.error('Erro ao definir tipo de empresa:', error)
    return false
  }

  return true
}

// Objections
export async function getObjections(): Promise<Objection[]> {
  const { data, error } = await supabase
    .from('objections')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Erro ao buscar objeções:', error)
    return []
  }

  return data || []
}

export async function addObjection(name: string): Promise<Objection | null> {
  const { data, error } = await supabase
    .from('objections')
    .insert([{ name }])
    .select()
    .single()

  if (error) {
    console.error('Erro ao adicionar objeção:', error)
    return null
  }

  return data
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
