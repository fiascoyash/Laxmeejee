CREATE TYPE public.app_role AS ENUM ('admin','user');

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- roles
CREATE TABLE public.user_roles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, role public.app_role NOT NULL, UNIQUE(user_id, role));
GRANT SELECT ON public.user_roles TO authenticated; GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role) $$;
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

-- profiles
CREATE TABLE public.profiles (id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, full_name text, email text, avatar_url text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated; GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own profile select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, avatar_url)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'), NEW.email, NEW.raw_user_meta_data->>'avatar_url')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- owner-scoped tables
CREATE TABLE public.company_settings (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL UNIQUE, business_name text NOT NULL DEFAULT '', gstin text, address text, state text, phone text, email text, logo_url text, bank_details jsonb NOT NULL DEFAULT '{}'::jsonb, invoice_prefix text NOT NULL DEFAULT 'INV', extra jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.user_settings (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL UNIQUE, settings jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.customers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL, name text NOT NULL, phone text, email text, gstin text, address text, state text, balance numeric(14,2) NOT NULL DEFAULT 0, extra jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.suppliers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL, name text NOT NULL, phone text, email text, gstin text, address text, balance numeric(14,2) NOT NULL DEFAULT 0, extra jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.supplier_transactions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL, supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE, type text NOT NULL DEFAULT 'purchase', amount numeric(14,2) NOT NULL DEFAULT 0, txn_date date NOT NULL DEFAULT current_date, notes text, extra jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.products (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL, name text NOT NULL, sku text, hsn text, unit text DEFAULT 'pcs', price numeric(14,2) NOT NULL DEFAULT 0, purchase_price numeric(14,2) DEFAULT 0, gst_rate numeric(5,2) NOT NULL DEFAULT 0, stock numeric(14,3) NOT NULL DEFAULT 0, extra jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.invoices (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL, invoice_number text NOT NULL, customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL, customer_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb, invoice_date date NOT NULL DEFAULT current_date, due_date date, items jsonb NOT NULL DEFAULT '[]'::jsonb, subtotal numeric(14,2) NOT NULL DEFAULT 0, tax_total numeric(14,2) NOT NULL DEFAULT 0, discount numeric(14,2) NOT NULL DEFAULT 0, total numeric(14,2) NOT NULL DEFAULT 0, amount_paid numeric(14,2) NOT NULL DEFAULT 0, status text NOT NULL DEFAULT 'unpaid', notes text, extra jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(owner_id, invoice_number));
CREATE TABLE public.invoice_payments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL, invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE, amount numeric(14,2) NOT NULL DEFAULT 0, method text, paid_on date NOT NULL DEFAULT current_date, notes text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.quotations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL, quotation_number text NOT NULL, customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL, customer_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb, quotation_date date NOT NULL DEFAULT current_date, valid_until date, items jsonb NOT NULL DEFAULT '[]'::jsonb, subtotal numeric(14,2) NOT NULL DEFAULT 0, tax_total numeric(14,2) NOT NULL DEFAULT 0, total numeric(14,2) NOT NULL DEFAULT 0, status text NOT NULL DEFAULT 'draft', notes text, extra jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.quotation_templates (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL, name text NOT NULL, template jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['company_settings','user_settings','customers','suppliers','supplier_transactions','products','invoices','invoice_payments','quotations','quotation_templates'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE INDEX %I ON public.%I(owner_id)', t || '_owner_idx', t);
    EXECUTE format('CREATE POLICY "Owner select" ON public.%I FOR SELECT TO authenticated USING (auth.uid() = owner_id OR public.has_role(auth.uid(), ''admin''))', t);
    EXECUTE format('CREATE POLICY "Owner insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id)', t);
    EXECUTE format('CREATE POLICY "Owner update" ON public.%I FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id)', t);
    EXECUTE format('CREATE POLICY "Owner delete" ON public.%I FOR DELETE TO authenticated USING (auth.uid() = owner_id)', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', 'trg_' || t || '_updated', t);
  END LOOP;
END $$;