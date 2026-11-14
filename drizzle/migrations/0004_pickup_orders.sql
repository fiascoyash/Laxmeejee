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