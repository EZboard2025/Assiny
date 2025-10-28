-- ============================================
-- DIAGNÓSTICO E CRIAÇÃO DE ADMIN PARA MANIA FOODS
-- ============================================

-- 1. PRIMEIRO, VAMOS VERIFICAR O QUE EXISTE
-- ============================================

-- Verificar se a empresa Mania Foods existe
SELECT id, name, subdomain
FROM public.companies
WHERE subdomain = 'maniafoods';

-- Verificar se já existe algum usuário com esse email
SELECT id, email, created_at
FROM auth.users
WHERE email = 'admin@maniafoods.com';

-- Verificar employees da Mania Foods
SELECT e.*, c.name as company_name
FROM public.employees e
LEFT JOIN public.companies c ON c.id = e.company_id
WHERE e.company_id = 'b1783e4d-f38c-46f6-ade9-10f8d63daa95'
   OR e.email = 'admin@maniafoods.com';

-- ============================================
-- 2. LIMPAR REGISTROS PROBLEMÁTICOS (SE EXISTIREM)
-- ============================================

-- Deletar usuário mal configurado (se existir)
DELETE FROM auth.identities
WHERE user_id IN (
  SELECT id FROM auth.users
  WHERE email = 'admin@maniafoods.com'
);

DELETE FROM public.employees
WHERE email = 'admin@maniafoods.com';

DELETE FROM auth.users
WHERE email = 'admin@maniafoods.com';

-- ============================================
-- 3. CRIAR ADMIN USANDO MÉTODO MAIS SIMPLES
-- ============================================

-- Opção A: Criar via Dashboard do Supabase (RECOMENDADO)
-- 1. Vá em: https://supabase.com/dashboard/project/vvqtgclprllryctavqal/auth/users
-- 2. Clique em "Add user" > "Create new user"
-- 3. Use:
--    Email: admin@maniafoods.com
--    Password: ManiaFoods123
--    Auto Confirm: ✅ Marcado
-- 4. Após criar, copie o ID do usuário
-- 5. Execute apenas este INSERT:

/*
INSERT INTO public.employees (name, email, role, user_id, company_id)
VALUES (
  'Admin Mania Foods',
  'admin@maniafoods.com',
  'admin',
  'COLE_AQUI_O_ID_DO_USER_CRIADO',  -- ⬅️ Cole o ID aqui
  'b1783e4d-f38c-46f6-ade9-10f8d63daa95'
);
*/

-- ============================================
-- Opção B: Criar usando função nativa do Supabase
-- ============================================

-- Esta é uma abordagem alternativa mais segura:
DO $$
DECLARE
  novo_user_id UUID;
BEGIN
  -- Usar a função auth.uid() para gerar um UUID válido
  novo_user_id := gen_random_uuid();

  -- Inserir diretamente com todos os campos necessários
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change,
    phone_change_token,
    reauthentication_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    novo_user_id,
    'authenticated',
    'authenticated',
    'admin@maniafoods.com',
    crypt('ManiaFoods123', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Admin Mania Foods"}'::jsonb,
    NOW(),
    NOW(),
    '',
    '',
    '',
    '',
    '',
    ''
  ) ON CONFLICT (email) DO NOTHING;

  -- Criar identidade
  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    novo_user_id,
    novo_user_id,
    jsonb_build_object(
      'sub', novo_user_id::text,
      'email', 'admin@maniafoods.com',
      'email_verified', true
    ),
    'email',
    NOW(),
    NOW(),
    NOW()
  ) ON CONFLICT DO NOTHING;

  -- Criar employee
  INSERT INTO public.employees (name, email, role, user_id, company_id)
  VALUES (
    'Admin Mania Foods',
    'admin@maniafoods.com',
    'admin',
    novo_user_id,
    'b1783e4d-f38c-46f6-ade9-10f8d63daa95'
  ) ON CONFLICT (email) DO UPDATE
    SET user_id = novo_user_id,
        company_id = 'b1783e4d-f38c-46f6-ade9-10f8d63daa95';

  RAISE NOTICE '✅ Usuário criado com ID: %', novo_user_id;
  RAISE NOTICE 'Email: admin@maniafoods.com';
  RAISE NOTICE 'Senha: ManiaFoods123';
END $$;

-- ============================================
-- 4. VERIFICAR SE FOI CRIADO CORRETAMENTE
-- ============================================

SELECT
  u.id,
  u.email,
  u.email_confirmed_at,
  u.created_at,
  e.company_id,
  c.name as company_name,
  c.subdomain
FROM auth.users u
LEFT JOIN public.employees e ON e.user_id = u.id
LEFT JOIN public.companies c ON c.id = e.company_id
WHERE u.email = 'admin@maniafoods.com';