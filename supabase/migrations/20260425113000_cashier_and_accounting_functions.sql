-- Self-serve cashier linking and system-owner accounting books.
-- This migration is safe to run repeatedly.

CREATE OR REPLACE FUNCTION public.add_cashier_member(_email TEXT, _display_name TEXT DEFAULT NULL)
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

CREATE OR REPLACE FUNCTION public.get_system_accounting_books()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  month_start TIMESTAMPTZ := date_trunc('month', now());
  month_start_date DATE := date_trunc('month', now())::date;
  month_sales NUMERIC := 0;
  month_cogs NUMERIC := 0;
  month_expenses NUMERIC := 0;
  shop_books JSONB := '[]'::jsonb;
  entries JSONB := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT COALESCE(sum(total), 0)
  INTO month_sales
  FROM public.sales
  WHERE created_at >= month_start;

  SELECT COALESCE(sum(cost_price * quantity), 0)
  INTO month_cogs
  FROM public.sale_items
  WHERE created_at >= month_start;

  SELECT COALESCE(sum(amount), 0)
  INTO month_expenses
  FROM public.expenses
  WHERE expense_date >= month_start_date;

  SELECT COALESCE(jsonb_agg(to_jsonb(book_row) ORDER BY book_row.shop_name), '[]'::jsonb)
  INTO shop_books
  FROM (
    SELECT
      s.id AS shop_id,
      s.name AS shop_name,
      COALESCE(sa.sales_total, 0)::NUMERIC(12, 2) AS sales_total,
      COALESCE(si.cogs_total, 0)::NUMERIC(12, 2) AS cogs_total,
      COALESCE(ex.expense_total, 0)::NUMERIC(12, 2) AS expense_total,
      (
        COALESCE(sa.sales_total, 0)
        - COALESCE(si.cogs_total, 0)
        - COALESCE(ex.expense_total, 0)
      )::NUMERIC(12, 2) AS profit_total
    FROM public.shops s
    LEFT JOIN (
      SELECT shop_id, sum(total) AS sales_total
      FROM public.sales
      WHERE created_at >= month_start
      GROUP BY shop_id
    ) sa ON sa.shop_id = s.id
    LEFT JOIN (
      SELECT shop_id, sum(cost_price * quantity) AS cogs_total
      FROM public.sale_items
      WHERE created_at >= month_start
      GROUP BY shop_id
    ) si ON si.shop_id = s.id
    LEFT JOIN (
      SELECT shop_id, sum(amount) AS expense_total
      FROM public.expenses
      WHERE expense_date >= month_start_date
      GROUP BY shop_id
    ) ex ON ex.shop_id = s.id
  ) book_row;

  SELECT COALESCE(jsonb_agg(to_jsonb(entry_row) ORDER BY entry_row.entry_at DESC), '[]'::jsonb)
  INTO entries
  FROM (
    SELECT *
    FROM (
      SELECT
        sa.created_at AS entry_at,
        sh.name AS shop_name,
        'sale'::TEXT AS entry_type,
        sa.total::NUMERIC(12, 2) AS amount,
        NULL::TEXT AS category,
        sa.payment_method::TEXT AS reference
      FROM public.sales sa
      JOIN public.shops sh ON sh.id = sa.shop_id

      UNION ALL

      SELECT
        ex.expense_date::TIMESTAMP AS entry_at,
        sh.name AS shop_name,
        'expense'::TEXT AS entry_type,
        ex.amount::NUMERIC(12, 2) AS amount,
        ex.category,
        COALESCE(ex.description, '') AS reference
      FROM public.expenses ex
      JOIN public.shops sh ON sh.id = ex.shop_id
    ) all_entries
    ORDER BY entry_at DESC
    LIMIT 120
  ) entry_row;

  RETURN jsonb_build_object(
    'month_sales', month_sales,
    'month_cogs', month_cogs,
    'month_expenses', month_expenses,
    'month_profit', month_sales - month_cogs - month_expenses,
    'shop_books', shop_books,
    'entries', entries
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_system_accounting_books() TO authenticated;
