const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente não encontradas')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function fixRoleplayFunction() {
  console.log('🔧 Corrigindo função get_or_create_roleplay_config...')

  try {
    // Criar ou substituir a função
    const { error: functionError } = await supabase.rpc('query', {
      query: `
        CREATE OR REPLACE FUNCTION get_or_create_roleplay_config(p_company_id UUID)
        RETURNS roleplay_links AS $$
        DECLARE
          v_config roleplay_links;
          v_link_code TEXT;
        BEGIN
          -- Tentar buscar config existente
          SELECT * INTO v_config
          FROM roleplay_links
          WHERE company_id = p_company_id
          LIMIT 1;

          -- Se não existir, criar uma nova
          IF NOT FOUND THEN
            -- Gerar código único
            v_link_code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT), 1, 8));

            INSERT INTO roleplay_links (
              company_id,
              link_code,
              name,
              description,
              config,
              is_active,
              usage_count
            )
            VALUES (
              p_company_id,
              v_link_code,
              'Roleplay Público',
              'Link de roleplay público da empresa',
              '{"age": "25-34", "temperament": "Analítico", "persona_id": null, "objection_ids": []}'::jsonb,
              false,
              0
            )
            RETURNING * INTO v_config;
          END IF;

          RETURN v_config;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
      `
    })

    if (functionError) {
      console.error('❌ Erro ao criar função:', functionError)
      return
    }

    console.log('✅ Função criada/atualizada com sucesso!')

    // Testar a função
    const companyId = '668d8d47-dc76-4a70-9084-2dd68114e79e'
    console.log(`\n🧪 Testando com company_id: ${companyId}`)

    const { data, error } = await supabase.rpc('get_or_create_roleplay_config', {
      p_company_id: companyId
    })

    if (error) {
      console.error('❌ Erro ao testar função:', error)
      return
    }

    console.log('✅ Função testada com sucesso!')
    console.log('📊 Resultado:', data)

  } catch (error) {
    console.error('❌ Erro geral:', error)
  }
}

fixRoleplayFunction()