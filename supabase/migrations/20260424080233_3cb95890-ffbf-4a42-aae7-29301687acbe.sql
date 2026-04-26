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

CREATE OR REPLACE FUNCTION public.is_platform_admin(_uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_uid, 'system_owner'::public.app_role);
$$;

DROP POLICY IF EXISTS "System owners view roles" ON public.user_roles;
CREATE POLICY "System owners view roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'system_owner'::public.app_role));

DROP POLICY IF EXISTS "System owners manage roles" ON public.user_roles;
CREATE POLICY "System owners manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'system_owner'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'system_owner'::public.app_role));

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
  VALUES (new_shop_id, NEW.id, 'admin', NEW.email,
          COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'display_name', NEW.email));

  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS "Members view their shop" ON public.shops;
CREATE POLICY "Members view their shop"
ON public.shops
FOR SELECT
TO authenticated
USING ((id = public.get_user_shop_id(auth.uid())) OR public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Owner updates shop" ON public.shops;
CREATE POLICY "Owner updates shop"
ON public.shops
FOR UPDATE
TO authenticated
USING ((owner_id = auth.uid()) OR public.is_platform_admin(auth.uid()))
WITH CHECK ((owner_id = auth.uid()) OR public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Members view shop roster" ON public.shop_members;
CREATE POLICY "Members view shop roster"
ON public.shop_members
FOR SELECT
TO authenticated
USING ((shop_id = public.get_user_shop_id(auth.uid())) OR public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Members read own payments" ON public.subscription_payments;
CREATE POLICY "Members read own payments"
ON public.subscription_payments
FOR SELECT
TO authenticated
USING ((shop_id = public.get_user_shop_id(auth.uid())) OR public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Platform admin updates payments" ON public.subscription_payments;
CREATE POLICY "Platform admin updates payments"
ON public.subscription_payments
FOR UPDATE
TO authenticated
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));