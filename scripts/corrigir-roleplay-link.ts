import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function corrigirRoleplayLink() {
  const linkCode = 'AC7E4AE9'
  const companyId = '124f5b74-20b5-4873-b612-0eafb2e6aa2e'

  console.log('🔧 Corrigindo roleplay link...\n')

  // 1. Buscar todas as objeções da empresa
  const { data: objections, error: objError } = await supabaseAdmin
    .from('objections')
    .select('id, name')
    .eq('company_id', companyId)
    .limit(10)

  if (objError) {
    console.error('❌ Erro ao buscar objeções:', objError)
    return
  }

  console.log(`✅ Encontradas ${objections?.length || 0} objeções:\n`)
  objections?.forEach((obj, index) => {
    console.log(`${index + 1}. ${obj.name}`)
    console.log(`   ID: ${obj.id}\n`)
  })

  if (!objections || objections.length === 0) {
    console.log('⚠️  Nenhuma objeção encontrada. Crie objeções no ConfigHub primeiro.')
    return
  }

  // 2. Pegar os 3 primeiros IDs válidos
  const validObjectionIds = objections.slice(0, 3).map(obj => obj.id)

  console.log('📝 IDs que serão salvos:', validObjectionIds)

  // 3. Buscar o link atual
  const { data: link } = await supabaseAdmin
    .from('roleplay_links')
    .select('*')
    .eq('link_code', linkCode)
    .single()

  if (!link) {
    console.log('❌ Link não encontrado')
    return
  }

  // 4. Atualizar com IDs válidos
  const updatedConfig = {
    ...link.config,
    objection_ids: validObjectionIds
  }

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('roleplay_links')
    .update({ config: updatedConfig })
    .eq('link_code', linkCode)
    .select()

  if (updateError) {
    console.error('❌ Erro ao atualizar:', updateError)
    return
  }

  console.log('\n✅ Link atualizado com sucesso!')
  console.log('\n📋 Nova configuração:')
  console.log(JSON.stringify(updatedConfig, null, 2))
}

corrigirRoleplayLink()
