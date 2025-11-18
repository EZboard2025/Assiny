import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function verificarTabela() {
  console.log('🔍 Verificando estrutura da tabela roleplays_unicos...\n')

  // Testar query simples
  const { data, error } = await supabase
    .from('roleplays_unicos')
    .select('*')
    .limit(1)

  if (error) {
    console.error('❌ Erro ao consultar tabela:', error.message)
    return
  }

  console.log('✅ Tabela existe!')

  if (data && data.length > 0) {
    console.log('\n📋 Colunas encontradas:')
    console.log(Object.keys(data[0]).join(', '))

    // Verificar se link_id existe
    if ('link_id' in data[0]) {
      console.log('\n✅ Coluna link_id EXISTE')
    } else {
      console.log('\n❌ Coluna link_id NÃO EXISTE - precisa rodar a migration!')
    }
  } else {
    console.log('\n⚠️ Tabela está vazia, não é possível verificar colunas.')
    console.log('Vou tentar inserir um registro de teste...')

    const { error: insertError } = await supabase
      .from('roleplays_unicos')
      .insert({
        company_id: '00000000-0000-0000-0000-000000000000',
        participant_name: 'Teste',
        config: {},
        link_id: '00000000-0000-0000-0000-000000000000'
      })

    if (insertError) {
      if (insertError.message.includes('link_id')) {
        console.log('\n❌ Coluna link_id NÃO EXISTE - precisa rodar a migration!')
        console.log('\n📝 Execute o SQL abaixo no Supabase SQL Editor:')
        console.log('ALTER TABLE roleplays_unicos ADD COLUMN IF NOT EXISTS link_id UUID REFERENCES roleplay_links(id);')
      } else {
        console.log('\n❌ Erro ao inserir:', insertError.message)
      }
    } else {
      console.log('\n✅ Coluna link_id EXISTE!')
      // Limpar registro de teste
      await supabase
        .from('roleplays_unicos')
        .delete()
        .eq('participant_name', 'Teste')
    }
  }
}

verificarTabela()
