const { createClient } = require('@supabase/supabase-js')

// Configurar manualmente as variáveis (sem dotenv)
const supabase = createClient(
  'https://vvqtgclprliryctavqal.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2cXRnY2xwcmxscnljdGF2cWFsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTUyNTU0MiwiZXhwIjoyMDc1MTAxNTQyfQ.OwsRj4RPV4JMhnjHNdATeIf9KDJTJMusNzriUn5BOfQ'
)

async function createTestUser() {
  console.log('🚀 Criando usuário de teste...')

  const { data, error } = await supabase.auth.admin.createUser({
    email: 'teste@assiny.com',
    password: 'teste123',
    email_confirm: true,
    user_metadata: {
      name: 'Usuário Teste',
      role: 'vendedor'
    }
  })

  if (error) {
    console.error('❌ Erro:', error.message)
    return
  }

  console.log('✅ Usuário criado com sucesso!')
  console.log('📧 Email:', 'teste@assiny.com')
  console.log('🔑 Senha:', 'teste123')
  console.log('\nAgora você pode fazer login no app!')
}

createTestUser()
