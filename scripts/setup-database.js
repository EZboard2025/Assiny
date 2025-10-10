const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

async function setupDatabase() {
  console.log('🚀 Conectando ao Supabase...')
  console.log('URL:', supabaseUrl)

  const supabase = createClient(supabaseUrl, supabaseKey)

  // Testar conexão
  try {
    const { data, error } = await supabase.from('users').select('count')

    if (error && error.code === '42P01') {
      console.log('⚠️  Tabelas ainda não criadas. Execute o schema.sql no painel do Supabase.')
      console.log('')
      console.log('📝 Passos:')
      console.log('1. Acesse: https://vvqtgclprliryctavqal.supabase.co')
      console.log('2. Vá em SQL Editor')
      console.log('3. Cole o conteúdo de supabase/schema.sql')
      console.log('4. Execute (Run)')
      return
    }

    if (error) {
      console.error('❌ Erro ao conectar:', error.message)
      return
    }

    console.log('✅ Conectado com sucesso!')
    console.log('')

    // Criar usuário admin de teste
    console.log('👤 Criando usuário admin de teste...')

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: 'admin@assiny.com',
      password: 'senha123',
      options: {
        data: {
          name: 'Admin'
        }
      }
    })

    if (authError) {
      console.log('⚠️  Erro ao criar usuário:', authError.message)
    } else {
      console.log('✅ Usuário criado!')

      // Adicionar role de admin
      const { error: roleError } = await supabase
        .from('users')
        .update({ role: 'admin' })
        .eq('email', 'admin@assiny.com')

      if (roleError) {
        console.log('⚠️  Erro ao definir role:', roleError.message)
      } else {
        console.log('✅ Role de admin definida!')
      }
    }

    console.log('')
    console.log('🎉 Setup concluído!')
    console.log('')
    console.log('📝 Credenciais de teste:')
    console.log('Email: admin@assiny.com')
    console.log('Senha: senha123')

  } catch (error) {
    console.error('❌ Erro:', error)
  }
}

setupDatabase()