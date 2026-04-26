-- Enforce system owner by fixed email and keep cashier creation scoped to shop admins.

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
