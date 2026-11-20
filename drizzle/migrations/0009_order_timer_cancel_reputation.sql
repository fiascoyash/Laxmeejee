ALTER TABLE public.pickup_orders ADD COLUMN IF NOT EXISTS cancelled_by text, ADD COLUMN IF NOT EXISTS cancel_reason text, ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

CREATE OR REPLACE FUNCTION public.stamp_pickup_order_status()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'cancelled' THEN
      NEW.cancelled_at := now();
      IF NEW.cancelled_by IS NULL THEN NEW.cancelled_by := 'shop'; END IF;
    END IF;
    IF OLD.status = 'new' AND NEW.responded_at IS NULL AND coalesce(NEW.cancelled_by,'') <> 'customer' THEN NEW.responded_at := now(); END IF;
    IF NEW.status = 'accepted' AND NEW.accepted_at IS NULL THEN NEW.accepted_at := now(); END IF;
    IF NEW.status = 'ready' AND NEW.ready_at IS NULL THEN NEW.ready_at := now(); END IF;
    IF NEW.status = 'collected' THEN NEW.collected_at := now(); END IF;
    IF NEW.status <> 'cancelled' THEN NEW.cancelled_by := NULL; NEW.cancel_reason := NULL; NEW.cancelled_at := NULL; END IF;
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.cancel_pickup_order(_code text, _phone text, _reason text)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _id uuid;
BEGIN
  IF length(trim(coalesce(_reason,''))) < 3 OR length(_reason) > 300 THEN RAISE EXCEPTION 'Please tell the shop why you are cancelling'; END IF;
  IF length(regexp_replace(coalesce(_phone,''), '\D', '', 'g')) < 10 THEN RAISE EXCEPTION 'Invalid mobile number'; END IF;
  SELECT id INTO _id FROM pickup_orders
   WHERE order_code = upper(trim(_code))
     AND right(customer_phone,10) = right(regexp_replace(_phone,'\D','','g'),10)
     AND status IN ('new','accepted')
   ORDER BY created_at DESC LIMIT 1;
  IF _id IS NULL THEN RAISE EXCEPTION 'This order can no longer be cancelled'; END IF;
  UPDATE pickup_orders SET status='cancelled', cancelled_by='customer', cancel_reason=trim(_reason), updated_at=now() WHERE id=_id;
  RETURN true;
END $function$;
GRANT EXECUTE ON FUNCTION public.cancel_pickup_order(text,text,text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.track_pickup_order(_code text, _phone text)
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'order_code', o.order_code, 'status', o.status, 'items', o.items, 'total', o.total,
    'created_at', o.created_at, 'responded_at', o.responded_at, 'accepted_at', o.accepted_at,
    'ready_at', o.ready_at, 'collected_at', o.collected_at,
    'cancelled_by', o.cancelled_by, 'cancel_reason', o.cancel_reason, 'cancelled_at', o.cancelled_at,
    'shop_name', b.public_name, 'shop_slug', b.slug, 'shop_phone', b.phone, 'shop_address', b.address)
  FROM pickup_orders o JOIN businesses b ON b.id = o.business_id
  WHERE o.order_code = upper(trim(_code))
    AND right(o.customer_phone, 10) = right(regexp_replace(coalesce(_phone,''), '\D', '', 'g'), 10)
    AND length(regexp_replace(coalesce(_phone,''), '\D', '', 'g')) >= 10
  ORDER BY o.created_at DESC LIMIT 1
$function$;

CREATE OR REPLACE FUNCTION public.shop_response_stats()
 RETURNS TABLE(business_id uuid, responded integer, avg_minutes numeric, quick_share numeric)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT o.business_id, count(*) FILTER (WHERE o.responded_at IS NOT NULL)::int,
    round(avg(extract(epoch FROM (o.responded_at - o.created_at)) / 60)::numeric, 1),
    round(avg(CASE WHEN o.responded_at IS NOT NULL AND o.responded_at - o.created_at <= interval '15 minutes' THEN 1 ELSE 0 END)::numeric, 2)
  FROM pickup_orders o JOIN businesses b ON b.id = o.business_id AND b.is_published
  WHERE o.created_at > now() - interval '90 days'
    AND (o.responded_at IS NOT NULL OR o.created_at < now() - interval '15 minutes')
    AND NOT (o.cancelled_by = 'customer' AND o.responded_at IS NULL AND o.cancelled_at - o.created_at <= interval '15 minutes')
  GROUP BY o.business_id
  HAVING count(*) FILTER (WHERE o.responded_at IS NOT NULL) > 0
$function$;

CREATE OR REPLACE FUNCTION public.customer_reputation(_business_id uuid, _phone text)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r jsonb;
BEGIN
  IF NOT public.is_business_member(_business_id) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  SELECT jsonb_build_object('orders', count(*), 'collected', count(*) FILTER (WHERE status='collected'),
    'customer_cancelled', count(*) FILTER (WHERE cancelled_by='customer'))
  INTO r FROM pickup_orders
  WHERE right(regexp_replace(customer_phone,'\D','','g'),10) = right(regexp_replace(coalesce(_phone,''),'\D','','g'),10);
  RETURN r;
END $function$;
GRANT EXECUTE ON FUNCTION public.customer_reputation(uuid,text) TO authenticated;