CREATE TABLE public.pickup_recovery_limits (phone_hash text PRIMARY KEY, window_started_at timestamptz NOT NULL DEFAULT now(), attempts integer NOT NULL DEFAULT 1);
GRANT ALL ON public.pickup_recovery_limits TO service_role;
ALTER TABLE public.pickup_recovery_limits ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.recover_active_pickups(_phone text, _nickname text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _normalized_phone text := regexp_replace(coalesce(_phone,''), '\D', '', 'g'); _normalized_nickname text := lower(regexp_replace(trim(coalesce(_nickname,'')), '\s+', ' ', 'g')); _attempts integer; _orders jsonb;
BEGIN
  IF _normalized_phone !~ '^(91)?[6-9][0-9]{9}$' OR length(_normalized_nickname) < 2 OR length(_normalized_nickname) > 80 THEN RETURN '[]'::jsonb; END IF;
  INSERT INTO public.pickup_recovery_limits(phone_hash) VALUES(md5(right(_normalized_phone,10)))
  ON CONFLICT(phone_hash) DO UPDATE SET
    attempts = CASE WHEN pickup_recovery_limits.window_started_at <= now() - interval '15 minutes' THEN 1 ELSE pickup_recovery_limits.attempts + 1 END,
    window_started_at = CASE WHEN pickup_recovery_limits.window_started_at <= now() - interval '15 minutes' THEN now() ELSE pickup_recovery_limits.window_started_at END
  RETURNING attempts INTO _attempts;
  IF _attempts > 10 THEN RETURN jsonb_build_object('limited',true); END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('order_code',o.order_code,'shop_slug',b.slug,'shop_name',b.public_name) ORDER BY o.created_at DESC),'[]'::jsonb)
  INTO _orders FROM public.pickup_orders o JOIN public.businesses b ON b.id=o.business_id
  WHERE right(regexp_replace(o.customer_phone,'\D','','g'),10)=right(_normalized_phone,10)
    AND lower(regexp_replace(trim(o.customer_name),'\s+',' ','g'))=_normalized_nickname
    AND o.status IN ('new','accepted','ready');
  RETURN _orders;
END $$;
REVOKE ALL ON FUNCTION public.recover_active_pickups(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recover_active_pickups(text,text) TO anon, authenticated;
COMMENT ON FUNCTION public.recover_active_pickups(text,text) IS 'Active pickup-code recovery with phone plus case-insensitive nickname, limited to 10 checks per phone per 15 minutes. Nicknames are not verified identity.';