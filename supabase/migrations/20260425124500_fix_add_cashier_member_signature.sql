-- Fix RPC signature mismatch for add_cashier_member in PostgREST schema cache.
-- The client is calling with named args: (_display_name, _email).

CREATE OR REPLACE FUNCTION public.add_cashier_member(
  _display_name TEXT DEFAULT NULL,
  _email TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester UUID := auth.uid();
  requester_shop UUID;
  requester_role public.shop_role;
  target_user UUID;
  existing_shop UUID;
  normalized_email TEXT := lower(trim(_email));
BEGIN
  IF requester IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  requester_shop := public.get_user_shop_id(requester);
  requester_role := public.get_user_shop_role(requester);

  IF requester_shop IS NULL OR requester_role <> 'admin' THEN
    RAISE EXCEPTION 'Only shop owners can add cashiers';
  END IF;

  IF normalized_email IS NULL OR normalized_email = '' THEN
    RAISE EXCEPTION 'Cashier email is required';
  END IF;

  IF normalized_email = 'sekhamane@digniholdings.com' THEN
    RAISE EXCEPTION 'System owner cannot be assigned as cashier';
  END IF;

  SELECT id INTO target_user
  FROM auth.users
  WHERE lower(email) = normalized_email
  LIMIT 1;

  IF target_user IS NULL THEN
    RAISE EXCEPTION 'No account found for this email. Ask cashier to sign up first.';
  END IF;

  IF target_user = requester THEN
    RAISE EXCEPTION 'You cannot add yourself as cashier';
  END IF;

  IF public.is_platform_admin(target_user) THEN
    RAISE EXCEPTION 'System owner cannot be assigned as cashier';
  END IF;

  SELECT shop_id INTO existing_shop
  FROM public.shop_members
  WHERE user_id = target_user
  LIMIT 1;

  IF existing_shop IS NOT NULL AND existing_shop <> requester_shop THEN
    RAISE EXCEPTION 'This user already belongs to another shop';
  END IF;

  INSERT INTO public.shop_members (shop_id, user_id, role, email, display_name)
  VALUES (
    requester_shop,
    target_user,
    'cashier',
    normalized_email,
    NULLIF(trim(_display_name), '')
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    shop_id = EXCLUDED.shop_id,
    role = 'cashier',
    email = EXCLUDED.email,
    display_name = COALESCE(EXCLUDED.display_name, public.shop_members.display_name);

  RETURN jsonb_build_object(
    'shop_id', requester_shop,
    'user_id', target_user,
    'role', 'cashier',
    'email', normalized_email
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_cashier_member(TEXT, TEXT) TO authenticated;

-- Refresh PostgREST schema cache immediately.
NOTIFY pgrst, 'reload schema';
