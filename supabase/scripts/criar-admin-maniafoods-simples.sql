-- ============================================
-- CRIAR ADMIN PARA MANIA FOODS (Método Simplificado)
-- ============================================
-- Execute este script no Supabase SQL Editor
-- ============================================

DO $$
DECLARE
  empresa_id UUID := 'b1783e4d-f38c-46f6-ade9-10f8d63daa95';
  admin_email TEXT := 'admin@maniafoods.com';
  admin_nome TEXT := 'Admin Mania Foods';
  novo_user_id UUID;
BEGIN
  -- Gerar novo UUID para o usuário
  novo_user_id := gen_random_uuid();

  -- Inserir usuário no auth.users (método simplificado)
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    invited_at,
    confirmation_token,
    confirmation_sent_at,
    recovery_token,
    recovery_sent_at,
    email_change_token_new,
    email_change,
    email_change_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    created_at,
    updated_at,
    phone,
    phone_confirmed_at,
    phone_change,
    phone_change_token,
    phone_change_sent_at,
    email_change_token_current,
    email_change_confirm_status,
    banned_until,
    reauthentication_token,
    reauthentication_sent_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    novo_user_id,
    'authenticated',
    'authenticated',
    admin_email,
    crypt('ManiaFoods123', gen_salt('bf')),  -- Senha: ManiaFoods123
    now(),
    NULL,
    '',
    NULL,
    '',
    NULL,
    '',
    '',
    NULL,
    NULL,
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('name', admin_nome, 'role', 'admin'),
    NULL,
    now(),
    now(),
    NULL,
    NULL,
    '',
    '',
    NULL,
    '',
    0,
    NULL,
    '',
    NULL
  );

  -- Criar identidade para o usuário
  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    novo_user_id,
    jsonb_build_object('sub', novo_user_id::text, 'email', admin_email),
    'email',
    now(),
    now(),
    now()
  );

  -- Criar employee vinculado à empresa
  INSERT INTO public.employees (name, email, role, user_id, company_id)
  VALUES (admin_nome, admin_email, 'admin', novo_user_id, empresa_id);

  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ ADMIN CRIADO COM SUCESSO!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Email: %', admin_email;
  RAISE NOTICE 'Senha: ManiaFoods123';
  RAISE NOTICE 'User ID: %', novo_user_id;
  RAISE NOTICE '';
  RAISE NOTICE '🌐 Acesse: http://maniafoods.ramppy.site';
  RAISE NOTICE '========================================';

END $$;
