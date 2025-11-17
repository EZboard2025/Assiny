/**
 * Script de teste para verificar criação e carregamento de roleplay links
 *
 * Uso:
 * node scripts/test-roleplay-link.js
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Variáveis de ambiente não configuradas!')
  console.error('NEXT_PUBLIC_SUPABASE_URL:', SUPABASE_URL ? '✅' : '❌')
  console.error('SUPABASE_SERVICE_ROLE_KEY:', SERVICE_ROLE_KEY ? '✅' : '❌')
  process.exit(1)
}

async function testRoleplayLink() {
  const { createClient } = await import('@supabase/supabase-js')

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  console.log('🔍 Buscando roleplay links existentes...\n')

  // Buscar todos os links
  const { data: links, error } = await supabase
    .from('roleplay_links')
    .select('*')
    .limit(5)

  if (error) {
    console.error('❌ Erro ao buscar links:', error)
    return
  }

  if (!links || links.length === 0) {
    console.log('⚠️  Nenhum link encontrado no banco de dados')
    console.log('💡 Crie um link pelo ConfigHub primeiro')
    return
  }

  console.log(`✅ Encontrado(s) ${links.length} link(s):\n`)

  links.forEach((link, index) => {
    console.log(`📌 Link ${index + 1}:`)
    console.log(`   ID: ${link.id}`)
    console.log(`   Nome: ${link.name}`)
    console.log(`   Código: ${link.link_code}`)
    console.log(`   Ativo: ${link.is_active ? '✅' : '❌'}`)
    console.log(`   Configuração:`)
    console.log(`   ${JSON.stringify(link.config, null, 6)}`)
    console.log(`   URL: http://localhost:3000/roleplay-publico?link=${link.link_code}`)
    console.log('')
  })

  // Verificar se a config tem os campos corretos
  const firstLink = links[0]
  console.log('🔍 Validando estrutura da configuração...\n')

  const requiredFields = ['age', 'temperament', 'persona_id', 'objection_ids']
  const hasAllFields = requiredFields.every(field => field in firstLink.config)

  if (hasAllFields) {
    console.log('✅ Todos os campos obrigatórios estão presentes!')
    console.log('   - age:', firstLink.config.age)
    console.log('   - temperament:', firstLink.config.temperament)
    console.log('   - persona_id:', firstLink.config.persona_id)
    console.log('   - objection_ids:', firstLink.config.objection_ids)
  } else {
    console.log('❌ Campos faltando na configuração!')
    requiredFields.forEach(field => {
      const exists = field in firstLink.config
      console.log(`   ${exists ? '✅' : '❌'} ${field}`)
    })
  }

  // Verificar se há campos com nome errado
  if ('age_range' in firstLink.config) {
    console.log('\n⚠️  AVISO: Campo "age_range" encontrado (deveria ser "age")')
    console.log('   Isso pode causar problemas de carregamento')
  }
}

testRoleplayLink().catch(console.error)
