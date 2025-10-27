import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Ler arquivos de migration
    const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations')
    const migrationFiles = [
      '01-criar-tabela-companies.sql',
      '02-adicionar-company-id-tabelas.sql',
      '03-atualizar-rls-multi-tenant.sql'
    ]

    const results = []

    for (const file of migrationFiles) {
      const filePath = path.join(migrationsDir, file)

      if (!fs.existsSync(filePath)) {
        results.push({
          file,
          status: 'error',
          message: 'Arquivo não encontrado'
        })
        continue
      }

      const sql = fs.readFileSync(filePath, 'utf-8')

      console.log(`\n=== Executando migration: ${file} ===`)

      try {
        // Dividir SQL em statements individuais (separados por ;)
        const statements = sql
          .split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0 && !s.startsWith('--'))

        console.log(`Total de statements: ${statements.length}`)

        for (let i = 0; i < statements.length; i++) {
          const statement = statements[i]
          console.log(`Executando statement ${i + 1}/${statements.length}`)

          const { data, error } = await supabaseAdmin.rpc('exec_sql' as any, {
            query: statement
          } as any)

          if (error) {
            console.error(`Erro no statement ${i + 1}:`, error)
            throw error
          }
        }

        console.log(`✅ Migration ${file} executada com sucesso`)
        results.push({
          file,
          status: 'success',
          message: 'Executada com sucesso',
          statements: statements.length
        })
      } catch (error: any) {
        console.error(`❌ Erro ao executar ${file}:`, error.message)
        results.push({
          file,
          status: 'error',
          message: error.message
        })
      }
    }

    return NextResponse.json({
      success: results.every(r => r.status === 'success'),
      results
    })

  } catch (error: any) {
    console.error('Erro ao executar migrations:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
