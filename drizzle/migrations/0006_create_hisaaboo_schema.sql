DO $$
DECLARE f RECORD;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure::text AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('is_business_member', 'current_business_id', 'create_business', 'place_pickup_order')
  LOOP
    EXECUTE 'DROP FUNCTION ' || f.sig || ' CASCADE';
  END LOOP;
END;
$$;

CREATE TABLE IF NOT EXISTS public.businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  public_name text NOT NULL,
  is_published boolean NOT NULL DEFAULT false,
  category text,
  city text,
  locality text,
  address text,
  phone text,
  hours text,
  tagline text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.business_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'owner',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.shop_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  product_id text NOT NULL,
  name text NOT NULL,
  category text,
  unit text,
  price numeric NOT NULL DEFAULT 0,
  description text,
  in_stock boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, product_id)
);

CREATE TABLE IF NOT EXISTS public.pickup_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  order_code text NOT NULL,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  note text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  total numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.invoice_payments (
  id text PRIMARY KEY,
  business_id uuid,
  invoice_id text NOT NULL,
  date text,
  amount numeric NOT NULL DEFAULT 0,
  mode text,
  reference text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.product_purchases (
  id text PRIMARY KEY,
  business_id uuid,
  product_id text NOT NULL,
  supplier_name text,
  quantity numeric,
  quantity_added numeric,
  purchase_price numeric,
  total_value numeric,
  total_purchase_cost numeric,
  purchase_date text,
  notes text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.product_stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid,
  product_id text NOT NULL,
  movement_type text NOT NULL,
  quantity_change numeric NOT NULL DEFAULT 0,
  balance_after numeric,
  reference_type text,
  reference_id text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.purchase_import_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid,
  import_date timestamptz,
  imported_by text,
  file_name text,
  format text,
  supplier_id text,
  supplier_name text,
  invoice_number text,
  products_imported integer,
  total_value numeric,
  status text,
  errors jsonb,
  rows jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE FUNCTION public.is_business_member(_business_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.business_members
    WHERE business_id = _business_id AND user_id = auth.uid()
  );
$$;

CREATE FUNCTION public.current_business_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT business_id FROM public.business_members
  WHERE user_id = auth.uid() ORDER BY created_at LIMIT 1;
$$;

ALTER TABLE public.shop_products ALTER COLUMN business_id SET DEFAULT public.current_business_id();
ALTER TABLE public.invoice_payments ALTER COLUMN business_id SET DEFAULT public.current_business_id();
ALTER TABLE public.product_purchases ALTER COLUMN business_id SET DEFAULT public.current_business_id();
ALTER TABLE public.product_stock_movements ALTER COLUMN business_id SET DEFAULT public.current_business_id();
ALTER TABLE public.purchase_import_logs ALTER COLUMN business_id SET DEFAULT public.current_business_id();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.businesses TO authenticated;
GRANT SELECT ON public.businesses TO anon;
GRANT ALL ON public.businesses TO service_role;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Published shops are public, members see their own" ON public.businesses;
CREATE POLICY "Published shops are public, members see their own"
  ON public.businesses FOR SELECT
  USING (is_published OR public.is_business_member(id));
DROP POLICY IF EXISTS "Members can update their business" ON public.businesses;
CREATE POLICY "Members can update their business"
  ON public.businesses FOR UPDATE TO authenticated
  USING (public.is_business_member(id))
  WITH CHECK (public.is_business_member(id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_members TO authenticated;
GRANT ALL ON public.business_members TO service_role;
ALTER TABLE public.business_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can see their own memberships" ON public.business_members;
CREATE POLICY "Members can see their own memberships"
  ON public.business_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_business_member(business_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_products TO authenticated;
GRANT SELECT ON public.shop_products TO anon;
GRANT ALL ON public.shop_products TO service_role;
ALTER TABLE public.shop_products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Products of published shops are public, members see their own" ON public.shop_products;
CREATE POLICY "Products of published shops are public, members see their own"
  ON public.shop_products FOR SELECT
  USING (
    public.is_business_member(business_id)
    OR EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.is_published)
  );
DROP POLICY IF EXISTS "Members manage their catalogue" ON public.shop_products;
CREATE POLICY "Members manage their catalogue"
  ON public.shop_products FOR INSERT TO authenticated
  WITH CHECK (public.is_business_member(business_id));
DROP POLICY IF EXISTS "Members update their catalogue" ON public.shop_products;
CREATE POLICY "Members update their catalogue"
  ON public.shop_products FOR UPDATE TO authenticated
  USING (public.is_business_member(business_id))
  WITH CHECK (public.is_business_member(business_id));
DROP POLICY IF EXISTS "Members delete from their catalogue" ON public.shop_products;
CREATE POLICY "Members delete from their catalogue"
  ON public.shop_products FOR DELETE TO authenticated
  USING (public.is_business_member(business_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pickup_orders TO authenticated;
GRANT ALL ON public.pickup_orders TO service_role;
ALTER TABLE public.pickup_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members see their orders" ON public.pickup_orders;
CREATE POLICY "Members see their orders"
  ON public.pickup_orders FOR SELECT TO authenticated
  USING (public.is_business_member(business_id));
DROP POLICY IF EXISTS "Members update their orders" ON public.pickup_orders;
CREATE POLICY "Members update their orders"
  ON public.pickup_orders FOR UPDATE TO authenticated
  USING (public.is_business_member(business_id))
  WITH CHECK (public.is_business_member(business_id));

CREATE FUNCTION public.create_business(
  _public_name text, _slug text, _city text, _locality text, _category text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;
  INSERT INTO public.businesses (slug, public_name, city, locality, category)
  VALUES (lower(trim(_slug)), trim(_public_name), nullif(trim(_city), ''), nullif(trim(_locality), ''), nullif(trim(_category), ''))
  RETURNING id INTO _id;
  INSERT INTO public.business_members (business_id, user_id, role)
  VALUES (_id, auth.uid(), 'owner');
  RETURN _id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_business(text, text, text, text, text) TO authenticated;

CREATE FUNCTION public.place_pickup_order(
  _slug text, _name text, _phone text, _note text, _items jsonb
)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _b public.businesses%ROWTYPE;
  _code text;
  _total numeric := 0;
  _line jsonb;
  _p RECORD;
  _qty numeric;
  _items_out jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO _b FROM public.businesses
  WHERE slug = lower(trim(_slug)) AND is_published;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shop not found';
  END IF;
  IF jsonb_typeof(_items) IS DISTINCT FROM 'array' OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'No items in order';
  END IF;
  IF jsonb_array_length(_items) > 50 THEN
    RAISE EXCEPTION 'Too many items in order';
  END IF;
  FOR _line IN SELECT * FROM jsonb_array_elements(_items) LOOP
    SELECT * INTO _p FROM public.shop_products
    WHERE business_id = _b.id AND product_id = _line->>'product_id' AND in_stock;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Item unavailable: %', _line->>'product_id';
    END IF;
    _qty := greatest(1, least(999, floor(coalesce((_line->>'qty')::numeric, 1))));
    _total := _total + _p.price * _qty;
    _items_out := _items_out || jsonb_build_object(
      'product_id', _p.product_id, 'name', _p.name,
      'qty', _qty, 'price', _p.price, 'unit', _p.unit
    );
  END LOOP;
  _code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  INSERT INTO public.pickup_orders (business_id, order_code, customer_name, customer_phone, note, items, total)
  VALUES (
    _b.id, _code,
    left(trim(_name), 80), left(trim(_phone), 14),
    nullif(left(trim(coalesce(_note, '')), 500), ''),
    _items_out, _total
  );
  RETURN _code;
END;
$$;
GRANT EXECUTE ON FUNCTION public.place_pickup_order(text, text, text, text, jsonb) TO anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'pickup_orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pickup_orders;
  END IF;
END;
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_payments TO authenticated, anon;
GRANT ALL ON public.invoice_payments TO service_role;
ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Billing app syncs invoice payments" ON public.invoice_payments;
CREATE POLICY "Billing app syncs invoice payments"
  ON public.invoice_payments FOR ALL
  USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_purchases TO authenticated, anon;
GRANT ALL ON public.product_purchases TO service_role;
ALTER TABLE public.product_purchases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Billing app syncs product purchases" ON public.product_purchases;
CREATE POLICY "Billing app syncs product purchases"
  ON public.product_purchases FOR ALL
  USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_stock_movements TO authenticated, anon;
GRANT ALL ON public.product_stock_movements TO service_role;
ALTER TABLE public.product_stock_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Billing app syncs stock movements" ON public.product_stock_movements;
CREATE POLICY "Billing app syncs stock movements"
  ON public.product_stock_movements FOR ALL
  USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_import_logs TO authenticated, anon;
GRANT ALL ON public.purchase_import_logs TO service_role;
ALTER TABLE public.purchase_import_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Billing app syncs import logs" ON public.purchase_import_logs;
CREATE POLICY "Billing app syncs import logs"
  ON public.purchase_import_logs FOR ALL
  USING (true) WITH CHECK (true);