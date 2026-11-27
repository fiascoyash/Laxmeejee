-- OWNER-APPLIED ONLY: run in the ORIGINAL production Supabase SQL editor.
-- Creates empty storage; does not upload browser data or change existing tables.
BEGIN;

CREATE TABLE public.business_records (
  business_id uuid NOT NULL DEFAULT public.current_business_id()
    REFERENCES public.businesses(id) ON DELETE CASCADE,
  collection text NOT NULL CHECK (length(collection) > 0),
  record_id text NOT NULL CHECK (length(record_id) > 0),
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  deleted boolean NOT NULL DEFAULT false,
  PRIMARY KEY (business_id, collection, record_id)
);
GRANT SELECT, INSERT, UPDATE ON public.business_records TO authenticated;
GRANT ALL ON public.business_records TO service_role;
REVOKE ALL ON public.business_records FROM anon, PUBLIC;
ALTER TABLE public.business_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY business_records_member_read ON public.business_records
  FOR SELECT TO authenticated
  USING (public.is_business_member(business_id));
CREATE POLICY business_records_member_insert ON public.business_records
  FOR INSERT TO authenticated
  WITH CHECK (public.is_business_member(business_id));
CREATE POLICY business_records_member_update ON public.business_records
  FOR UPDATE TO authenticated
  USING (public.is_business_member(business_id))
  WITH CHECK (public.is_business_member(business_id));

CREATE INDEX business_records_sync_idx
  ON public.business_records (business_id, updated_at);

-- Database timestamps avoid conflicting device clocks. Soft deletions allow
-- offline devices to discover removals when they reconnect.
CREATE FUNCTION public.stamp_business_record()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND
    (NEW.business_id, NEW.collection, NEW.record_id) IS DISTINCT FROM
    (OLD.business_id, OLD.collection, OLD.record_id) THEN
    RAISE EXCEPTION 'Record identity cannot be changed';
  END IF;
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.stamp_business_record() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.stamp_business_record()
  TO authenticated, service_role;

CREATE TRIGGER business_records_stamp
  BEFORE INSERT OR UPDATE ON public.business_records
  FOR EACH ROW EXECUTE FUNCTION public.stamp_business_record();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.business_records;
  ELSE
    RAISE NOTICE 'Enable Realtime for business_records in Supabase before app syncing is activated.';
  END IF;
END;
$$;

COMMIT;