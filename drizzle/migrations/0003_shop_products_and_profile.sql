ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS tagline text;

CREATE TABLE public.shop_products (
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE DEFAULT public.current_business_id(),
  product_id text NOT NULL,
  name text NOT NULL,
  category text,
  unit text,
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