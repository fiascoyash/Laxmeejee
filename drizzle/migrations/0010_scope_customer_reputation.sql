CREATE OR REPLACE FUNCTION public.customer_reputation(_business_id uuid, _phone text)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r jsonb; p text := right(regexp_replace(coalesce(_phone,''),'\D','','g'),10);
BEGIN
  IF NOT public.is_business_member(_business_id) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pickup_orders WHERE business_id=_business_id AND right(regexp_replace(customer_phone,'\D','','g'),10)=p) THEN RETURN NULL; END IF;
  SELECT jsonb_build_object('orders', count(*), 'collected', count(*) FILTER (WHERE status='collected'),
    'customer_cancelled', count(*) FILTER (WHERE cancelled_by='customer'))
  INTO r FROM pickup_orders WHERE right(regexp_replace(customer_phone,'\D','','g'),10) = p;
  RETURN r;
END $function$;