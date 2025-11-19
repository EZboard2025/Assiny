import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function verificarRoleplayLink() {
  console.log('🔍 Verificando configuração do roleplay link...\n')

  // Buscar o link pelo código
  const { data: link, error } = await supabaseAdmin
    .from('roleplay_links')
    .select('*')
    .eq('link_code', 'AC7E4AE9')
    .single()

  if (error) {
    console.error('❌ Erro ao buscar link:', error)
    return
  }

  if (!link) {
    console.log('⚠️ Link não encontrado')
    return
  }

  console.log('✅ Link encontrado:')
  console.log('─'.repeat(80))
  console.log('ID:', link.id)
  console.log('Nome:', link.name)
  console.log('Link Code:', link.link_code)
  console.log('Company ID:', link.company_id)
  console.log('Ativo:', link.is_active)
  console.log('\n📋 CONFIGURAÇÃO:')
  console.log(JSON.stringify(link.config, null, 2))

  // Verificar se os IDs das objeções são válidos
  if (link.config?.objection_ids) {
    console.log('\n🔍 Verificando objeções:')
    console.log('IDs recebidos:', link.config.objection_ids)

    for (const objId of link.config.objection_ids) {
      // Tentar buscar a objeção
      const { data: objection, error: objError } = await supabaseAdmin
        .from('objections')
        .select('id, name')
        .eq('id', objId)
        .single()

      if (objError) {
        console.log(`  ❌ ${objId}: ERRO - ${objError.message}`)
      } else if (!objection) {
        console.log(`  ❌ ${objId}: NÃO ENCONTRADA`)
      } else {
        console.log(`  ✅ ${objId}: ${objection.name}`)
      }
    }
  }

  console.log('\n')
}

verificarRoleplayLink()
