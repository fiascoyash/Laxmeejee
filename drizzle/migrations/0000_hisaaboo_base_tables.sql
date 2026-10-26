CREATE TABLE IF NOT EXISTS public.product_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id text NOT NULL,
  supplier_name text,
  quantity integer NOT NULL,
  purchase_price numeric NOT NULL,
  total_value numeric GENERATED ALWAYS AS (quantity * purchase_price) STORED,
  purchase_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.product_stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id text NOT NULL,
  movement_type text NOT NULL CHECK (movement_type IN ('purchase','sale','adjustment','return')),
  quantity_change integer NOT NULL,
  balance_after integer NOT NULL,
  reference_type text,
  reference_id text,
  notes text,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.purchase_import_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_date timestamptz NOT NULL DEFAULT now(),
  imported_by text,
  file_name text NOT NULL,
  format text NOT NULL CHECK (format IN ('csv','xlsx','pdf')),
  supplier_id text,
  supplier_name text,
  invoice_number text,
  products_imported integer NOT NULL DEFAULT 0,
  total_value numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'success' CHECK (status IN ('success','partial','failed')),
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  rows jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.invoice_payments (
  id text PRIMARY KEY,
  invoice_id text NOT NULL,
  date date NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  mode text NOT NULL DEFAULT 'cash',
  reference text,
  notes text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_purchases_product_id ON public.product_purchases(product_id);
CREATE INDEX IF NOT EXISTS idx_purchases_date ON public.product_purchases(purchase_date DESC);
CREATE INDEX IF NOT EXISTS idx_movements_product_id ON public.product_stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_movements_date ON public.product_stock_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_import_logs_date ON public.purchase_import_logs(import_date DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_import_logs_supplier ON public.purchase_import_logs(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_import_logs_invoice ON public.purchase_import_logs(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice_id ON public.invoice_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_date ON public.invoice_payments(date);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['product_purchases','product_stock_movements','purchase_import_logs','invoice_payments'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "anon_select_%s" ON public.%I FOR SELECT TO anon, authenticated USING (true)', t, t);
    EXECUTE format('CREATE POLICY "anon_insert_%s" ON public.%I FOR INSERT TO anon, authenticated WITH CHECK (true)', t, t);
    EXECUTE format('CREATE POLICY "anon_update_%s" ON public.%I FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true)', t, t);
    EXECUTE format('CREATE POLICY "anon_delete_%s" ON public.%I FOR DELETE TO anon, authenticated USING (true)', t, t);
  END LOOP;
END $$;