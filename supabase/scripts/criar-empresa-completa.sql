-- ============================================
-- SCRIPT: Criar Empresa Completa com Admin
-- ============================================
-- Este script cria:
-- 1. Nova empresa na tabela companies
-- 2. Usuário admin no Supabase Auth
-- 3. Registro do admin na tabela employees
-- ============================================

-- IMPORTANTE: Execute este script no Supabase SQL Editor
-- Você precisa ter permissões de service role

-- ============================================
-- CONFIGURAÇÃO: Altere os valores abaixo
-- ============================================

DO $$
DECLARE
  -- CONFIGURAÇÕES DA EMPRESA
  empresa_nome TEXT := 'Mania Foods';  -- ⬅️ ALTERE AQUI
  empresa_subdomain TEXT := 'maniafoods';  -- ⬅️ ALTERE AQUI (sem espaços, tudo minúsculo)

  -- CONFIGURAÇÕES DO ADMIN
  admin_nome TEXT := 'Admin Mania Foods';  -- ⬅️ ALTERE AQUI
  admin_email TEXT := 'admin@maniafoods.com';  -- ⬅️ ALTERE AQUI
  admin_senha TEXT := 'ManiaFoods2025!';  -- ⬅️ ALTERE AQUI (senha temporária)

  -- Variáveis internas (não altere)
  nova_empresa_id UUID;
  novo_user_id UUID;

BEGIN
  -- ============================================
  -- 1. CRIAR EMPRESA
  -- ============================================
  RAISE NOTICE '1. Criando empresa: %', empresa_nome;

  INSERT INTO public.companies (name, subdomain)
  VALUES (empresa_nome, empresa_subdomain)
  RETURNING id INTO nova_empresa_id;

  RAISE NOTICE '   ✅ Empresa criada com ID: %', nova_empresa_id;

  -- ============================================
  -- 2. CRIAR USUÁRIO NO AUTH
  -- ============================================
  RAISE NOTICE '2. Criando usuário admin no Supabase Auth...';

  -- Criar usuário usando a função do Supabase Auth
  novo_user_id := extensions.uuid_generate_v4();

  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    role,
    aud
  )
  VALUES (
    novo_user_id,
    '00000000-0000-0000-0000-000000000000',
    admin_email,
    crypt(admin_senha, gen_salt('bf')),  -- Criptografar senha
    NOW(),
    jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
    jsonb_build_object('name', admin_nome),
    NOW(),
    NOW(),
    'authenticated',
    'authenticated'
  );

  RAISE NOTICE '   ✅ Usuário criado com ID: %', novo_user_id;

  -- ============================================
  -- 3. CRIAR EMPLOYEE VINCULADO À EMPRESA
  -- ============================================
  RAISE NOTICE '3. Criando registro de employee...';

  INSERT INTO public.employees (name, email, role, user_id, company_id)
  VALUES (admin_nome, admin_email, 'admin', novo_user_id, nova_empresa_id);

  RAISE NOTICE '   ✅ Employee criado e vinculado à empresa';

  -- ============================================
  -- RESUMO FINAL
  -- ============================================
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ EMPRESA CRIADA COM SUCESSO!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Empresa: %', empresa_nome;
  RAISE NOTICE 'Subdomínio: %', empresa_subdomain;
  RAISE NOTICE 'ID da Empresa: %', nova_empresa_id;
  RAISE NOTICE '';
  RAISE NOTICE 'Admin: %', admin_nome;
  RAISE NOTICE 'Email: %', admin_email;
  RAISE NOTICE 'Senha: %', admin_senha;
  RAISE NOTICE 'ID do Usuário: %', novo_user_id;
  RAISE NOTICE '';
  RAISE NOTICE '🌐 Acesse em:';
  RAISE NOTICE '   Local: http://%.ramppy.local:3000', empresa_subdomain;
  RAISE NOTICE '   Produção: http://%.ramppy.site', empresa_subdomain;
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  IMPORTANTE: Altere a senha no primeiro login!';
  RAISE NOTICE '========================================';

END $$;
