const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function setupRoleplayLinks() {
  try {
    console.log('🔧 Configurando estrutura de roleplay_links...')

    // Verificar se a tabela existe
    const { data: tables } = await supabaseAdmin
      .from('roleplay_links')
      .select('id')
      .limit(1)

    if (!tables) {
      console.log('❌ Tabela roleplay_links não existe. Execute o SQL primeiro:')
      console.log('   sql/ajustar-roleplay-unico-simplificado.sql')
      return
    }

    console.log('✅ Tabela roleplay_links existe')

    // Verificar se há empresas
    const { data: companies } = await supabaseAdmin
      .from('companies')
      .select('id, name, subdomain')

    console.log(`📊 Empresas encontradas: ${companies?.length || 0}`)

    if (companies && companies.length > 0) {
      for (const company of companies) {
        console.log(`\n🏢 Empresa: ${company.name} (${company.subdomain})`)

        // Verificar se já tem configuração
        const { data: config } = await supabaseAdmin
          .from('roleplay_links')
          .select('*')
          .eq('company_id', company.id)
          .single()

        if (!config) {
          console.log('   ➕ Criando configuração padrão...')
          const { data: newConfig, error } = await supabaseAdmin
            .from('roleplay_links')
            .insert({
              company_id: company.id,
              config: {
                age_range: '25-34',
                temperament: 'Analítico',
                persona_id: null,
                objection_ids: []
              }
            })
            .select()
            .single()

          if (error) {
            console.error('   ❌ Erro ao criar config:', error.message)
          } else {
            console.log('   ✅ Configuração criada')
          }
        } else {
          console.log('   ✅ Configuração já existe')
        }

        // Verificar personas
        const { data: personas } = await supabaseAdmin
          .from('personas')
          .select('*')
          .eq('company_id', company.id)

        console.log(`   📝 Personas cadastradas: ${personas?.length || 0}`)
        if (personas && personas.length > 0) {
          personas.forEach(p => {
            console.log(`      - ID: ${p.id}`)
            console.log(`        Campos: ${Object.keys(p).filter(k => p[k] !== null).join(', ')}`)
            if (p.cargo) console.log(`        cargo: ${p.cargo}`)
            if (p.tipo_empresa_faturamento) console.log(`        tipo: ${p.tipo_empresa_faturamento}`)
          })
        }

        // Verificar objeções
        const { data: objections } = await supabaseAdmin
          .from('objections')
          .select('id, name')
          .eq('company_id', company.id)

        console.log(`   ❓ Objeções cadastradas: ${objections?.length || 0}`)
        if (objections && objections.length > 0) {
          objections.forEach(o => console.log(`      - ${o.name}`))
        }
      }
    }

    console.log('\n✨ Verificação concluída!')

  } catch (error) {
    console.error('❌ Erro:', error)
  }
}

setupRoleplayLinks()