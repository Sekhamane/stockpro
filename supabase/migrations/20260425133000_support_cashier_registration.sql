-- Support cashier self-registration without creating a new shop.
-- Cashier accounts can later be linked by a shop admin using add_cashier_member.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_shop_id UUID;
  account_type TEXT := lower(COALESCE(NEW.raw_user_meta_data->>'account_type', ''));
BEGIN
  IF lower(NEW.email) = 'sekhamane@digniholdings.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'system_owner')
    ON CONFLICT (user_id, role) DO NOTHING;
    RETURN NEW;
  END IF;

  IF account_type = 'cashier' THEN
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
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'display_name',
      NEW.email
    )
  );

  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
