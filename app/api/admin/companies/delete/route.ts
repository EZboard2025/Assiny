import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function DELETE(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    if (!serviceRoleKey) {
      console.error('SUPABASE_SERVICE_ROLE_KEY não configurada')
      return NextResponse.json(
        { error: 'Configuração do servidor incompleta' },
        { status: 500 }
      )
    }

    // Cliente com service role para operações administrativas
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Receber company_id da URL ou body
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')

    if (!companyId) {
      return NextResponse.json(
        { error: 'ID da empresa não fornecido' },
        { status: 400 }
      )
    }

    console.log(`🗑️ Deletando empresa: ${companyId}`)

    // 1. Buscar informações da empresa antes de deletar
    const { data: company, error: companyFetchError } = await supabaseAdmin
      .from('companies')
      .select('name, subdomain')
      .eq('id', companyId)
      .single()

    if (companyFetchError || !company) {
      console.error('Empresa não encontrada:', companyFetchError)
      return NextResponse.json(
        { error: 'Empresa não encontrada' },
        { status: 404 }
      )
    }

    console.log(`📋 Empresa a deletar: ${company.name} (${company.subdomain})`)

    // 2. Buscar e deletar todos os usuários (auth) vinculados à empresa
    const { data: employees } = await supabaseAdmin
      .from('employees')
      .select('user_id')
      .eq('company_id', companyId)

    if (employees && employees.length > 0) {
      console.log(`🔑 Deletando ${employees.length} usuários do Auth...`)

      for (const employee of employees) {
        if (employee.user_id) {
          try {
            await supabaseAdmin.auth.admin.deleteUser(employee.user_id)
            console.log(`  ✅ Usuário deletado: ${employee.user_id}`)
          } catch (error) {
            console.error(`  ❌ Erro ao deletar usuário ${employee.user_id}:`, error)
            // Continuar mesmo se falhar
          }
        }
      }
    }

    // 3. Deletar dados adicionais que podem não ter CASCADE configurado
    console.log('🧹 Limpando dados relacionados...')

    // Deletar roleplay_sessions dos funcionários da empresa
    const { data: sessions } = await supabaseAdmin
      .from('roleplay_sessions')
      .select('id')
      .in('user_id', employees?.map(e => e.user_id) || [])

    if (sessions && sessions.length > 0) {
      console.log(`  📝 Deletando ${sessions.length} sessões de roleplay...`)
      await supabaseAdmin
        .from('roleplay_sessions')
        .delete()
        .in('user_id', employees?.map(e => e.user_id) || [])
    }

    // Deletar user_performance_summaries
    const { data: summaries } = await supabaseAdmin
      .from('user_performance_summaries')
      .select('id')
      .in('user_id', employees?.map(e => e.user_id) || [])

    if (summaries && summaries.length > 0) {
      console.log(`  📊 Deletando ${summaries.length} resumos de performance...`)
      await supabaseAdmin
        .from('user_performance_summaries')
        .delete()
        .in('user_id', employees?.map(e => e.user_id) || [])
    }

    // Deletar chat_sessions
    const { data: chats } = await supabaseAdmin
      .from('chat_sessions')
      .select('id')
      .in('user_id', employees?.map(e => e.user_id) || [])

    if (chats && chats.length > 0) {
      console.log(`  💬 Deletando ${chats.length} sessões de chat...`)
      await supabaseAdmin
        .from('chat_sessions')
        .delete()
        .in('user_id', employees?.map(e => e.user_id) || [])
    }

    // Deletar PDIs
    const { data: pdis } = await supabaseAdmin
      .from('pdis')
      .select('id')
      .in('user_id', employees?.map(e => e.user_id) || [])

    if (pdis && pdis.length > 0) {
      console.log(`  📋 Deletando ${pdis.length} PDIs...`)
      await supabaseAdmin
        .from('pdis')
        .delete()
        .in('user_id', employees?.map(e => e.user_id) || [])
    }

    // Deletar análises de follow-up
    const { data: followups } = await supabaseAdmin
      .from('followup_analyses')
      .select('id')
      .in('user_id', employees?.map(e => e.user_id) || [])

    if (followups && followups.length > 0) {
      console.log(`  📱 Deletando ${followups.length} análises de follow-up...`)
      await supabaseAdmin
        .from('followup_analyses')
        .delete()
        .in('user_id', employees?.map(e => e.user_id) || [])
    }

    // 4. Deletar a empresa (CASCADE deletará todos os dados relacionados)
    // Devido às foreign keys com ON DELETE CASCADE, isso deletará automaticamente:
    // - employees
    // - personas
    // - objections
    // - company_data
    // - company_type
    // - documents

    const { error: deleteError } = await supabaseAdmin
      .from('companies')
      .delete()
      .eq('id', companyId)

    if (deleteError) {
      console.error('Erro ao deletar empresa:', deleteError)
      return NextResponse.json(
        { error: 'Erro ao deletar empresa: ' + deleteError.message },
        { status: 500 }
      )
    }

    console.log(`✅ Empresa ${company.name} deletada com sucesso!`)

    // Retornar sucesso
    return NextResponse.json({
      success: true,
      message: `Empresa "${company.name}" e todos os dados relacionados foram deletados com sucesso.`,
      deletedCompany: {
        id: companyId,
        name: company.name,
        subdomain: company.subdomain
      }
    })

  } catch (error: any) {
    console.error('Erro ao deletar empresa:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao deletar empresa' },
      { status: 500 }
    )
  }
}