-- Script para corrigir o usuário admin no Supabase
-- Execute este SQL no SQL Editor do Supabase

-- 1. Primeiro, vamos verificar se o usuário admin existe no auth.users
DO $$
DECLARE
  admin_user_id UUID;
BEGIN
  -- Buscar o ID do usuário admin no auth.users
  SELECT id INTO admin_user_id
  FROM auth.users
  WHERE email = 'admin@assiny.com';

  IF admin_user_id IS NOT NULL THEN
    RAISE NOTICE 'Usuário admin encontrado com ID: %', admin_user_id;

    -- 2. Verificar se já existe um registro na tabela users pública
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = admin_user_id) THEN
      RAISE NOTICE 'Criando registro na tabela users...';

      -- 3. Criar registro na tabela users com role = 'admin'
      INSERT INTO public.users (id, email, name, role)
      VALUES (
        admin_user_id,
        'admin@assiny.com',
        'Admin',
        'admin'
      );

      RAISE NOTICE 'Registro criado com sucesso!';
    ELSE
      RAISE NOTICE 'Atualizando role do usuário para admin...';

      -- 4. Se já existe, garantir que o role está correto
      UPDATE public.users
      SET role = 'admin',
          name = COALESCE(name, 'Admin')
      WHERE id = admin_user_id;

      RAISE NOTICE 'Role atualizado com sucesso!';
    END IF;

    -- 5. Atualizar também o raw_user_meta_data no auth.users para incluir o role
    UPDATE auth.users
    SET raw_user_meta_data = jsonb_set(
      COALESCE(raw_user_meta_data, '{}'::jsonb),
      '{role}',
      '"admin"'
    )
    WHERE id = admin_user_id;

    RAISE NOTICE 'Metadata do usuário atualizado com role admin!';

  ELSE
    RAISE NOTICE 'Usuário admin não encontrado! Execute primeiro o script criar-usuario-admin.sql';
  END IF;
END $$;

-- 6. Verificar o resultado
SELECT
  au.id,
  au.email,
  au.raw_user_meta_data,
  u.role as users_table_role,
  u.name as users_table_name
FROM auth.users au
LEFT JOIN public.users u ON u.id = au.id
WHERE au.email = 'admin@assiny.com';

-- 7. Verificar também outros usuários para comparação
SELECT
  au.email,
  au.raw_user_meta_data->>'role' as auth_role,
  u.role as users_table_role,
  CASE
    WHEN u.id IS NULL THEN 'SEM REGISTRO NA TABELA USERS'
    ELSE 'OK'
  END as status
FROM auth.users au
LEFT JOIN public.users u ON u.id = au.id
ORDER BY au.created_at DESC
LIMIT 10;