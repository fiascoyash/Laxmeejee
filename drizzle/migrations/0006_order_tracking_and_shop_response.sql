ALTER TABLE public.pickup_orders
  ADD COLUMN IF NOT EXISTS responded_at timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS ready_at timestamptz,
  ADD COLUMN IF NOT EXISTS collected_at timestamptz;

CREATE INDEX IF NOT EXISTS pickup_orders_code_idx ON public.pickup_orders(order_code);

CREATE OR REPLACE FUNCTION public.stamp_pickup_order_status()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status = 'new' AND NEW.responded_at IS NULL THEN NEW.responded_at := now(); END IF;
    IF NEW.status = 'accepted' AND NEW.accepted_at IS NULL THEN NEW.accepted_at := now(); END IF;
    IF NEW.status = 'ready' AND NEW.ready_at IS NULL THEN NEW.ready_at := now(); END IF;
    IF NEW.status = 'collected' THEN NEW.collected_at := now(); END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS pickup_orders_stamp_status ON public.pickup_orders;
CREATE TRIGGER pickup_orders_stamp_status BEFORE UPDATE ON public.pickup_orders
  FOR EACH ROW EXECUTE FUNCTION public.stamp_pickup_order_status();

CREATE OR REPLACE FUNCTION public.track_pickup_order(_code text, _phone text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'order_code', o.order_code, 'status', o.status, 'items', o.items, 'total', o.total,
    'created_at', o.created_at, 'responded_at', o.responded_at, 'accepted_at', o.accepted_at,
    'ready_at', o.ready_at, 'collected_at', o.collected_at,
    'shop_name', b.public_name, 'shop_slug', b.slug, 'shop_phone', b.phone, 'shop_address', b.address)
  FROM pickup_orders o JOIN businesses b ON b.id = o.business_id
  WHERE o.order_code = upper(trim(_code))
    AND right(o.customer_phone, 10) = right(regexp_replace(coalesce(_phone,''), '\D', '', 'g'), 10)
    AND length(regexp_replace(coalesce(_phone,''), '\D', '', 'g')) >= 10
  ORDER BY o.created_at DESC LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.shop_response_stats()
RETURNS TABLE(business_id uuid, responded integer, avg_minutes numeric, quick_share numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT o.business_id, count(*)::int,
    round(avg(extract(epoch FROM (o.responded_at - o.created_at)) / 60)::numeric, 1),
    round(avg(CASE WHEN o.responded_at - o.created_at <= interval '15 minutes' THEN 1 ELSE 0 END)::numeric, 2)
  FROM pickup_orders o JOIN businesses b ON b.id = o.business_id AND b.is_published
  WHERE o.responded_at IS NOT NULL AND o.created_at > now() - interval '90 days'
  GROUP BY o.business_id
$$;

REVOKE ALL ON FUNCTION public.track_pickup_order(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.shop_response_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_pickup_order(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_response_stats() TO anon, authenticated;