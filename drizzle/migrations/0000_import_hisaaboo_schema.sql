CREATE TABLE public.businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])$'),
  public_name text NOT NULL CHECK (length(trim(public_name)) BETWEEN 2 AND 100),
  category text, city text, locality text, address text, phone text, hours text, tagline text,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TYPE public.business_role AS ENUM ('owner','manager','staff');
CREATE TABLE public.business_members (
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.business_role NOT NULL DEFAULT 'staff',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (business_id, user_id)
);
CREATE INDEX idx_business_members_user ON public.business_members(user_id);
GRANT SELECT ON public.businesses TO anon;
GRANT SELECT, UPDATE ON public.businesses TO authenticated;
GRANT ALL ON public.businesses TO service_role;
GRANT SELECT ON public.business_members TO authenticated;
GRANT ALL ON public.business_members TO service_role;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_members ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.is_business_member(_business_id uuid, _roles public.business_role[] DEFAULT ARRAY['owner','manager','staff']::public.business_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.business_members WHERE business_id = _business_id AND user_id = auth.uid() AND role = ANY(_roles))
$$;
CREATE FUNCTION public.current_business_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT business_id FROM public.business_members WHERE user_id = auth.uid() ORDER BY created_at LIMIT 1
$$;

CREATE POLICY "Published shops are public" ON public.businesses FOR SELECT TO anon, authenticated USING (is_published);
CREATE POLICY "Members read their shop" ON public.businesses FOR SELECT TO authenticated USING (public.is_business_member(id));
CREATE POLICY "Owners and managers edit shop" ON public.businesses FOR UPDATE TO authenticated
  USING (public.is_business_member(id, ARRAY['owner','manager']::public.business_role[]))
  WITH CHECK (public.is_business_member(id, ARRAY['owner','manager']::public.business_role[]));
CREATE POLICY "Members read own memberships" ON public.business_members FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE FUNCTION public.create_business(_public_name text, _slug text, _city text DEFAULT NULL, _locality text DEFAULT NULL, _category text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  IF EXISTS (SELECT 1 FROM public.business_members WHERE user_id = auth.uid()) THEN RAISE EXCEPTION 'You already have a business'; END IF;
  INSERT INTO public.businesses (public_name, slug, city, locality, category)
  VALUES (trim(_public_name), lower(trim(_slug)), NULLIF(trim(_city),''), NULLIF(trim(_locality),''), NULLIF(trim(_category),''))
  RETURNING id INTO new_id;
  INSERT INTO public.business_members (business_id, user_id, role) VALUES (new_id, auth.uid(), 'owner');
  RETURN new_id;
END $$;
REVOKE ALL ON FUNCTION public.create_business(text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_business(text,text,text,text,text) TO authenticated;

CREATE TABLE public.product_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id text NOT NULL,
  supplier_name text,
  quantity integer NOT NULL,
  purchase_price numeric NOT NULL,
  total_value numeric GENERATED ALWAYS AS (quantity * purchase_price) STORED,
  purchase_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz DEFAULT now(),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  quantity_added numeric,
  total_purchase_cost numeric GENERATED ALWAYS AS (COALESCE(quantity_added, quantity) * purchase_price) STORED
);
CREATE TABLE public.product_stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id text NOT NULL,
  movement_type text NOT NULL CHECK (movement_type IN ('purchase','sale','adjustment','return')),
  quantity_change integer NOT NULL,
  balance_after integer NOT NULL,
  reference_type text, reference_id text, notes text,
  created_at timestamptz DEFAULT now(),
  quantity_delta numeric, stock_balance numeric
);
CREATE TABLE public.purchase_import_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_date timestamptz NOT NULL DEFAULT now(),
  imported_by text,
  file_name text NOT NULL,
  format text NOT NULL CHECK (format IN ('csv','xlsx','pdf')),
  supplier_id text, supplier_name text, invoice_number text,
  products_imported integer NOT NULL DEFAULT 0,
  total_value numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'success' CHECK (status IN ('success','partial','failed')),
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  rows jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.invoice_payments (
  id text PRIMARY KEY,
  invoice_id text NOT NULL,
  date date NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  mode text NOT NULL DEFAULT 'cash',
  reference text, notes text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_purchases_product_id ON public.product_purchases(product_id);
CREATE INDEX idx_purchases_date ON public.product_purchases(purchase_date DESC);
CREATE INDEX idx_movements_product_id ON public.product_stock_movements(product_id);
CREATE INDEX idx_movements_date ON public.product_stock_movements(created_at DESC);
CREATE INDEX idx_purchase_import_logs_date ON public.purchase_import_logs(import_date DESC);
CREATE INDEX idx_purchase_import_logs_supplier ON public.purchase_import_logs(supplier_id);
CREATE INDEX idx_purchase_import_logs_invoice ON public.purchase_import_logs(invoice_number);
CREATE INDEX idx_invoice_payments_invoice_id ON public.invoice_payments(invoice_id);
CREATE INDEX idx_invoice_payments_date ON public.invoice_payments(date);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['product_purchases','product_stock_movements','purchase_import_logs','invoice_payments'] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN business_id uuid NOT NULL DEFAULT public.current_business_id() REFERENCES public.businesses(id) ON DELETE CASCADE', t);
    EXECUTE format('CREATE INDEX ON public.%I(business_id)', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "members_select_%s" ON public.%I FOR SELECT TO authenticated USING (public.is_business_member(business_id))', t, t);
    EXECUTE format('CREATE POLICY "members_insert_%s" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_business_member(business_id))', t, t);
    EXECUTE format('CREATE POLICY "members_update_%s" ON public.%I FOR UPDATE TO authenticated USING (public.is_business_member(business_id)) WITH CHECK (public.is_business_member(business_id))', t, t);
    EXECUTE format('CREATE POLICY "members_delete_%s" ON public.%I FOR DELETE TO authenticated USING (public.is_business_member(business_id))', t, t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.record_product_stock_purchase(payload jsonb) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE op uuid := (payload->>'id')::uuid; qty numeric := (payload->>'quantity')::numeric; price numeric := (payload->>'purchasePrice')::numeric; balance numeric := (payload->>'balanceAfter')::numeric; existing public.product_purchases;
BEGIN
  IF qty IS NULL OR qty <= 0 OR qty::text IN ('NaN','Infinity','-Infinity') OR price IS NULL OR price < 0 OR price::text IN ('NaN','Infinity','-Infinity') OR balance IS NULL OR balance::text IN ('NaN','Infinity','-Infinity') OR NULLIF(payload->>'productId','') IS NULL THEN RAISE EXCEPTION 'Invalid quantity, price or product'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(op::text, 0));
  SELECT * INTO existing FROM public.product_purchases WHERE id = op;
  IF FOUND THEN
    IF existing.product_id <> payload->>'productId' OR COALESCE(existing.quantity_added,existing.quantity) <> qty OR existing.purchase_price <> price THEN RAISE EXCEPTION 'Operation already exists with different values'; END IF;
    RETURN;
  END IF;
  INSERT INTO public.product_purchases (id, product_id, supplier_name, quantity, quantity_added, purchase_price, purchase_date, notes, details, created_at)
  VALUES (op, payload->>'productId', NULLIF(payload->>'supplierName',''), trunc(qty)::integer, qty, price, (payload->>'purchaseDate')::date, NULLIF(payload->>'notes',''), COALESCE(payload->'details','{}'::jsonb), (payload->>'createdAt')::timestamptz);
  INSERT INTO public.product_stock_movements (id, product_id, movement_type, quantity_change, quantity_delta, balance_after, stock_balance, reference_type, reference_id, notes, created_at)
  VALUES (op, payload->>'productId', 'purchase', trunc(qty)::integer, qty, trunc(balance)::integer, balance, 'purchase', op::text, NULLIF(payload->>'notes',''), (payload->>'createdAt')::timestamptz);
END $$;
REVOKE ALL ON FUNCTION public.record_product_stock_purchase(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_product_stock_purchase(jsonb) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.is_business_member(uuid, public.business_role[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_business_member(uuid, public.business_role[]) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.current_business_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_business_id() TO authenticated;

CREATE TABLE public.shop_products (
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE DEFAULT public.current_business_id(),
  product_id text NOT NULL,
  name text NOT NULL,
  category text, unit text,
  price numeric NOT NULL DEFAULT 0,
  description text,
  in_stock boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (business_id, product_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_products TO authenticated;
GRANT SELECT ON public.shop_products TO anon;
GRANT ALL ON public.shop_products TO service_role;
ALTER TABLE public.shop_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage shop products" ON public.shop_products FOR ALL TO authenticated
  USING (public.is_business_member(business_id, ARRAY['owner'::business_role,'manager'::business_role]))
  WITH CHECK (public.is_business_member(business_id, ARRAY['owner'::business_role,'manager'::business_role]));
CREATE POLICY "Members read shop products" ON public.shop_products FOR SELECT TO authenticated
  USING (public.is_business_member(business_id));
CREATE POLICY "Published shop products are public" ON public.shop_products FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.is_published));

CREATE TABLE public.pickup_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  order_code text NOT NULL,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  note text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  total numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','accepted','ready','collected','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pickup_orders_business_idx ON public.pickup_orders(business_id, created_at DESC);
GRANT SELECT, UPDATE ON public.pickup_orders TO authenticated;
GRANT ALL ON public.pickup_orders TO service_role;
ALTER TABLE public.pickup_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read pickup orders" ON public.pickup_orders FOR SELECT TO authenticated USING (public.is_business_member(business_id));
CREATE POLICY "Members update pickup orders" ON public.pickup_orders FOR UPDATE TO authenticated USING (public.is_business_member(business_id)) WITH CHECK (public.is_business_member(business_id));

CREATE OR REPLACE FUNCTION public.place_pickup_order(_slug text, _name text, _phone text, _note text, _items jsonb)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _biz uuid; _line jsonb; _p record; _qty numeric; _out jsonb := '[]'::jsonb; _total numeric := 0; _code text;
BEGIN
  SELECT id INTO _biz FROM businesses WHERE slug = lower(_slug) AND is_published;
  IF _biz IS NULL THEN RAISE EXCEPTION 'Shop not available'; END IF;
  IF length(trim(coalesce(_name,''))) < 2 OR length(_name) > 80 THEN RAISE EXCEPTION 'Please enter your name'; END IF;
  IF regexp_replace(coalesce(_phone,''), '\D', '', 'g') !~ '^(91)?[6-9][0-9]{9}$' THEN RAISE EXCEPTION 'Please enter a valid 10-digit mobile number'; END IF;
  IF length(coalesce(_note,'')) > 500 THEN RAISE EXCEPTION 'Note is too long'; END IF;
  IF jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) = 0 OR jsonb_array_length(_items) > 50 THEN RAISE EXCEPTION 'Add at least one product'; END IF;
  FOR _line IN SELECT * FROM jsonb_array_elements(_items) LOOP
    _qty := (_line->>'qty')::numeric;
    IF _qty IS NULL OR _qty <= 0 OR _qty > 10000 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;
    SELECT name, unit, price, in_stock INTO _p FROM shop_products WHERE business_id = _biz AND product_id = _line->>'product_id';
    IF NOT FOUND OR NOT _p.in_stock THEN RAISE EXCEPTION 'A product is no longer available'; END IF;
    _out := _out || jsonb_build_object('product_id', _line->>'product_id', 'name', _p.name, 'unit', _p.unit, 'price', _p.price, 'qty', _qty);
    _total := _total + _p.price * _qty;
  END LOOP;
  _code := upper(substr(md5(gen_random_uuid()::text), 1, 6));
  INSERT INTO pickup_orders(business_id, order_code, customer_name, customer_phone, note, items, total)
  VALUES (_biz, _code, trim(_name), regexp_replace(_phone, '\D', '', 'g'), nullif(trim(coalesce(_note,'')),''), _out, _total);
  RETURN _code;
END $$;
REVOKE ALL ON FUNCTION public.place_pickup_order(text,text,text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_pickup_order(text,text,text,text,jsonb) TO anon, authenticated;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pickup_orders;