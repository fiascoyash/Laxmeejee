CREATE TABLE public.businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])$'),
  public_name text NOT NULL CHECK (length(trim(public_name)) BETWEEN 2 AND 100),
  category text,
  city text,
  locality text,
  address text,
  phone text,
  hours text,
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

DO $$
DECLARE t text; p record;
BEGIN
  FOREACH t IN ARRAY ARRAY['product_purchases','product_stock_movements','purchase_import_logs','invoice_payments'] LOOP
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
    END LOOP;
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
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

REVOKE EXECUTE ON FUNCTION public.record_product_stock_purchase(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_product_stock_purchase(jsonb) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.is_business_member(uuid, public.business_role[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_business_member(uuid, public.business_role[]) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.current_business_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_business_id() TO authenticated;