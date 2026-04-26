
-- =====================================================================
-- StockMaster Pro — Initial schema
-- =====================================================================

-- ----- Enums -----
CREATE TYPE public.shop_role AS ENUM ('admin', 'cashier');
CREATE TYPE public.sub_status AS ENUM ('trial', 'active', 'expired', 'pending_verification');
CREATE TYPE public.payment_method AS ENUM ('cash', 'mpesa', 'ecocash', 'bank_transfer');
CREATE TYPE public.sub_plan AS ENUM ('monthly', 'yearly');
CREATE TYPE public.payment_status AS ENUM ('pending_verification', 'approved', 'rejected');

-- ----- Helper: updated_at trigger -----
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- =====================================================================
-- Tables
-- =====================================================================

CREATE TABLE public.shops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_status public.sub_status NOT NULL DEFAULT 'trial',
  trial_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expiry_date TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '14 days'),
  currency TEXT NOT NULL DEFAULT 'LSL',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER shops_set_updated_at BEFORE UPDATE ON public.shops
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.shop_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.shop_role NOT NULL DEFAULT 'cashier',
  email TEXT,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);
CREATE INDEX idx_shop_members_shop ON public.shop_members(shop_id);

CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  barcode TEXT,
  cost_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  selling_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 5,
  expiry_date DATE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_products_shop ON public.products(shop_id);
CREATE INDEX idx_products_barcode ON public.products(shop_id, barcode);
CREATE TRIGGER products_set_updated_at BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_suppliers_shop ON public.suppliers(shop_id);

CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  cashier_id UUID REFERENCES auth.users(id),
  customer_name TEXT,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method public.payment_method NOT NULL DEFAULT 'cash',
  payment_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sales_shop_date ON public.sales(shop_id, created_at DESC);

CREATE TABLE public.sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12,2) NOT NULL,
  cost_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  line_total NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sale_items_sale ON public.sale_items(sale_id);
CREATE INDEX idx_sale_items_shop ON public.sale_items(shop_id);

CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  description TEXT,
  amount NUMERIC(12,2) NOT NULL,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_expenses_shop_date ON public.expenses(shop_id, expense_date DESC);

CREATE TABLE public.subscription_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  submitted_by UUID REFERENCES auth.users(id),
  plan public.sub_plan NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  payment_method public.payment_method NOT NULL,
  reference_number TEXT,
  proof_url TEXT NOT NULL,
  status public.payment_status NOT NULL DEFAULT 'pending_verification',
  rejection_reason TEXT,
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_subpay_shop ON public.subscription_payments(shop_id);
CREATE INDEX idx_subpay_status ON public.subscription_payments(status);

-- =====================================================================
-- Helper functions (SECURITY DEFINER, no recursion)
-- =====================================================================

CREATE OR REPLACE FUNCTION public.get_user_shop_id(_uid UUID)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT shop_id FROM public.shop_members WHERE user_id = _uid LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_user_shop_role(_uid UUID)
RETURNS public.shop_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.shop_members WHERE user_id = _uid LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.shop_has_access(_shop UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.shops
    WHERE id = _shop
      AND subscription_status IN ('trial','active')
      AND expiry_date > now()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_platform_admin(_uid UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(
    SELECT 1 FROM auth.users WHERE id = _uid AND lower(email) = 'admin@stockmasterpro.ls'
  );
$$;

-- =====================================================================
-- Triggers: auto-create shop on signup, deduct stock on sale
-- =====================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_shop_id UUID;
BEGIN
  INSERT INTO public.shops (name, owner_id)
  VALUES (COALESCE(NEW.raw_user_meta_data->>'shop_name', 'My Shop'), NEW.id)
  RETURNING id INTO new_shop_id;

  INSERT INTO public.shop_members (shop_id, user_id, role, email, display_name)
  VALUES (new_shop_id, NEW.id, 'admin', NEW.email,
          COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));

  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.deduct_stock_on_sale()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.product_id IS NOT NULL THEN
    UPDATE public.products
       SET stock_quantity = GREATEST(0, stock_quantity - NEW.quantity)
     WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER on_sale_item_insert
AFTER INSERT ON public.sale_items
FOR EACH ROW EXECUTE FUNCTION public.deduct_stock_on_sale();

-- =====================================================================
-- Enable RLS
-- =====================================================================
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- RLS Policies
-- =====================================================================

-- shops
CREATE POLICY "Members view their shop" ON public.shops FOR SELECT TO authenticated
USING (id = public.get_user_shop_id(auth.uid()) OR public.is_platform_admin(auth.uid()));
CREATE POLICY "Owner updates shop" ON public.shops FOR UPDATE TO authenticated
USING (owner_id = auth.uid() OR public.is_platform_admin(auth.uid()))
WITH CHECK (owner_id = auth.uid() OR public.is_platform_admin(auth.uid()));

-- shop_members
CREATE POLICY "Members view shop roster" ON public.shop_members FOR SELECT TO authenticated
USING (shop_id = public.get_user_shop_id(auth.uid()) OR public.is_platform_admin(auth.uid()));
CREATE POLICY "Admin manages roster insert" ON public.shop_members FOR INSERT TO authenticated
WITH CHECK (shop_id = public.get_user_shop_id(auth.uid()) AND public.get_user_shop_role(auth.uid()) = 'admin');
CREATE POLICY "Admin manages roster update" ON public.shop_members FOR UPDATE TO authenticated
USING (shop_id = public.get_user_shop_id(auth.uid()) AND public.get_user_shop_role(auth.uid()) = 'admin');
CREATE POLICY "Admin manages roster delete" ON public.shop_members FOR DELETE TO authenticated
USING (shop_id = public.get_user_shop_id(auth.uid()) AND public.get_user_shop_role(auth.uid()) = 'admin');

-- products
CREATE POLICY "Members read products" ON public.products FOR SELECT TO authenticated
USING (shop_id = public.get_user_shop_id(auth.uid()));
CREATE POLICY "Admin inserts products" ON public.products FOR INSERT TO authenticated
WITH CHECK (shop_id = public.get_user_shop_id(auth.uid())
  AND public.get_user_shop_role(auth.uid()) = 'admin'
  AND public.shop_has_access(shop_id));
CREATE POLICY "Admin updates products" ON public.products FOR UPDATE TO authenticated
USING (shop_id = public.get_user_shop_id(auth.uid()) AND public.get_user_shop_role(auth.uid()) = 'admin');
CREATE POLICY "Admin deletes products" ON public.products FOR DELETE TO authenticated
USING (shop_id = public.get_user_shop_id(auth.uid()) AND public.get_user_shop_role(auth.uid()) = 'admin');

-- suppliers
CREATE POLICY "Members read suppliers" ON public.suppliers FOR SELECT TO authenticated
USING (shop_id = public.get_user_shop_id(auth.uid()));
CREATE POLICY "Admin inserts suppliers" ON public.suppliers FOR INSERT TO authenticated
WITH CHECK (shop_id = public.get_user_shop_id(auth.uid()) AND public.get_user_shop_role(auth.uid()) = 'admin');
CREATE POLICY "Admin updates suppliers" ON public.suppliers FOR UPDATE TO authenticated
USING (shop_id = public.get_user_shop_id(auth.uid()) AND public.get_user_shop_role(auth.uid()) = 'admin');
CREATE POLICY "Admin deletes suppliers" ON public.suppliers FOR DELETE TO authenticated
USING (shop_id = public.get_user_shop_id(auth.uid()) AND public.get_user_shop_role(auth.uid()) = 'admin');

-- sales (cashiers can insert, both roles read)
CREATE POLICY "Members read sales" ON public.sales FOR SELECT TO authenticated
USING (shop_id = public.get_user_shop_id(auth.uid()));
CREATE POLICY "Members insert sales" ON public.sales FOR INSERT TO authenticated
WITH CHECK (shop_id = public.get_user_shop_id(auth.uid()) AND public.shop_has_access(shop_id));

-- sale_items
CREATE POLICY "Members read sale items" ON public.sale_items FOR SELECT TO authenticated
USING (shop_id = public.get_user_shop_id(auth.uid()));
CREATE POLICY "Members insert sale items" ON public.sale_items FOR INSERT TO authenticated
WITH CHECK (shop_id = public.get_user_shop_id(auth.uid()) AND public.shop_has_access(shop_id));

-- expenses
CREATE POLICY "Members read expenses" ON public.expenses FOR SELECT TO authenticated
USING (shop_id = public.get_user_shop_id(auth.uid()));
CREATE POLICY "Admin inserts expenses" ON public.expenses FOR INSERT TO authenticated
WITH CHECK (shop_id = public.get_user_shop_id(auth.uid()) AND public.get_user_shop_role(auth.uid()) = 'admin');
CREATE POLICY "Admin updates expenses" ON public.expenses FOR UPDATE TO authenticated
USING (shop_id = public.get_user_shop_id(auth.uid()) AND public.get_user_shop_role(auth.uid()) = 'admin');
CREATE POLICY "Admin deletes expenses" ON public.expenses FOR DELETE TO authenticated
USING (shop_id = public.get_user_shop_id(auth.uid()) AND public.get_user_shop_role(auth.uid()) = 'admin');

-- subscription_payments
CREATE POLICY "Members read own payments" ON public.subscription_payments FOR SELECT TO authenticated
USING (shop_id = public.get_user_shop_id(auth.uid()) OR public.is_platform_admin(auth.uid()));
CREATE POLICY "Admin submits payment" ON public.subscription_payments FOR INSERT TO authenticated
WITH CHECK (shop_id = public.get_user_shop_id(auth.uid()) AND public.get_user_shop_role(auth.uid()) = 'admin');
CREATE POLICY "Platform admin updates payments" ON public.subscription_payments FOR UPDATE TO authenticated
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));

-- =====================================================================
-- Storage bucket: payment-proofs (private)
-- =====================================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('payment-proofs', 'payment-proofs', false)
ON CONFLICT (id) DO NOTHING;

-- Files are stored as `<shop_id>/<filename>`. Admin of that shop can write/read; platform admin can read.
CREATE POLICY "Shop admin uploads proof" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'payment-proofs'
  AND (storage.foldername(name))[1] = public.get_user_shop_id(auth.uid())::text
  AND public.get_user_shop_role(auth.uid()) = 'admin'
);
CREATE POLICY "Shop admin reads proof" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'payment-proofs'
  AND (
    (storage.foldername(name))[1] = public.get_user_shop_id(auth.uid())::text
    OR public.is_platform_admin(auth.uid())
  )
);
