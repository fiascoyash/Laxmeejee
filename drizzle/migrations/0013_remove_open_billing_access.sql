DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['product_purchases','product_stock_movements','purchase_import_logs','invoice_payments'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "anon_select_%s" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "anon_insert_%s" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "anon_update_%s" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "anon_delete_%s" ON public.%I', t, t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
  END LOOP;
END $$;