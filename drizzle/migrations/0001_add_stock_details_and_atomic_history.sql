ALTER TABLE public.product_purchases ADD COLUMN details jsonb NOT NULL DEFAULT '{}'::jsonb, ADD COLUMN quantity_added numeric, ADD COLUMN total_purchase_cost numeric GENERATED ALWAYS AS (COALESCE(quantity_added, quantity) * purchase_price) STORED;
ALTER TABLE public.product_stock_movements ADD COLUMN quantity_delta numeric, ADD COLUMN stock_balance numeric;
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
REVOKE ALL ON FUNCTION public.record_product_stock_purchase(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_product_stock_purchase(jsonb) TO anon, authenticated, service_role;
COMMENT ON FUNCTION public.record_product_stock_purchase(jsonb) IS 'Add Stock only: idempotent atomic purchase and movement records; invoker permissions and RLS preserved. Catalog remains browser-local.';