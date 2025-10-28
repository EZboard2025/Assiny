// Script de teste para verificar filtro de roleplay sessions

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function testRoleplayFilter() {
  // 1. Obter usuário atual
  const { data: { user } } = await supabase.auth.getUser()
  console.log('Usuário atual:', user?.id)

  // 2. Buscar sessões SEM filtro (o que está acontecendo incorretamente)
  const { data: allSessions } = await supabase
    .from('roleplay_sessions')
    .select('id, user_id')
    .limit(10)

  console.log('Sessões SEM filtro:', allSessions?.length)
  allSessions?.forEach(s => {
    console.log(`  - Session ${s.id.substring(0,8)}... user: ${s.user_id}`)
  })

  // 3. Buscar sessões COM filtro (o que deveria acontecer)
  const { data: userSessions } = await supabase
    .from('roleplay_sessions')
    .select('id, user_id')
    .eq('user_id', user?.id)
    .limit(10)

  console.log('\nSessões COM filtro por user_id:', userSessions?.length)
  userSessions?.forEach(s => {
    console.log(`  - Session ${s.id.substring(0,8)}... user: ${s.user_id}`)
  })
}

testRoleplayFilter()