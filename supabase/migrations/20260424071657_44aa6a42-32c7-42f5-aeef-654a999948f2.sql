CREATE OR REPLACE FUNCTION public.is_platform_admin(_uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1
    FROM auth.users
    WHERE id = _uid
      AND lower(email) = 'sekhamane@digniholdings.com'
  );
$$;