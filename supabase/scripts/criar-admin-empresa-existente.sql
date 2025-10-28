-- ============================================
-- SCRIPT: Criar Admin para Empresa Existente
-- ============================================
-- Use este script quando a empresa JÁ EXISTE
-- e você só precisa criar um usuário admin
-- ============================================

DO $$
DECLARE
  -- ============================================
  -- CONFIGURAÇÕES: Altere os valores abaixo
  -- ============================================

  -- ID da empresa existente (pegue da tabela companies)
  empresa_id UUID := 'b1783e4d-f38c-46f6-ade9-10f8d63daa95';  -- ⬅️ ID da Mania Foods

  -- Dados do admin
  admin_nome TEXT := 'Admin Mania Foods';  -- ⬅️ ALTERE AQUI
  admin_email TEXT := 'admin@maniafoods.com';  -- ⬅️ ALTERE AQUI
  admin_senha TEXT := 'ManiaFoods2025!';  -- ⬅️ ALTERE AQUI

  -- Variável interna
  novo_user_id UUID;
  empresa_nome TEXT;
  empresa_subdomain TEXT;

BEGIN
  -- ============================================
  -- 1. VERIFICAR SE EMPRESA EXISTE
  -- ============================================
  SELECT name, subdomain INTO empresa_nome, empresa_subdomain
  FROM public.companies
  WHERE id = empresa_id;

  IF empresa_nome IS NULL THEN
    RAISE EXCEPTION 'Empresa com ID % não encontrada!', empresa_id;
  END IF;

  RAISE NOTICE 'Empresa encontrada: % (subdomain: %)', empresa_nome, empresa_subdomain;

  -- ============================================
  -- 2. CRIAR USUÁRIO NO AUTH
  -- ============================================
  RAISE NOTICE 'Criando usuário admin no Supabase Auth...';

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
    crypt(admin_senha, gen_salt('bf')),
    NOW(),
    jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
    jsonb_build_object('name', admin_nome, 'role', 'admin'),
    NOW(),
    NOW(),
    'authenticated',
    'authenticated'
  );

  RAISE NOTICE '✅ Usuário criado com ID: %', novo_user_id;

  -- ============================================
  -- 3. CRIAR EMPLOYEE VINCULADO À EMPRESA
  -- ============================================
  RAISE NOTICE 'Criando registro de employee...';

  INSERT INTO public.employees (name, email, role, user_id, company_id)
  VALUES (admin_nome, admin_email, 'admin', novo_user_id, empresa_id);

  RAISE NOTICE '✅ Employee criado e vinculado à empresa';

  -- ============================================
  -- RESUMO FINAL
  -- ============================================
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ ADMIN CRIADO COM SUCESSO!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Empresa: %', empresa_nome;
  RAISE NOTICE 'Subdomínio: %', empresa_subdomain;
  RAISE NOTICE '';
  RAISE NOTICE 'Nome: %', admin_nome;
  RAISE NOTICE 'Email: %', admin_email;
  RAISE NOTICE 'Senha: %', admin_senha;
  RAISE NOTICE 'User ID: %', novo_user_id;
  RAISE NOTICE '';
  RAISE NOTICE '🌐 Faça login em:';
  RAISE NOTICE '   Local: http://%.ramppy.local:3000', empresa_subdomain;
  RAISE NOTICE '   Produção: http://%.ramppy.site', empresa_subdomain;
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  IMPORTANTE: Altere a senha no primeiro login!';
  RAISE NOTICE '========================================';

END $$;
