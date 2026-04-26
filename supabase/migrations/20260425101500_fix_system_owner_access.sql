-- Fix system owner access for existing databases.
-- This migration is idempotent and safe to run multiple times.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('system_owner');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
$$;

-- Backfill owner role for the one allowed owner email.
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'system_owner'::public.app_role
FROM auth.users
WHERE lower(email) = 'sekhamane@digniholdings.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Keep platform-admin checks working even if role backfill was missed.
CREATE OR REPLACE FUNCTION public.is_platform_admin(_uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_uid, 'system_owner'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM auth.users
      WHERE id = _uid
        AND lower(email) = 'sekhamane@digniholdings.com'
    );
$$;

-- Ensure new signups with owner email are promoted immediately.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE new_shop_id UUID;
BEGIN
  IF lower(NEW.email) = 'sekhamane@digniholdings.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'system_owner')
    ON CONFLICT (user_id, role) DO NOTHING;
    RETURN NEW;
  END IF;

  INSERT INTO public.shops (name, owner_id)
  VALUES (COALESCE(NEW.raw_user_meta_data->>'shop_name', 'My Shop'), NEW.id)
  RETURNING id INTO new_shop_id;

  INSERT INTO public.shop_members (shop_id, user_id, role, email, display_name)
  VALUES (
    new_shop_id,
    NEW.id,
    'admin',
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'display_name', NEW.email)
  );

  RETURN NEW;
END;
$$;
