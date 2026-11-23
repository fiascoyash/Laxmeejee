-- Run once on the ORIGINAL backend only. Does not change existing order RPCs.
BEGIN;

CREATE TABLE public.pickup_feedback (
  order_id uuid PRIMARY KEY REFERENCES public.pickup_orders(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  phone_hash text NOT NULL,
  device_hash text NOT NULL,
  receipt text NOT NULL CHECK (receipt IN ('received', 'issue')),
  rating integer CHECK (rating BETWEEN 1 AND 5),
  tags text[] NOT NULL DEFAULT '{}',
  comment text NOT NULL DEFAULT '' CHECK (length(comment) <= 500),
  score_eligible boolean NOT NULL DEFAULT false,
  exclusion text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.pickup_feedback TO authenticated;
GRANT ALL ON public.pickup_feedback TO service_role;
ALTER TABLE public.pickup_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read customer feedback" ON public.pickup_feedback
  FOR SELECT TO authenticated USING (public.is_business_member(business_id));
CREATE INDEX pickup_feedback_shop_time ON public.pickup_feedback(business_id, created_at);

CREATE TABLE public.pickup_feedback_limits (
  attempt_key text PRIMARY KEY,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0
);
GRANT ALL ON public.pickup_feedback_limits TO service_role;
ALTER TABLE public.pickup_feedback_limits ENABLE ROW LEVEL SECURITY;

-- Internal verifier: code + phone authorize feedback, never phone alone.
-- Six failed lookups per code / 15 minutes; phone-only brute force cannot rotate the limit.
CREATE FUNCTION public.feedback_order(_code text, _phone text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE p text := regexp_replace(coalesce(_phone,''), '\D','','g');
  c text := upper(trim(coalesce(_code,''))); k text; n integer; oid uuid;
BEGIN
  IF c !~ '^[A-Z0-9]{4,10}$' OR NOT (p ~ '^[6-9][0-9]{9}$' OR p ~ '^91[6-9][0-9]{9}$') THEN RETURN NULL; END IF;
  p := right(p,10); k := md5('feedback:' || c);
  INSERT INTO pickup_feedback_limits(attempt_key) VALUES(k) ON CONFLICT DO NOTHING;
  SELECT attempts INTO n FROM pickup_feedback_limits WHERE attempt_key=k FOR UPDATE;
  UPDATE pickup_feedback_limits SET attempts=0, window_started_at=now()
    WHERE attempt_key=k AND window_started_at <= now()-interval '15 minutes';
  SELECT attempts INTO n FROM pickup_feedback_limits WHERE attempt_key=k;
  IF n >= 6 THEN RETURN NULL; END IF;
  SELECT id INTO oid FROM pickup_orders WHERE order_code=c
    AND right(regexp_replace(customer_phone,'\D','','g'),10)=p
    ORDER BY created_at DESC LIMIT 1;
  IF oid IS NULL THEN UPDATE pickup_feedback_limits SET attempts=attempts+1 WHERE attempt_key=k; END IF;
  RETURN oid;
END $$;
REVOKE ALL ON FUNCTION public.feedback_order(text,text) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.get_pickup_feedback(_code text, _phone text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE oid uuid; result jsonb;
BEGIN
  oid := public.feedback_order(_code,_phone);
  IF oid IS NULL THEN RETURN jsonb_build_object('available',false); END IF;
  IF NOT EXISTS(SELECT 1 FROM pickup_orders WHERE id=oid AND status='collected') THEN
    RETURN jsonb_build_object('available',false);
  END IF;
  SELECT jsonb_build_object('receipt',receipt,'rating',rating,'tags',tags,'comment',comment,
    'score_eligible',score_eligible,'exclusion',exclusion) INTO result FROM pickup_feedback WHERE order_id=oid;
  RETURN jsonb_build_object('available',true,'feedback',result);
END $$;
REVOKE ALL ON FUNCTION public.get_pickup_feedback(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pickup_feedback(text,text) TO anon, authenticated;

CREATE FUNCTION public.submit_pickup_feedback(_code text, _phone text, _receipt text,
  _rating integer DEFAULT NULL, _tags text[] DEFAULT '{}', _comment text DEFAULT '', _device text DEFAULT '')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE oid uuid; o public.pickup_orders%ROWTYPE; b public.businesses%ROWTYPE;
  ph text; dh text; why text; existing public.pickup_feedback%ROWTYPE;
BEGIN
  IF _receipt IS NULL OR _receipt NOT IN ('received','issue') OR (_rating IS NOT NULL AND (_rating<1 OR _rating>5 OR _receipt<>'received'))
    OR length(coalesce(_comment,''))>500 OR cardinality(coalesce(_tags,'{}'))>5
    OR NOT (coalesce(_tags,'{}') <@ ARRAY['Order ready','Friendly service','As ordered','Not received','Item problem'])
    OR _device IS NULL OR _device !~ '^[a-zA-Z0-9-]{16,80}$' THEN
    RETURN jsonb_build_object('ok',false,'message','Please check your feedback.');
  END IF;
  oid := public.feedback_order(_code,_phone);
  IF oid IS NULL THEN RETURN jsonb_build_object('ok',false,'message','Order details did not match or too many attempts. Try again later.'); END IF;
  SELECT * INTO o FROM pickup_orders WHERE id=oid FOR UPDATE;
  IF o.status<>'collected' OR o.collected_at IS NULL THEN
    RETURN jsonb_build_object('ok',false,'message','Feedback opens after the shop marks your order collected.');
  END IF;
  -- Serialize each shop's scoring decisions to prevent concurrent cap bypass.
  PERFORM pg_advisory_xact_lock(hashtext(o.business_id::text));
  SELECT * INTO existing FROM pickup_feedback WHERE order_id=oid;
  IF FOUND THEN RETURN jsonb_build_object('ok',true,'already_saved',true); END IF;
  SELECT * INTO b FROM businesses WHERE id=o.business_id;
  ph := encode(sha256(convert_to(o.business_id::text || ':' || right(regexp_replace(o.customer_phone,'\D','','g'),10),'UTF8')),'hex');
  dh := encode(sha256(convert_to(o.business_id::text || ':' || _device,'UTF8')),'hex');
  IF right(regexp_replace(coalesce(b.phone,''),'\D','','g'),10)=right(regexp_replace(o.customer_phone,'\D','','g'),10)
    OR EXISTS(SELECT 1 FROM business_members WHERE business_id=o.business_id AND user_id=auth.uid())
    OR EXISTS(SELECT 1 FROM business_members m JOIN auth.users u ON u.id=m.user_id
      WHERE m.business_id=o.business_id AND right(regexp_replace(coalesce(u.phone,''),'\D','','g'),10)=right(regexp_replace(o.customer_phone,'\D','','g'),10)) THEN
    why := 'Shop members and shop phone numbers cannot influence ratings';
  ELSIF o.total<=0 OR o.accepted_at IS NULL OR o.ready_at IS NULL
    OR o.accepted_at<o.created_at OR o.ready_at<o.accepted_at OR o.collected_at<o.ready_at
    OR o.collected_at-o.created_at<interval '10 minutes' THEN
    why := 'Rapid or incomplete order history';
  ELSIF EXISTS(SELECT 1 FROM pickup_feedback WHERE business_id=o.business_id AND score_eligible
    AND created_at>now()-interval '30 days' AND (phone_hash=ph OR device_hash=dh)) THEN
    why := 'One rating per customer or browser for this shop every 30 days';
  ELSIF (SELECT count(*) FROM pickup_feedback WHERE business_id=o.business_id AND score_eligible
    AND created_at>=date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')>=5 THEN
    why := 'Daily rating limit reached';
  END IF;
  INSERT INTO pickup_feedback(order_id,business_id,phone_hash,device_hash,receipt,rating,tags,comment,score_eligible,exclusion)
    VALUES(oid,o.business_id,ph,dh,_receipt,_rating,coalesce(_tags,'{}'),trim(coalesce(_comment,'')),
      why IS NULL AND _receipt='received' AND _rating IS NOT NULL,why);
  RETURN jsonb_build_object('ok',true);
END $$;
REVOKE ALL ON FUNCTION public.submit_pickup_feedback(text,text,text,integer,text[],text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_pickup_feedback(text,text,text,integer,text[],text,text) TO anon, authenticated;

-- Only aggregate ratings are public: no phone hashes, comments, names or orders.
-- Wait 24 hours and require five distinct customers before displaying a score.
CREATE FUNCTION public.pickup_review_stats(_slug text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  WITH eligible AS (
    SELECT f.rating, f.phone_hash FROM pickup_feedback f JOIN businesses b ON b.id=f.business_id
    WHERE b.slug=_slug AND b.is_published AND f.score_eligible AND f.receipt='received'
      AND f.created_at<=now()-interval '24 hours' AND f.created_at>now()-interval '180 days'
  )
  SELECT CASE WHEN count(DISTINCT phone_hash)>=5 THEN
    jsonb_build_object('count',count(*),'average',round(avg(rating),1))
    ELSE jsonb_build_object('count',0,'average',NULL) END FROM eligible;
$$;
REVOKE ALL ON FUNCTION public.pickup_review_stats(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pickup_review_stats(text) TO anon, authenticated;
COMMIT;